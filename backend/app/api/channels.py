import logging

from flask import Blueprint, jsonify, request

from ..auth.utils import require_auth
from ..node.manager import node_manager

logger = logging.getLogger(__name__)

channels_bp = Blueprint('channels', __name__)


@channels_bp.get('/')
@require_auth
def list_channels():
    node_id = request.args.get('node_id', type=int)
    if not node_id:
        return jsonify({'error': 'node_id is required'}), 422

    conn = node_manager.get_connection(node_id)
    if not conn or not conn.is_connected:
        return jsonify({'error': 'Node not connected'}), 503

    async def _fetch(mc):
        from meshcore import EventType
        channels = []
        for idx in range(8):
            event = await mc.commands.get_channel(idx)
            if not event or event.type != EventType.CHANNEL_INFO:
                break
            name = (event.payload.get('channel_name') or '').strip()
            # Channel 0 is always Public; skip higher indices with no configured name
            if idx == 0 or name:
                channels.append({
                    'channel_idx': event.payload['channel_idx'],
                    'channel_name': name,
                })
        return channels

    try:
        channels = node_manager.run_async(_fetch(conn.mc), timeout=15)
        return jsonify(channels)
    except Exception:
        logger.exception('fetch channels failed for node %d', node_id)
        return jsonify({'error': 'Internal server error'}), 500
