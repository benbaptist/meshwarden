from datetime import datetime, timezone

from flask import Blueprint, current_app, g, jsonify, make_response, request

from ..extensions import db, limiter
from ..db.models import AdminUser, RefreshToken
from .utils import (
    generate_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    require_auth,
    setup_complete,
    verify_password,
)

auth_bp = Blueprint('auth', __name__)

_REFRESH_COOKIE = 'meshwarden_refresh'


def _set_refresh_cookie(response, raw_token: str) -> None:
    is_prod = not current_app.debug
    response.set_cookie(
        _REFRESH_COOKIE,
        raw_token,
        httponly=True,
        secure=is_prod,
        samesite='Strict',
        max_age=int(current_app.config['JWT_REFRESH_EXPIRES'].total_seconds()),
        path='/api/auth',
    )


def _clear_refresh_cookie(response) -> None:
    response.delete_cookie(_REFRESH_COOKIE, path='/api/auth')


# ---------------------------------------------------------------------------
# GET /api/auth/status — check if setup has been done
# ---------------------------------------------------------------------------

@auth_bp.get('/status')
def status():
    return jsonify({'setup_complete': setup_complete()})


# ---------------------------------------------------------------------------
# POST /api/auth/setup — one-time admin account creation
# ---------------------------------------------------------------------------

@auth_bp.post('/setup')
@limiter.limit('5 per hour')
def setup():
    if setup_complete():
        return jsonify({'error': 'Setup already complete'}), 403

    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 422
    if len(password) < 12:
        return jsonify({'error': 'Password must be at least 12 characters'}), 422

    user = AdminUser(username=username, password_hash=hash_password(password))
    db.session.add(user)
    db.session.commit()

    access_token = generate_access_token(user.id)
    raw, token_hash = generate_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + current_app.config['JWT_REFRESH_EXPIRES'],
    )
    db.session.add(rt)
    db.session.commit()

    resp = make_response(jsonify({'access_token': access_token, 'user': user.to_dict()}))
    _set_refresh_cookie(resp, raw)
    return resp, 201


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------

@auth_bp.post('/login')
@limiter.limit('10 per minute')
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    user = db.session.execute(
        db.select(AdminUser).filter_by(username=username)
    ).scalar_one_or_none()

    # Always run verify to prevent timing attacks
    dummy_hash = '$2b$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    stored_hash = user.password_hash if user else dummy_hash
    if not verify_password(password, stored_hash) or not user:
        return jsonify({'error': 'Invalid credentials'}), 401

    access_token = generate_access_token(user.id)
    raw, token_hash = generate_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + current_app.config['JWT_REFRESH_EXPIRES'],
    )
    db.session.add(rt)
    db.session.commit()

    resp = make_response(jsonify({'access_token': access_token, 'user': user.to_dict()}))
    _set_refresh_cookie(resp, raw)
    return resp


# ---------------------------------------------------------------------------
# POST /api/auth/refresh — rotate refresh token, return new access token
# ---------------------------------------------------------------------------

@auth_bp.post('/refresh')
@limiter.limit('30 per minute')
def refresh():
    raw = request.cookies.get(_REFRESH_COOKIE)
    if not raw:
        return jsonify({'error': 'No refresh token'}), 401

    token_hash = hash_refresh_token(raw)
    now = datetime.now(timezone.utc)

    rt = db.session.execute(
        db.select(RefreshToken).filter_by(token_hash=token_hash, revoked=False)
    ).scalar_one_or_none()

    if not rt or rt.expires_at.replace(tzinfo=timezone.utc) < now:
        return jsonify({'error': 'Invalid or expired refresh token'}), 401

    # Rotate: revoke current, issue new
    rt.revoked = True

    new_raw, new_hash = generate_refresh_token()
    new_rt = RefreshToken(
        user_id=rt.user_id,
        token_hash=new_hash,
        expires_at=now + current_app.config['JWT_REFRESH_EXPIRES'],
    )
    db.session.add(new_rt)
    db.session.commit()

    access_token = generate_access_token(rt.user_id)
    user = db.session.get(AdminUser, rt.user_id)

    resp = make_response(jsonify({'access_token': access_token, 'user': user.to_dict()}))
    _set_refresh_cookie(resp, new_raw)
    return resp


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------

@auth_bp.post('/logout')
@require_auth
def logout():
    raw = request.cookies.get(_REFRESH_COOKIE)
    if raw:
        token_hash = hash_refresh_token(raw)
        rt = db.session.execute(
            db.select(RefreshToken).filter_by(token_hash=token_hash)
        ).scalar_one_or_none()
        if rt:
            rt.revoked = True
            db.session.commit()

    resp = make_response(jsonify({'ok': True}))
    _clear_refresh_cookie(resp)
    return resp


# ---------------------------------------------------------------------------
# PUT /api/auth/password — change admin password
# ---------------------------------------------------------------------------

@auth_bp.put('/password')
@require_auth
def change_password():
    data = request.get_json(silent=True) or {}
    current_pw = data.get('current_password') or ''
    new_pw = data.get('new_password') or ''

    if not verify_password(current_pw, g.current_user.password_hash):
        return jsonify({'error': 'Current password is incorrect'}), 403
    if len(new_pw) < 12:
        return jsonify({'error': 'Password must be at least 12 characters'}), 422

    g.current_user.password_hash = hash_password(new_pw)
    # Revoke all refresh tokens to force re-login everywhere
    db.session.execute(
        db.update(RefreshToken)
        .where(RefreshToken.user_id == g.current_user.id)
        .values(revoked=True)
    )
    db.session.commit()
    return jsonify({'ok': True})
