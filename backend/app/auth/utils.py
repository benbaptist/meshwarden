import hashlib
import secrets
from datetime import datetime, timezone
from functools import wraps

import bcrypt
import jwt
from flask import current_app, g, jsonify, request

from ..extensions import db


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# JWT access tokens
# ---------------------------------------------------------------------------

def generate_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        'sub': str(user_id),
        'iat': now,
        'exp': now + current_app.config['JWT_ACCESS_EXPIRES'],
        'type': 'access',
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def verify_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token,
            current_app.config['SECRET_KEY'],
            algorithms=['HS256'],
        )
        if payload.get('type') != 'access':
            return None
        return payload
    except jwt.PyJWTError:
        return None


# ---------------------------------------------------------------------------
# Refresh tokens (DB-backed, rotation pattern)
# ---------------------------------------------------------------------------

def generate_refresh_token() -> tuple[str, str]:
    """Return (raw_token, token_hash). Store hash; send raw to client."""
    raw = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, token_hash


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Auth decorator
# ---------------------------------------------------------------------------

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing authorization token'}), 401
        token = auth_header[7:]
        payload = verify_access_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401

        from ..db.models import AdminUser
        user = db.session.get(AdminUser, int(payload['sub']))
        if not user:
            return jsonify({'error': 'User not found'}), 401

        g.current_user = user
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Setup guard
# ---------------------------------------------------------------------------

def setup_complete() -> bool:
    from ..db.models import AdminUser
    return db.session.execute(db.select(AdminUser)).first() is not None
