import os
from datetime import timedelta


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'CHANGE-ME-IN-PRODUCTION')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', 'sqlite:////data/meshwarden.db'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ACCESS_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_EXPIRES = timedelta(days=30)
    ALLOWED_ORIGINS = [
        o.strip()
        for o in os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5001,http://localhost:5000').split(',')
    ]
    RATELIMIT_STORAGE_URI = 'memory://'


class DevelopmentConfig(Config):
    DEBUG = True
    ALLOWED_ORIGINS = '*'


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
