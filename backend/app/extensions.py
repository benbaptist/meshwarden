from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy.orm import DeclarativeBase
from apscheduler.schedulers.background import BackgroundScheduler


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)
socketio = SocketIO()
limiter = Limiter(key_func=get_remote_address)
scheduler = BackgroundScheduler(timezone='UTC')
