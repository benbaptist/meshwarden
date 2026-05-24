from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, String, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class AdminUser(db.Model):
    __tablename__ = 'admin_users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        'RefreshToken', back_populates='user', cascade='all, delete-orphan'
    )

    def to_dict(self) -> dict:
        return {'id': self.id, 'username': self.username}


class RefreshToken(db.Model):
    __tablename__ = 'refresh_tokens'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('admin_users.id'), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped[AdminUser] = relationship('AdminUser', back_populates='refresh_tokens')


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

class Node(db.Model):
    __tablename__ = 'nodes'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    connection_type: Mapped[str] = mapped_column(String(8), nullable=False)  # 'tcp' | 'serial'
    host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    device_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    baud_rate: Mapped[int | None] = mapped_column(Integer, nullable=True, default=115200)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    self_info: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON blob

    contacts: Mapped[list[Contact]] = relationship(
        'Contact', back_populates='node', cascade='all, delete-orphan'
    )
    messages: Mapped[list[Message]] = relationship(
        'Message', back_populates='node', cascade='all, delete-orphan'
    )
    telemetry: Mapped[list[TelemetryRecord]] = relationship(
        'TelemetryRecord', back_populates='node', cascade='all, delete-orphan'
    )

    def get_self_info(self) -> dict:
        if self.self_info:
            try:
                return json.loads(self.self_info)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    def set_self_info(self, data: dict) -> None:
        self.self_info = json.dumps(data)

    def to_dict(self, include_self_info: bool = False) -> dict:
        d: dict[str, Any] = {
            'id': self.id,
            'name': self.name,
            'connection_type': self.connection_type,
            'host': self.host,
            'port': self.port,
            'device_path': self.device_path,
            'baud_rate': self.baud_rate,
            'enabled': self.enabled,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
        }
        if include_self_info:
            d['self_info'] = self.get_self_info()
        return d


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------

class Contact(db.Model):
    __tablename__ = 'contacts'
    __table_args__ = (UniqueConstraint('node_id', 'public_key'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    node_id: Mapped[int] = mapped_column(ForeignKey('nodes.id'), nullable=False)
    public_key: Mapped[str] = mapped_column(String(64), nullable=False)
    adv_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    contact_type: Mapped[int] = mapped_column(Integer, default=0)
    # 0=NONE 1=CLI 2=REP 3=ROOM 4=SENS
    last_advert: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    out_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    tags: Mapped[str] = mapped_column(Text, default='[]')   # JSON array of strings
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    node: Mapped[Node] = relationship('Node', back_populates='contacts')
    history: Mapped[list[ContactHistory]] = relationship(
        'ContactHistory', back_populates='contact', cascade='all, delete-orphan'
    )
    messages: Mapped[list[Message]] = relationship('Message', back_populates='contact')
    telemetry: Mapped[list[TelemetryRecord]] = relationship(
        'TelemetryRecord', back_populates='contact'
    )
    group_memberships: Mapped[list[GroupMembership]] = relationship(
        'GroupMembership', back_populates='contact', cascade='all, delete-orphan'
    )

    def get_tags(self) -> list:
        try:
            return json.loads(self.tags)
        except (json.JSONDecodeError, TypeError):
            return []

    def set_tags(self, tags: list) -> None:
        self.tags = json.dumps(tags)

    CONTACT_TYPES = {0: 'NONE', 1: 'CLI', 2: 'REP', 3: 'ROOM', 4: 'SENS'}

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'node_id': self.node_id,
            'public_key': self.public_key,
            'adv_name': self.adv_name,
            'contact_type': self.contact_type,
            'contact_type_name': self.CONTACT_TYPES.get(self.contact_type, 'NONE'),
            'last_advert': self.last_advert.isoformat() if self.last_advert else None,
            'lat': self.lat,
            'lon': self.lon,
            'out_path': self.out_path,
            'tags': self.get_tags(),
            'notes': self.notes,
        }


class ContactHistory(db.Model):
    __tablename__ = 'contact_history'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey('contacts.id'), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    field_name: Mapped[str] = mapped_column(String(64), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    contact: Mapped[Contact] = relationship('Contact', back_populates='history')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'contact_id': self.contact_id,
            'timestamp': self.timestamp.isoformat(),
            'field_name': self.field_name,
            'old_value': self.old_value,
            'new_value': self.new_value,
        }


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

class Message(db.Model):
    __tablename__ = 'messages'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    node_id: Mapped[int] = mapped_column(ForeignKey('nodes.id'), nullable=False)
    direction: Mapped[str] = mapped_column(String(3), nullable=False)   # 'in' | 'out'
    msg_type: Mapped[str] = mapped_column(String(8), nullable=False)    # 'direct' | 'channel'
    contact_id: Mapped[int | None] = mapped_column(ForeignKey('contacts.id'), nullable=True)
    channel_idx: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False, default='')
    txt_type: Mapped[int] = mapped_column(Integer, default=0)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    sender_timestamp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    snr: Mapped[float | None] = mapped_column(Float, nullable=True)
    rssi: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default='received')
    # 'received' | 'sending' | 'sent' | 'acked' | 'failed'
    expected_ack: Mapped[str | None] = mapped_column(String(16), nullable=True)

    node: Mapped[Node] = relationship('Node', back_populates='messages')
    contact: Mapped[Contact | None] = relationship('Contact', back_populates='messages')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'node_id': self.node_id,
            'direction': self.direction,
            'msg_type': self.msg_type,
            'contact_id': self.contact_id,
            'channel_idx': self.channel_idx,
            'text': self.text,
            'txt_type': self.txt_type,
            'timestamp': self.timestamp.isoformat(),
            'sender_timestamp': self.sender_timestamp,
            'snr': self.snr,
            'rssi': self.rssi,
            'status': self.status,
        }


# ---------------------------------------------------------------------------
# Telemetry
# ---------------------------------------------------------------------------

class TelemetryRecord(db.Model):
    __tablename__ = 'telemetry_records'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    node_id: Mapped[int] = mapped_column(ForeignKey('nodes.id'), nullable=False)
    contact_id: Mapped[int | None] = mapped_column(
        ForeignKey('contacts.id'), nullable=True
    )  # None = self-node telemetry
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    lpp_data: Mapped[str] = mapped_column(Text, default='{}')  # JSON

    node: Mapped[Node] = relationship('Node', back_populates='telemetry')
    contact: Mapped[Contact | None] = relationship('Contact', back_populates='telemetry')

    def get_lpp(self) -> dict:
        try:
            return json.loads(self.lpp_data)
        except (json.JSONDecodeError, TypeError):
            return {}

    def set_lpp(self, data: dict) -> None:
        self.lpp_data = json.dumps(data)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'node_id': self.node_id,
            'contact_id': self.contact_id,
            'timestamp': self.timestamp.isoformat(),
            'lpp_data': self.get_lpp(),
        }


# ---------------------------------------------------------------------------
# Groups & Automation
# ---------------------------------------------------------------------------

class Group(db.Model):
    __tablename__ = 'groups'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(7), default='#3B82F6')

    memberships: Mapped[list[GroupMembership]] = relationship(
        'GroupMembership', back_populates='group', cascade='all, delete-orphan'
    )
    automation_rules: Mapped[list[AutomationRule]] = relationship(
        'AutomationRule', back_populates='group', cascade='all, delete-orphan'
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'color': self.color,
            'member_count': len(self.memberships),
        }


class GroupMembership(db.Model):
    __tablename__ = 'group_memberships'
    __table_args__ = (UniqueConstraint('group_id', 'contact_id'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id'), nullable=False)
    contact_id: Mapped[int] = mapped_column(ForeignKey('contacts.id'), nullable=False)

    group: Mapped[Group] = relationship('Group', back_populates='memberships')
    contact: Mapped[Contact] = relationship('Contact', back_populates='group_memberships')


class AutomationRule(db.Model):
    __tablename__ = 'automation_rules'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id'), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(16), nullable=False)
    # 'telemetry' | 'status'
    interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    config: Mapped[str] = mapped_column(Text, default='{}')  # JSON

    group: Mapped[Group] = relationship('Group', back_populates='automation_rules')

    def get_config(self) -> dict:
        try:
            return json.loads(self.config)
        except (json.JSONDecodeError, TypeError):
            return {}

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'group_id': self.group_id,
            'rule_type': self.rule_type,
            'interval_seconds': self.interval_seconds,
            'enabled': self.enabled,
            'last_run': self.last_run.isoformat() if self.last_run else None,
            'config': self.get_config(),
        }
