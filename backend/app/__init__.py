import os
from flask import Flask, send_from_directory, abort
from dotenv import load_dotenv

load_dotenv()


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

    # Serve manifest + SW at root scope (required for PWA)
    @app.route('/manifest.json')
    def manifest():
        return send_from_directory(app.static_folder, 'manifest.json')

    @app.route('/sw.js')
    def service_worker():
        resp = send_from_directory(app.static_folder, 'sw.js')
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
