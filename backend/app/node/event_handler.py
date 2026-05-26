import asyncio
import logging
from datetime import datetime, timezone

from meshcore import EventType

logger = logging.getLogger(__name__)

# Fields tracked in ContactHistory for change detection
_TRACKED_CONTACT_FIELDS = {
    'adv_name': 'adv_name',
    'adv_lat': 'lat',
    'adv_lon': 'lon',
}


class EventHandler:
    """
    Receives all meshcore events for one node.
    Writes to DB and emits SocketIO events.
    Runs as an async callback inside the asyncio loop thread.
    """

    def __init__(self, node_id: int, app) -> None:
        self.node_id = node_id
        self._app = app

    async def handle(self, event) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._handle_sync, event)

    def _handle_sync(self, event) -> None:
        try:
            with self._app.app_context():
                self._dispatch(event)
        except Exception:
            logger.exception(f'Node {self.node_id}: error handling {event.type}')

    def _dispatch(self, event) -> None:
        from ..extensions import db, socketio

        dispatch = {
            EventType.CONTACT_MSG_RECV: self._on_direct_message,
            EventType.CHANNEL_MSG_RECV: self._on_channel_message,
            EventType.ADVERTISEMENT: self._on_advertisement,
            EventType.NEW_CONTACT: self._on_new_contact,
            EventType.TELEMETRY_RESPONSE: self._on_telemetry,
            EventType.STATUS_RESPONSE: self._on_status,
            EventType.PATH_UPDATE: self._on_path_update,
            EventType.CONNECTED: self._on_connected,
            EventType.DISCONNECTED: self._on_disconnected,
            EventType.MSG_SENT: self._on_msg_sent,
            EventType.ACK: self._on_ack,
            EventType.SELF_INFO: self._on_self_info,
        }

        handler = dispatch.get(event.type)
        if handler:
            handler(event, db, socketio)

    # ------------------------------------------------------------------
    # Message events
    # ------------------------------------------------------------------

    def _on_direct_message(self, event, db, socketio) -> None:
        from ..db.models import Contact, Message

        p = event.payload
        pubkey_prefix = p.get('pubkey_prefix', '')
        contact = db.session.execute(
            db.select(Contact).filter(
                Contact.node_id == self.node_id,
                Contact.public_key.like(pubkey_prefix + '%'),
            )
        ).scalar_one_or_none()

        if contact:
            contact.last_heard = datetime.now(timezone.utc)

        msg = Message(
            node_id=self.node_id,
            direction='in',
            msg_type='direct',
            contact_id=contact.id if contact else None,
            text=p.get('text', ''),
            txt_type=p.get('txt_type', 0),
            timestamp=datetime.now(timezone.utc),
            sender_timestamp=p.get('sender_timestamp'),
            snr=p.get('SNR'),
            status='received',
        )
        db.session.add(msg)
        db.session.commit()
        socketio.emit('message:received', {
            'node_id': self.node_id,
            'message': msg.to_dict(),
        })

    def _on_channel_message(self, event, db, socketio) -> None:
        from ..db.models import Message

        p = event.payload
        msg = Message(
            node_id=self.node_id,
            direction='in',
            msg_type='channel',
            channel_idx=p.get('channel_idx'),
            text=p.get('text', ''),
            txt_type=p.get('txt_type', 0),
            timestamp=datetime.now(timezone.utc),
            sender_timestamp=p.get('sender_timestamp'),
            snr=p.get('SNR'),
            rssi=p.get('RSSI'),
            status='received',
        )
        db.session.add(msg)
        db.session.commit()
        socketio.emit('message:received', {
            'node_id': self.node_id,
            'message': msg.to_dict(),
        })

    def _on_msg_sent(self, event, db, socketio) -> None:
        from ..db.models import Message

        p = event.payload
        raw_ack = p.get('expected_ack', b'')
        ack_hex = raw_ack.hex() if isinstance(raw_ack, bytes) else str(raw_ack)

        msg = db.session.execute(
            db.select(Message).filter_by(
                node_id=self.node_id,
                expected_ack=ack_hex,
                status='sending',
            )
        ).scalar_one_or_none()
        if msg:
            msg.status = 'sent'
            db.session.commit()
            socketio.emit('message:ack', {
                'node_id': self.node_id,
                'message_id': msg.id,
                'status': 'sent',
            })

    def _on_ack(self, event, db, socketio) -> None:
        from ..db.models import Message

        code = event.payload.get('code', '')
        msg = db.session.execute(
            db.select(Message).filter_by(
                node_id=self.node_id,
                expected_ack=code,
                status='sent',
            )
        ).scalar_one_or_none()
        if msg:
            msg.status = 'acked'
            db.session.commit()
            socketio.emit('message:ack', {
                'node_id': self.node_id,
                'message_id': msg.id,
                'status': 'acked',
            })

    # ------------------------------------------------------------------
    # Contact events
    # ------------------------------------------------------------------

    def _on_new_contact(self, event, db, socketio) -> None:
        from ..db.models import Contact

        p = event.payload
        public_key = p.get('public_key', '')
        if not public_key:
            return

        existing = db.session.execute(
            db.select(Contact).filter_by(node_id=self.node_id, public_key=public_key)
        ).scalar_one_or_none()
        if existing:
            return

        last_advert = None
        if p.get('last_advert'):
            last_advert = datetime.fromtimestamp(p['last_advert'], tz=timezone.utc)

        contact = Contact(
            node_id=self.node_id,
            public_key=public_key,
            adv_name=p.get('adv_name', ''),
            contact_type=p.get('type', 0),
            last_advert=last_advert,
            lat=p.get('adv_lat'),
            lon=p.get('adv_lon'),
            out_path=p.get('out_path'),
        )
        db.session.add(contact)
        db.session.commit()
        socketio.emit('contact:new', {
            'node_id': self.node_id,
            'contact': contact.to_dict(),
        })

    def _on_advertisement(self, event, db, socketio) -> None:
        from ..db.models import Contact

        public_key = event.payload.get('public_key', '')
        if not public_key:
            return

        contact = db.session.execute(
            db.select(Contact).filter_by(node_id=self.node_id, public_key=public_key)
        ).scalar_one_or_none()
        if contact:
            now = datetime.now(timezone.utc)
            contact.last_advert = now
            contact.last_heard = now
            db.session.commit()
            socketio.emit('contact:updated', {
                'node_id': self.node_id,
                'contact': contact.to_dict(),
            })

    # ------------------------------------------------------------------
    # Telemetry / status
    # ------------------------------------------------------------------

    def _on_telemetry(self, event, db, socketio) -> None:
        from ..db.models import Contact, TelemetryRecord

        p = event.payload
        pubkey_pre = p.get('pubkey_pre', '')
        contact = None
        if pubkey_pre:
            contact = db.session.execute(
                db.select(Contact).filter(
                    Contact.node_id == self.node_id,
                    Contact.public_key.like(pubkey_pre + '%'),
                )
            ).scalar_one_or_none()

        record = TelemetryRecord(
            node_id=self.node_id,
            contact_id=contact.id if contact else None,
            timestamp=datetime.now(timezone.utc),
        )
        record.set_lpp(p.get('lpp', {}))
        db.session.add(record)
        db.session.commit()

        socketio.emit('telemetry:received', {
            'node_id': self.node_id,
            'contact_id': contact.id if contact else None,
            'record': record.to_dict(),
        })

    def _on_status(self, event, db, socketio) -> None:
        from ..db.models import Contact
        p = event.payload
        contact_id = None
        pubkey_prefix = p.get('pubkey_prefix') or p.get('pubkey_pre', '')
        if pubkey_prefix:
            contact = db.session.execute(
                db.select(Contact).filter(
                    Contact.node_id == self.node_id,
                    Contact.public_key.like(pubkey_prefix + '%'),
                )
            ).scalar_one_or_none()
            if contact:
                contact_id = contact.id
        socketio.emit('node:status', {
            'node_id': self.node_id,
            'contact_id': contact_id,
            'status': p,
        })

    def _on_path_update(self, event, db, socketio) -> None:
        from ..db.models import Contact
        p = event.payload
        public_key = p.get('public_key', '')
        if not public_key:
            return
        contact = db.session.execute(
            db.select(Contact).filter_by(node_id=self.node_id, public_key=public_key)
        ).scalar_one_or_none()
        if not contact:
            return
        out_path = p.get('out_path') or p.get('path')
        if out_path is not None:
            contact.out_path = out_path
            db.session.commit()
            socketio.emit('contact:updated', {
                'node_id': self.node_id,
                'contact': contact.to_dict(),
            })

    # ------------------------------------------------------------------
    # Node connection events
    # ------------------------------------------------------------------

    def _on_connected(self, event, db, socketio) -> None:
        from ..db.models import Node

        node = db.session.get(Node, self.node_id)
        if node:
            node.last_seen = datetime.now(timezone.utc)
            db.session.commit()

        socketio.emit('node:connection', {
            'node_id': self.node_id,
            'connected': True,
            'reconnected': event.payload.get('reconnected', False),
        })

    def _on_disconnected(self, event, db, socketio) -> None:
        socketio.emit('node:connection', {
            'node_id': self.node_id,
            'connected': False,
            'reason': event.payload.get('reason'),
        })

    def _on_self_info(self, event, db, socketio) -> None:
        from ..db.models import Node

        node = db.session.get(Node, self.node_id)
        if node:
            node.set_self_info(event.payload)
            node.last_seen = datetime.now(timezone.utc)
            db.session.commit()

        socketio.emit('node:self_info', {
            'node_id': self.node_id,
            'self_info': event.payload,
        })
