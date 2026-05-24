import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


class NodeConnection:
    """Manages a single meshcore connection for one node."""

    def __init__(self, node_id: int, node_model, app) -> None:
        self.node_id = node_id
        self._node = node_model
        self._app = app
        self._mc = None
        self._subscriptions: list = []

    @property
    def mc(self):
        return self._mc

    @property
    def is_connected(self) -> bool:
        return self._mc is not None and self._mc.is_connected

    async def connect(self) -> None:
        try:
            from meshcore import MeshCore
            if self._node.connection_type == 'tcp':
                self._mc = await MeshCore.create_tcp(
                    self._node.host,
                    self._node.port,
                    auto_reconnect=True,
                )
            else:  # serial
                self._mc = await MeshCore.create_serial(
                    self._node.device_path,
                    self._node.baud_rate or 115200,
                )

            if self._mc is None:
                logger.error(f'Node {self.node_id}: connection returned None')
                return

            await self._mc.start_auto_message_fetching()
            self._subscribe()
            await self._initial_sync()
            logger.info(f'Node {self.node_id}: connected')

        except Exception:
            logger.exception(f'Node {self.node_id}: connection failed')

    def _subscribe(self) -> None:
        from .event_handler import EventHandler
        handler = EventHandler(self.node_id, self._app)
        sub = self._mc.subscribe(None, handler.handle)
        self._subscriptions.append(sub)

    async def _initial_sync(self) -> None:
        """Sync contacts from device into DB on first connect."""
        try:
            await self._mc.ensure_contacts()
            contacts = self._mc.contacts  # dict keyed by public_key hex

            with self._app.app_context():
                from ..extensions import db
                from ..db.models import Contact

                for public_key, data in contacts.items():
                    existing = db.session.execute(
                        db.select(Contact).filter_by(
                            node_id=self.node_id, public_key=public_key
                        )
                    ).scalar_one_or_none()

                    last_advert = None
                    if data.get('last_advert'):
                        last_advert = datetime.fromtimestamp(
                            data['last_advert'], tz=timezone.utc
                        )

                    if existing:
                        existing.adv_name = data.get('adv_name') or existing.adv_name
                        existing.contact_type = data.get('type', existing.contact_type)
                        existing.lat = data.get('adv_lat') or existing.lat
                        existing.lon = data.get('adv_lon') or existing.lon
                        existing.out_path = data.get('out_path') or existing.out_path
                        if last_advert:
                            existing.last_advert = last_advert
                    else:
                        contact = Contact(
                            node_id=self.node_id,
                            public_key=public_key,
                            adv_name=data.get('adv_name', ''),
                            contact_type=data.get('type', 0),
                            last_advert=last_advert,
                            lat=data.get('adv_lat'),
                            lon=data.get('adv_lon'),
                            out_path=data.get('out_path'),
                        )
                        db.session.add(contact)

                db.session.commit()

        except Exception:
            logger.exception(f'Node {self.node_id}: initial contact sync failed')

    async def disconnect(self) -> None:
        for sub in self._subscriptions:
            try:
                sub.unsubscribe()
            except Exception:
                pass
        self._subscriptions.clear()

        if self._mc:
            try:
                await self._mc.disconnect()
            except Exception:
                pass
            self._mc = None
