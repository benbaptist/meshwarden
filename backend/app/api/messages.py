from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from ..auth.utils import require_auth
from ..db.models import Contact, Message
from ..extensions import db
from ..node.manager import node_manager

messages_bp = Blueprint('messages', __name__)

_PAGE_SIZE = 50


@messages_bp.get('/')
@require_auth
def list_messages():
    q = db.select(Message)
    node_id = request.args.get('node_id', type=int)
    contact_id = request.args.get('contact_id', type=int)
    channel_idx = request.args.get('channel_idx', type=int)
    page = request.args.get('page', 1, type=int)

    if node_id:
        q = q.filter(Message.node_id == node_id)
    if contact_id is not None:
        q = q.filter(Message.contact_id == contact_id)
    if channel_idx is not None:
        q = q.filter(Message.channel_idx == channel_idx, Message.msg_type == 'channel')

    q = q.order_by(Message.timestamp.desc()).limit(_PAGE_SIZE).offset((page - 1) * _PAGE_SIZE)
    rows = db.session.execute(q).scalars().all()
    return jsonify([r.to_dict() for r in rows])


@messages_bp.post('/')
@require_auth
def send_message():
    data = request.get_json(silent=True) or {}
    node_id = data.get('node_id')
    msg_type = data.get('msg_type', 'direct')
    text = str(data.get('text', '')).strip()

    if not node_id or not text:
        return jsonify({'error': 'node_id and text are required'}), 422
    if msg_type not in ('direct', 'channel'):
        return jsonify({'error': 'msg_type must be "direct" or "channel"'}), 422

    conn = node_manager.get_connection(node_id)
    if not conn or not conn.is_connected:
        return jsonify({'error': 'Node not connected'}), 503

    if msg_type == 'channel':
        channel_idx = data.get('channel_idx', 0)
        msg = Message(
            node_id=node_id,
            direction='out',
            msg_type='channel',
            channel_idx=channel_idx,
            text=text,
            timestamp=datetime.now(timezone.utc),
            status='sending',
        )
        db.session.add(msg)
        db.session.commit()

        async def _send_chan(mc, idx, txt):
            return await mc.commands.send_chan_msg(idx, txt)

        try:
            node_manager.run_async(_send_chan(conn.mc, channel_idx, text), timeout=15)
            msg.status = 'sent'
            db.session.commit()
        except Exception as e:
            msg.status = 'failed'
            db.session.commit()
            return jsonify({'error': str(e)}), 500

        return jsonify(msg.to_dict()), 201

    # Direct message
    contact_id = data.get('contact_id')
    if not contact_id:
        return jsonify({'error': 'contact_id required for direct messages'}), 422

    contact = db.session.get(Contact, contact_id)
    if not contact or contact.node_id != node_id:
        return jsonify({'error': 'Contact not found'}), 404

    msg = Message(
        node_id=node_id,
        direction='out',
        msg_type='direct',
        contact_id=contact_id,
        text=text,
        timestamp=datetime.now(timezone.utc),
        status='sending',
    )
    db.session.add(msg)
    db.session.commit()

    contact_dict = {
        'public_key': contact.public_key,
        'adv_name': contact.adv_name or '',
        'type': contact.contact_type,
        'out_path': contact.out_path or '',
    }

    async def _send_direct(mc, dst, txt):
        result = await mc.commands.send_msg(dst, txt)
        return result

    try:
        result = node_manager.run_async(_send_direct(conn.mc, contact_dict, text), timeout=15)
        if result and result.payload:
            raw_ack = result.payload.get('expected_ack', b'')
            msg.expected_ack = raw_ack.hex() if isinstance(raw_ack, bytes) else str(raw_ack)
        msg.status = 'sent'
        db.session.commit()
    except Exception as e:
        msg.status = 'failed'
        db.session.commit()
        return jsonify({'error': str(e)}), 500

    return jsonify(msg.to_dict()), 201
