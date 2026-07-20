import base64
import logging
import secrets

from flask import Blueprint, jsonify, request

from ..auth.utils import require_auth
from ..node.manager import node_manager

logger = logging.getLogger(__name__)

channels_bp = Blueprint('channels', __name__)

# Well-known MeshCore public channel PSK — pre-configured on channel 0 by firmware.
PUBLIC_CHANNEL_NAME = 'Public'
PUBLIC_CHANNEL_PSK = base64.b64decode('izOH6cXN6mrJ5e26oRXNcg==')


def _get_connection(node_id):
    conn = node_manager.get_connection(node_id)
    if not conn or not conn.is_connected:
        return None
    return conn


def _channel_dict(payload):
    return {
        'channel_idx': payload['channel_idx'],
        'channel_name': (payload.get('channel_name') or '').strip(),
        'channel_secret': base64.b64encode(payload['channel_secret']).decode(),
    }


async def _channel_table(mc):
    """Read every channel slot from the device, including empty ones."""
    from meshcore import EventType

    info = await mc.commands.send_device_query()
    if info.type != EventType.DEVICE_INFO:
        raise RuntimeError(f'device query failed: {info.payload}')

    slots = []
    for idx in range(info.payload['max_channels']):
        event = await mc.commands.get_channel(idx)
        if event.type != EventType.CHANNEL_INFO:
            break
        slots.append(_channel_dict(event.payload))
    return slots


@channels_bp.get('/')
@require_auth
def list_channels():
    node_id = request.args.get('node_id', type=int)
    if not node_id:
        return jsonify({'error': 'node_id is required'}), 422

    conn = _get_connection(node_id)
    if not conn:
        return jsonify({'error': 'Node not connected'}), 503

    try:
        slots = node_manager.run_async(_channel_table(conn.mc), timeout=20)
        return jsonify([s for s in slots if s['channel_name']])
    except Exception:
        logger.exception('fetch channels failed for node %d', node_id)
        return jsonify({'error': 'Internal server error'}), 500


@channels_bp.post('/')
@require_auth
def add_channel():
    data = request.get_json(silent=True) or {}
    node_id = data.get('node_id')
    chan_type = data.get('type')

    if not node_id:
        return jsonify({'error': 'node_id is required'}), 422
    if chan_type not in ('public', 'hashtag', 'private'):
        return jsonify({'error': 'type must be "public", "hashtag" or "private"'}), 422

    if chan_type == 'public':
        name = PUBLIC_CHANNEL_NAME
        secret = PUBLIC_CHANNEL_PSK
    else:
        name = str(data.get('name', '')).strip()
        if chan_type == 'hashtag':
            name = '#' + name.lstrip('#')
        if not name.lstrip('#'):
            return jsonify({'error': 'name is required'}), 422
        if name.startswith('#') and chan_type == 'private':
            return jsonify({'error': 'Private channel names cannot start with #'}), 422
        if len(name.encode('utf-8')) > 32:
            return jsonify({'error': 'name must be at most 32 bytes'}), 422

        if chan_type == 'hashtag':
            # meshcore derives the key from sha256(name)[:16] for '#' names
            secret = None
        else:
            secret_b64 = str(data.get('secret', '')).strip()
            if secret_b64:
                try:
                    secret = base64.b64decode(secret_b64, validate=True)
                except Exception:
                    return jsonify({'error': 'secret must be valid base64'}), 422
                if len(secret) != 16:
                    return jsonify({'error': 'secret must decode to exactly 16 bytes'}), 422
            else:
                # No key supplied → create a brand-new private channel
                secret = secrets.token_bytes(16)

    conn = _get_connection(node_id)
    if not conn:
        return jsonify({'error': 'Node not connected'}), 503

    async def _add(mc):
        from meshcore import EventType

        slots = await _channel_table(mc)
        if any(s['channel_name'] == name for s in slots):
            return {'error': 'A channel with this name already exists', 'status': 409}
        free = next((s for s in slots if not s['channel_name']), None)
        if free is None:
            return {'error': 'No free channel slots on this node', 'status': 409}

        result = await mc.commands.set_channel(free['channel_idx'], name, secret)
        if result.type == EventType.ERROR:
            raise RuntimeError(f'set_channel failed: {result.payload}')

        info = await mc.commands.get_channel(free['channel_idx'])
        if info.type != EventType.CHANNEL_INFO:
            raise RuntimeError(f'channel readback failed: {info.payload}')
        return _channel_dict(info.payload)

    try:
        result = node_manager.run_async(_add(conn.mc), timeout=25)
    except Exception:
        logger.exception('add channel failed for node %d', node_id)
        return jsonify({'error': 'Internal server error'}), 500

    if 'error' in result:
        return jsonify({'error': result['error']}), result['status']
    return jsonify(result), 201


@channels_bp.delete('/<int:channel_idx>')
@require_auth
def remove_channel(channel_idx):
    node_id = request.args.get('node_id', type=int)
    if not node_id:
        return jsonify({'error': 'node_id is required'}), 422

    conn = _get_connection(node_id)
    if not conn:
        return jsonify({'error': 'Node not connected'}), 503

    async def _remove(mc):
        from meshcore import EventType
        # Blank name + all-zero key clears the slot. The zero key must be
        # explicit — passing None makes the lib derive a key from ''.
        result = await mc.commands.set_channel(channel_idx, '', bytes(16))
        if result.type == EventType.ERROR:
            raise RuntimeError(f'set_channel failed: {result.payload}')

    try:
        node_manager.run_async(_remove(conn.mc), timeout=15)
        return jsonify({'ok': True})
    except Exception:
        logger.exception('remove channel %d failed for node %d', channel_idx, node_id)
        return jsonify({'error': 'Internal server error'}), 500
