import os
from datetime import timedelta

# Optional comma-separated origin allowlist for Socket.IO CORS.
# Empty → None: engine.io then only accepts same-origin requests, which
# matches any host/port the dashboard is actually served on (localhost,
# LAN IP, reverse proxy) without needing configuration.
_origins = [
    o.strip()
    for o in os.environ.get('ALLOWED_ORIGINS', '').split(',')
    if o.strip()
]


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'CHANGE-ME-IN-PRODUCTION')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', 'sqlite:////data/meshwarden.db'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ACCESS_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_EXPIRES = timedelta(days=30)
    ALLOWED_ORIGINS = _origins or None
    RATELIMIT_STORAGE_URI = 'memory://'


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Strict'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
