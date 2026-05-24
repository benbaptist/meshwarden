from flask_socketio import emit

from ..auth.utils import verify_access_token
from ..extensions import db


def register_handlers(socketio) -> None:

    @socketio.on('connect')
    def on_connect(auth):
        token = (auth or {}).get('token', '')
        if not token:
            return False  # Reject unauthenticated connections

        from ..db.models import AdminUser
        payload = verify_access_token(token)
        if not payload:
            return False

        user = db.session.get(AdminUser, int(payload['sub']))
        if not user:
            return False

        # Send current node connection statuses on connect
        from ..node.manager import node_manager
        emit('nodes:status_snapshot', node_manager.connection_statuses())

    @socketio.on('disconnect')
    def on_disconnect():
        pass  # Cleanup handled by Flask-SocketIO

    @socketio.on('node:subscribe')
    def on_node_subscribe(data):
        """Client requests real-time events for a specific node."""
        # All events are broadcast to all authenticated clients.
        # Room-based filtering can be added later if needed.
        pass
