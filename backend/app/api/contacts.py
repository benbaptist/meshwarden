from flask import Blueprint, jsonify, request

from ..auth.utils import require_auth
from ..db.models import Contact, ContactHistory, Group, GroupMembership, Message, TelemetryRecord
from ..extensions import db
from ..node.manager import node_manager

contacts_bp = Blueprint('contacts', __name__)

_PAGE_SIZE = 50


@contacts_bp.get('/')
@require_auth
def list_contacts():
    q = db.select(Contact)
    node_id = request.args.get('node_id', type=int)
    group_id = request.args.get('group_id', type=int)
    search = request.args.get('search', '').strip()

    if node_id:
        q = q.filter_by(node_id=node_id)
    if group_id:
        q = q.join(GroupMembership).filter(GroupMembership.group_id == group_id)
    if search:
        q = q.filter(Contact.adv_name.ilike(f'%{search}%'))

    contacts = db.session.execute(q).scalars().all()
    return jsonify([c.to_dict() for c in contacts])


@contacts_bp.get('/<int:contact_id>')
@require_auth
def get_contact(contact_id: int):
    contact = db.session.get(Contact, contact_id)
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404
    return jsonify(contact.to_dict())


@contacts_bp.put('/<int:contact_id>')
@require_auth
def update_contact(contact_id: int):
    contact = db.session.get(Contact, contact_id)
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404

    data = request.get_json(silent=True) or {}
    if 'tags' in data and isinstance(data['tags'], list):
        contact.set_tags(data['tags'])
    if 'notes' in data:
        contact.notes = str(data['notes'])[:4096]

    db.session.commit()
    return jsonify(contact.to_dict())


@contacts_bp.get('/<int:contact_id>/history')
@require_auth
def contact_history(contact_id: int):
    contact = db.session.get(Contact, contact_id)
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404

    page = request.args.get('page', 1, type=int)
    rows = db.session.execute(
        db.select(ContactHistory)
        .filter_by(contact_id=contact_id)
        .order_by(ContactHistory.timestamp.desc())
        .limit(_PAGE_SIZE)
        .offset((page - 1) * _PAGE_SIZE)
    ).scalars().all()
    return jsonify([r.to_dict() for r in rows])


@contacts_bp.get('/<int:contact_id>/telemetry')
@require_auth
def contact_telemetry(contact_id: int):
    contact = db.session.get(Contact, contact_id)
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404

    page = request.args.get('page', 1, type=int)
    from_ = request.args.get('from')
    to_ = request.args.get('to')

    q = db.select(TelemetryRecord).filter_by(contact_id=contact_id)
    if from_:
        q = q.filter(TelemetryRecord.timestamp >= from_)
    if to_:
        q = q.filter(TelemetryRecord.timestamp <= to_)
    q = q.order_by(TelemetryRecord.timestamp.desc()).limit(_PAGE_SIZE).offset(
        (page - 1) * _PAGE_SIZE
    )

    rows = db.session.execute(q).scalars().all()
    return jsonify([r.to_dict() for r in rows])


@contacts_bp.get('/<int:contact_id>/messages')
@require_auth
def contact_messages(contact_id: int):
    contact = db.session.get(Contact, contact_id)
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404

    page = request.args.get('page', 1, type=int)
    rows = db.session.execute(
        db.select(Message)
        .filter_by(contact_id=contact_id)
        .order_by(Message.timestamp.desc())
        .limit(_PAGE_SIZE)
        .offset((page - 1) * _PAGE_SIZE)
    ).scalars().all()
    return jsonify([r.to_dict() for r in rows])


@contacts_bp.get('/<int:contact_id>/signal')
@require_auth
def contact_signal(contact_id: int):
    """Returns SNR/RSSI history from messages."""
    contact = db.session.get(Contact, contact_id)
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404

    rows = db.session.execute(
        db.select(Message.timestamp, Message.snr, Message.rssi)
        .filter_by(contact_id=contact_id, direction='in')
        .filter(Message.snr.is_not(None))
        .order_by(Message.timestamp.desc())
        .limit(200)
    ).all()
    return jsonify([
        {'timestamp': r.timestamp.isoformat(), 'snr': r.snr, 'rssi': r.rssi}
        for r in rows
    ])


@contacts_bp.post('/<int:contact_id>/telemetry_req')
@require_auth
def request_telemetry(contact_id: int):
    contact = db.session.get(Contact, contact_id)
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404

    conn = node_manager.get_connection(contact.node_id)
    if not conn or not conn.is_connected:
        return jsonify({'error': 'Node not connected'}), 503

    async def _req(mc, contact_dict):
        return await mc.commands.send_telemetry_req(contact_dict)

    # Build contact dict in meshcore format
    contact_dict = {
        'public_key': contact.public_key,
        'adv_name': contact.adv_name or '',
        'type': contact.contact_type,
        'out_path': contact.out_path or '',
    }

    try:
        node_manager.run_async(_req(conn.mc, contact_dict), timeout=10)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
