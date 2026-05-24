import asyncio

from flask import Blueprint, g, jsonify, request

from ..auth.utils import require_auth
from ..db.models import Node
from ..extensions import db
from ..node.manager import node_manager

nodes_bp = Blueprint('nodes', __name__)


def _node_dict(node: Node, include_self_info: bool = False) -> dict:
    d = node.to_dict(include_self_info=include_self_info)
    d['connected'] = node_manager.is_connected(node.id)
    return d


@nodes_bp.get('/')
@require_auth
def list_nodes():
    nodes = db.session.execute(db.select(Node)).scalars().all()
    return jsonify([_node_dict(n) for n in nodes])


@nodes_bp.post('/')
@require_auth
def create_node():
    data = request.get_json(silent=True) or {}
    conn_type = data.get('connection_type', '')
    if conn_type not in ('tcp', 'serial'):
        return jsonify({'error': 'connection_type must be "tcp" or "serial"'}), 422
    if conn_type == 'tcp':
        if not data.get('host') or not data.get('port'):
            return jsonify({'error': 'host and port required for TCP'}), 422
    else:
        if not data.get('device_path'):
            return jsonify({'error': 'device_path required for serial'}), 422

    node = Node(
        name=data.get('name', 'Unnamed Node'),
        connection_type=conn_type,
        host=data.get('host'),
        port=data.get('port'),
        device_path=data.get('device_path'),
        baud_rate=data.get('baud_rate', 115200),
        enabled=data.get('enabled', True),
    )
    db.session.add(node)
    db.session.commit()

    if node.enabled:
        node_manager.connect(node.id)

    return jsonify(_node_dict(node)), 201


@nodes_bp.get('/<int:node_id>')
@require_auth
def get_node(node_id: int):
    node = db.session.get(Node, node_id)
    if not node:
        return jsonify({'error': 'Node not found'}), 404
    return jsonify(_node_dict(node, include_self_info=True))


@nodes_bp.put('/<int:node_id>')
@require_auth
def update_node(node_id: int):
    node = db.session.get(Node, node_id)
    if not node:
        return jsonify({'error': 'Node not found'}), 404

    data = request.get_json(silent=True) or {}
    for field in ('name', 'host', 'port', 'device_path', 'baud_rate'):
        if field in data:
            setattr(node, field, data[field])
    if 'enabled' in data:
        node.enabled = bool(data['enabled'])

    db.session.commit()

    # Reconnect if config changed and node is enabled
    if node.enabled:
        node_manager.connect(node.id)
    else:
        node_manager.disconnect(node.id)

    return jsonify(_node_dict(node, include_self_info=True))


@nodes_bp.delete('/<int:node_id>')
@require_auth
def delete_node(node_id: int):
    node = db.session.get(Node, node_id)
    if not node:
        return jsonify({'error': 'Node not found'}), 404
    node_manager.disconnect(node.id)
    db.session.delete(node)
    db.session.commit()
    return jsonify({'ok': True})


@nodes_bp.post('/<int:node_id>/connect')
@require_auth
def connect_node(node_id: int):
    node = db.session.get(Node, node_id)
    if not node:
        return jsonify({'error': 'Node not found'}), 404
    node_manager.connect(node.id)
    return jsonify({'ok': True})


@nodes_bp.post('/<int:node_id>/disconnect')
@require_auth
def disconnect_node(node_id: int):
    node = db.session.get(Node, node_id)
    if not node:
        return jsonify({'error': 'Node not found'}), 404
    node_manager.disconnect(node.id)
    return jsonify({'ok': True})


@nodes_bp.get('/<int:node_id>/stats')
@require_auth
def get_stats(node_id: int):
    node = db.session.get(Node, node_id)
    if not node:
        return jsonify({'error': 'Node not found'}), 404

    conn = node_manager.get_connection(node_id)
    if not conn or not conn.is_connected:
        return jsonify({'error': 'Node not connected'}), 503

    async def _fetch(mc):
        core, radio, packets, battery = await asyncio.gather(
            mc.commands.get_stats_core(),
            mc.commands.get_stats_radio(),
            mc.commands.get_stats_packets(),
            mc.commands.get_bat(),
        )
        return {
            'core': core.payload if core else None,
            'radio': radio.payload if radio else None,
            'packets': packets.payload if packets else None,
            'battery': battery.payload if battery else None,
        }

    try:
        stats = node_manager.run_async(_fetch(conn.mc), timeout=15)
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@nodes_bp.put('/<int:node_id>/config')
@require_auth
def push_config(node_id: int):
    """Push radio/device config changes to the physical node."""
    node = db.session.get(Node, node_id)
    if not node:
        return jsonify({'error': 'Node not found'}), 404

    conn = node_manager.get_connection(node_id)
    if not conn or not conn.is_connected:
        return jsonify({'error': 'Node not connected'}), 503

    data = request.get_json(silent=True) or {}

    async def _push(mc, data):
        results = {}
        if 'name' in data:
            r = await mc.commands.set_name(data['name'])
            results['name'] = r.type.name
        if all(k in data for k in ('freq', 'bw', 'sf', 'cr')):
            r = await mc.commands.set_radio(data['freq'], data['bw'], data['sf'], data['cr'])
            results['radio'] = r.type.name
        if 'tx_power' in data:
            r = await mc.commands.set_tx_power(data['tx_power'])
            results['tx_power'] = r.type.name
        return results

    try:
        results = node_manager.run_async(_push(conn.mc, data), timeout=20)
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
