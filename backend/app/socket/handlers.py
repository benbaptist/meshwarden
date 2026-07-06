from flask_socketio import emit, ConnectionRefusedError

from ..auth.utils import verify_access_token
from ..extensions import db


def register_handlers(socketio) -> None:

    @socketio.on('connect')
    def on_connect(auth):
        # Raise (instead of returning False) so the client receives a
        # distinguishable 'unauthorized' message and can refresh its JWT.
        token = (auth or {}).get('token', '')
        if not token:
            raise ConnectionRefusedError('unauthorized')

        from ..db.models import AdminUser
        payload = verify_access_token(token)
        if not payload:
            raise ConnectionRefusedError('unauthorized')

        user = db.session.get(AdminUser, int(payload['sub']))
        if not user:
            raise ConnectionRefusedError('unauthorized')

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
