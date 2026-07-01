import os
import logging

# Configure logging before app creation
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)-22s] %(levelname)-8s %(message)s',
    datefmt='%H:%M:%S',
)
# Suppress noisy HTTP access logs (werkzeug, engineio, socketio)
logging.getLogger('werkzeug').setLevel(logging.WARNING)
logging.getLogger('meshcore').setLevel(logging.ERROR)
logging.getLogger('engineio.server').setLevel(logging.WARNING)
logging.getLogger('socketio.server').setLevel(logging.WARNING)

from app import create_app
from app.extensions import socketio

app = create_app(os.environ.get('FLASK_ENV', 'development'))

if __name__ == '__main__':
    socketio.run(
        app,
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=app.debug,
        use_reloader=False,
        allow_unsafe_werkzeug=True,
    )
