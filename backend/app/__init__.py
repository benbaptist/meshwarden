import os
import hashlib
import subprocess
import logging
from flask import Flask, send_from_directory, abort, Response
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def _build_version() -> str:
    """Return a date-based version string derived from the latest git commit date.
    Format: YYYY.MM.DD[-NNNN] where NNNN is the commit count for that day (>1).
    Falls back to the static folder mtime if git is unavailable."""
    try:
        date_str = subprocess.check_output(
            ['git', 'log', '-1', '--format=%cd', '--date=short'],
            stderr=subprocess.DEVNULL,
            cwd=os.path.dirname(__file__),
        ).decode().strip()
        count_str = subprocess.check_output(
            ['git', 'log', '--after', f'{date_str} 00:00:00', '--before', f'{date_str} 23:59:59', '--format=%H'],
            stderr=subprocess.DEVNULL,
            cwd=os.path.dirname(__file__),
        ).decode().strip()
        count = len([l for l in count_str.splitlines() if l.strip()])
        version = date_str.replace('-', '.')
        if count > 1:
            version = f'{version}-{count:04d}'
        return version
    except Exception:
        pass
    # Fallback: use most recent static file mtime
    try:
        static_dir = os.path.join(os.path.dirname(__file__), '..', 'static')
        newest = max(
            os.path.getmtime(os.path.join(r, f))
            for r, _, files in os.walk(static_dir)
            for f in files
        )
        from datetime import datetime
        return datetime.fromtimestamp(newest).strftime('%Y.%m.%d')
    except Exception:
        return 'dev'


def _apply_migrations(db) -> None:
    """Add new columns to existing DB tables without Alembic."""
    with db.engine.connect() as conn:
        result = conn.execute(db.text('PRAGMA table_info(contacts)'))
        existing = {row[1] for row in result}
        for col_name, col_def in [
            ('last_heard', 'DATETIME'),
            ('favorite', 'BOOLEAN NOT NULL DEFAULT 0'),
        ]:
            if col_name not in existing:
                conn.execute(db.text(f'ALTER TABLE contacts ADD COLUMN {col_name} {col_def}'))
        conn.commit()


def create_app(config_name: str | None = None) -> Flask:
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')

    from .config import config
    from .extensions import db, socketio, limiter, scheduler

    app = Flask(__name__, static_folder='../static', static_url_path='/static')
    app.config.from_object(config[config_name])

    _version = _build_version()
    app.config['APP_VERSION'] = _version
    logger.info(f'MeshWarden {_version} starting up')

    db.init_app(app)
    socketio.init_app(
        app,
        cors_allowed_origins=app.config['ALLOWED_ORIGINS'],
        async_mode='threading',
        logger=False,
        engineio_logger=False,
    )
    limiter.init_app(app)

    with app.app_context():
        from .db import models  # noqa: F401 — registers models with SQLAlchemy
        db.create_all()
        _apply_migrations(db)

    from .node.manager import node_manager
    node_manager.start(app)

    if not scheduler.running:
        scheduler.start()

    from .auth.routes import auth_bp
    from .api.nodes import nodes_bp
    from .api.contacts import contacts_bp
    from .api.messages import messages_bp
    from .api.groups import groups_bp
    from .api.channels import channels_bp
    from .socket.handlers import register_handlers

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(nodes_bp, url_prefix='/api/nodes')
    app.register_blueprint(contacts_bp, url_prefix='/api/contacts')
    app.register_blueprint(messages_bp, url_prefix='/api/messages')
    app.register_blueprint(groups_bp, url_prefix='/api/groups')
    app.register_blueprint(channels_bp, url_prefix='/api/channels')
    register_handlers(socketio)

    # Version endpoint (unauthenticated — just a build label)
    @app.route('/api/version')
    def version():
        from flask import jsonify
        return jsonify({'version': app.config['APP_VERSION']})

    # Serve manifest + SW at root scope (required for PWA)
    @app.route('/manifest.json')
    def manifest():
        return send_from_directory(app.static_folder, 'manifest.json')

    # Compute a version string from static file mtimes so it changes on every deploy.
    def _static_version(static_dir: str) -> str:
        h = hashlib.md5()
        for root, _, files in os.walk(static_dir):
            for fname in sorted(files):
                fpath = os.path.join(root, fname)
                h.update(str(os.path.getmtime(fpath)).encode())
        return h.hexdigest()[:12]

    _cache_version = _static_version(app.static_folder)

    @app.route('/sw.js')
    def service_worker():
        with open(os.path.join(app.static_folder, 'sw.js')) as f:
            src = f.read()
        src = src.replace('__CACHE_VERSION__', _cache_version)
        resp = Response(src, mimetype='application/javascript')
        resp.headers['Cache-Control'] = 'no-cache'
        resp.headers['Service-Worker-Allowed'] = '/'
        return resp

    # SPA catch-all: any non-API, non-static path returns index.html
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def spa(path):
        if path.startswith(('api/', 'socket.io')):
            abort(404)
        static_file = os.path.join(app.static_folder, path)
        if path and os.path.isfile(static_file):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

    return app
