# MeshWarden

Web-based management UI for [MeshCore](https://github.com/attermann/meshcore) nodes. Connects to one or more nodes over TCP or serial, displays mesh contacts and messages in real time, and lets you send messages and poll telemetry.

## Features

- Multi-node support (TCP and serial/USB connections)
- Real-time contact tracking and advertisement history
- Direct and channel messaging with delivery acknowledgement
- Telemetry polling with per-contact history
- Contact grouping with scheduled automation rules (telemetry/status polls)
- Signal quality tracking (SNR/RSSI) per contact
- Single admin account with JWT auth and refresh token rotation
- Progressive Web App (installable, service worker cache)

## Requirements

- Docker and Docker Compose, **or** Python 3.11+ with pip

## Quick Start

```bash
cp .env.example .env
# Edit .env and set a strong SECRET_KEY
docker compose up --build
```

Open `http://localhost:5001` and complete the setup wizard to create the admin account.

Data is persisted in `./data/meshwarden.db`.

## Running Without Docker

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env  # edit as needed
python run.py
```

## Configuration

All configuration is via environment variables (`.env` file):

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `CHANGE-ME-IN-PRODUCTION` | Flask secret key — change this |
| `DATABASE_URL` | `sqlite:////data/meshwarden.db` | SQLAlchemy database URL |
| `ALLOWED_ORIGINS` | `http://localhost:5000` | Comma-separated allowed CORS origins |
| `FLASK_ENV` | `production` | `development` or `production` |
| `PORT` | `5000` | Port the server listens on |

## Serial Devices in Docker

To expose a serial/USB device to the container, uncomment the `devices` section in `docker-compose.yml`:

```yaml
devices:
  - /dev/ttyUSB0:/dev/ttyUSB0
```

## Architecture

- **Backend**: Python/Flask 3, Flask-SocketIO (threading mode), SQLAlchemy + SQLite
- **MeshCore**: [`meshcore`](https://pypi.org/project/meshcore/) Python library; async operations run on a dedicated event loop thread bridged to Flask via `run_coroutine_threadsafe`
- **Frontend**: Vue 3.5 + Vue Router 4 + Pinia — no build step, loaded via importmap from CDN. All component logic lives in plain `.js` ES module files under `backend/static/js/`
- **Auth**: bcrypt password hashing, HS256 JWT access tokens (15 min), rotating httpOnly refresh cookies (30 days)
- **Automation**: APScheduler 3.x background scheduler for group-level telemetry/status polling rules

## License

MIT
