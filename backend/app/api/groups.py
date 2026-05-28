import logging

from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from ..auth.utils import require_auth
from ..db.models import AutomationRule, Contact, Group, GroupMembership
from ..extensions import db, scheduler
from ..node.manager import node_manager

logger = logging.getLogger(__name__)

groups_bp = Blueprint('groups', __name__)


# ---------------------------------------------------------------------------
# Groups CRUD
# ---------------------------------------------------------------------------

@groups_bp.get('/')
@require_auth
def list_groups():
    groups = db.session.execute(db.select(Group)).scalars().all()
    return jsonify([g.to_dict() for g in groups])


@groups_bp.post('/')
@require_auth
def create_group():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 422

    group = Group(
        name=name,
        description=data.get('description'),
        color=data.get('color', '#3B82F6'),
    )
    db.session.add(group)
    db.session.commit()
    return jsonify(group.to_dict()), 201


@groups_bp.get('/<int:group_id>')
@require_auth
def get_group(group_id: int):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    d = group.to_dict()
    d['members'] = [
        m.contact.to_dict() for m in group.memberships
    ]
    return jsonify(d)


@groups_bp.put('/<int:group_id>')
@require_auth
def update_group(group_id: int):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    data = request.get_json(silent=True) or {}
    if 'name' in data:
        group.name = str(data['name']).strip() or group.name
    if 'description' in data:
        group.description = data['description']
    if 'color' in data:
        group.color = str(data['color'])[:7]

    db.session.commit()
    return jsonify(group.to_dict())


@groups_bp.delete('/<int:group_id>')
@require_auth
def delete_group(group_id: int):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    # Remove associated scheduler jobs
    for rule in group.automation_rules:
        _remove_scheduler_job(rule.id)

    db.session.delete(group)
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Group members
# ---------------------------------------------------------------------------

@groups_bp.post('/<int:group_id>/members')
@require_auth
def add_member(group_id: int):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    data = request.get_json(silent=True) or {}
    contact_id = data.get('contact_id')
    if not contact_id:
        return jsonify({'error': 'contact_id required'}), 422

    contact = db.session.get(Contact, contact_id)
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404

    try:
        membership = GroupMembership(group_id=group_id, contact_id=contact_id)
        db.session.add(membership)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Contact already in group'}), 409

    return jsonify({'ok': True}), 201


@groups_bp.delete('/<int:group_id>/members/<int:contact_id>')
@require_auth
def remove_member(group_id: int, contact_id: int):
    membership = db.session.execute(
        db.select(GroupMembership).filter_by(group_id=group_id, contact_id=contact_id)
    ).scalar_one_or_none()
    if not membership:
        return jsonify({'error': 'Membership not found'}), 404

    db.session.delete(membership)
    db.session.flush()
    remaining = db.session.execute(
        db.select(GroupMembership).filter_by(group_id=group_id)
    ).scalars().all()
    if not remaining:
        db.session.delete(db.session.get(Group, group_id))
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Automation rules
# ---------------------------------------------------------------------------

def _job_id(rule_id: int) -> str:
    return f'automation_{rule_id}'


def _remove_scheduler_job(rule_id: int) -> None:
    job_id = _job_id(rule_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


def _schedule_rule(rule: AutomationRule) -> None:
    _remove_scheduler_job(rule.id)
    if not rule.enabled:
        return
    scheduler.add_job(
        _run_automation,
        'interval',
        seconds=rule.interval_seconds,
        id=_job_id(rule.id),
        args=[rule.id],
        replace_existing=True,
    )


def _run_automation(rule_id: int) -> None:
    from flask import current_app
    app = current_app._get_current_object()
    with app.app_context():
        rule = db.session.get(AutomationRule, rule_id)
        if not rule or not rule.enabled:
            return

        members = db.session.execute(
            db.select(GroupMembership).filter_by(group_id=rule.group_id)
        ).scalars().all()

        for m in members:
            contact = m.contact
            conn = node_manager.get_connection(contact.node_id)
            if not conn or not conn.is_connected:
                continue

            contact_dict = {
                'public_key': contact.public_key,
                'adv_name': contact.adv_name or '',
                'type': contact.contact_type,
                'out_path': contact.out_path or '',
            }

            async def _poll(mc, dst, rule_type):
                if rule_type == 'telemetry':
                    await mc.commands.send_telemetry_req(dst)
                else:
                    await mc.commands.send_statusreq(dst)

            try:
                node_manager.run_async(
                    _poll(conn.mc, contact_dict, rule.rule_type),
                    timeout=10,
                )
            except Exception:
                logger.exception('automation poll failed (rule=%d, contact=%d)', rule.id, contact.id)

        from datetime import datetime, timezone
        rule.last_run = datetime.now(timezone.utc)
        db.session.commit()


@groups_bp.get('/<int:group_id>/automations')
@require_auth
def list_automations(group_id: int):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    return jsonify([r.to_dict() for r in group.automation_rules])


@groups_bp.post('/<int:group_id>/automations')
@require_auth
def create_automation(group_id: int):
    group = db.session.get(Group, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    data = request.get_json(silent=True) or {}
    rule_type = data.get('rule_type', 'telemetry')
    if rule_type not in ('telemetry', 'status'):
        return jsonify({'error': 'rule_type must be "telemetry" or "status"'}), 422

    interval = max(60, int(data.get('interval_seconds', 300)))
    rule = AutomationRule(
        group_id=group_id,
        rule_type=rule_type,
        interval_seconds=interval,
        enabled=data.get('enabled', True),
    )
    db.session.add(rule)
    db.session.commit()
    _schedule_rule(rule)
    return jsonify(rule.to_dict()), 201


@groups_bp.put('/<int:group_id>/automations/<int:rule_id>')
@require_auth
def update_automation(group_id: int, rule_id: int):
    rule = db.session.execute(
        db.select(AutomationRule).filter_by(id=rule_id, group_id=group_id)
    ).scalar_one_or_none()
    if not rule:
        return jsonify({'error': 'Rule not found'}), 404

    data = request.get_json(silent=True) or {}
    if 'interval_seconds' in data:
        rule.interval_seconds = max(60, int(data['interval_seconds']))
    if 'enabled' in data:
        rule.enabled = bool(data['enabled'])
    if 'rule_type' in data and data['rule_type'] in ('telemetry', 'status'):
        rule.rule_type = data['rule_type']

    db.session.commit()
    _schedule_rule(rule)
    return jsonify(rule.to_dict())


@groups_bp.delete('/<int:group_id>/automations/<int:rule_id>')
@require_auth
def delete_automation(group_id: int, rule_id: int):
    rule = db.session.execute(
        db.select(AutomationRule).filter_by(id=rule_id, group_id=group_id)
    ).scalar_one_or_none()
    if not rule:
        return jsonify({'error': 'Rule not found'}), 404

    _remove_scheduler_job(rule.id)
    db.session.delete(rule)
    db.session.commit()
    return jsonify({'ok': True})
