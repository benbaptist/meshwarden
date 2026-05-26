from flask import Blueprint, jsonify, request

from ..auth.utils import require_auth
from ..node.manager import node_manager

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
            if event and event.type == EventType.CHANNEL_INFO:
                channels.append({
                    'channel_idx': event.payload['channel_idx'],
                    'channel_name': event.payload['channel_name'],
                })
            else:
                break
        return channels

    try:
        channels = node_manager.run_async(_fetch(conn.mc), timeout=15)
        return jsonify(channels)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
