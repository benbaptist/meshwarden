# MeshWarden

MeshWarden is a web-based dashboard for managing [MeshCore](https://github.com/attermann/meshcore) nodes. It gives you a single place to watch your mesh network in real time — seeing who's out there, how well you're hearing them, and what they're saying — while also letting you actively manage and automate interactions with contacts across one or more nodes.

MeshCore itself is a lean, efficient mesh protocol. It doesn't have opinions about how you organize your contacts or automate your network. MeshWarden layers that organization on top: you decide how to group contacts, what to poll, and how often.

## What it does

- **Multi-node management** — connect to multiple MeshCore nodes simultaneously over TCP or USB/serial. Useful if you're running a network of infrastructure nodes or monitoring several sites from one dashboard.
- **Real-time contact tracking** — see contacts as they advertise themselves on the mesh, with signal quality (SNR/RSSI) and advertisement history so you can understand how reliably you're hearing each one.
- **Messaging** — send and receive direct messages and channel messages, with delivery acknowledgement so you know when a message actually reached its destination.
- **Telemetry** — poll contacts for device telemetry (battery, environment, etc.) and browse their history over time.
- **Groups** — MeshCore has no concept of grouping contacts, but in practice you often want to treat a set of nodes as a logical unit: a site, a team, a cluster of sensors. Groups in MeshWarden let you do that. You can assign contacts to a group and configure automation rules — like "poll telemetry for every contact in this group every 10 minutes" — rather than managing each contact individually.
- **Installable as a PWA** — works in your browser and can be installed to your home screen or desktop for quick access.

## Quick Start

```bash
cp .env.example .env
# Edit .env — at minimum set a strong SECRET_KEY
docker compose up --build
```

Open `http://localhost:5001` and complete the setup wizard to create your admin account.

## Running Without Docker

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env  # edit as needed
python run.py
```

Requires Python 3.11+.

## Configuration

All configuration is via environment variables (`.env` file):

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `CHANGE-ME-IN-PRODUCTION` | Secret key for session signing — **change this** |
| `DATABASE_URL` | `sqlite:////data/meshwarden.db` | Database location |
| `ALLOWED_ORIGINS` | `http://localhost:5000` | Comma-separated allowed origins for CORS |
| `FLASK_ENV` | `production` | `development` or `production` |
| `PORT` | `5000` | Port the server listens on |

## Serial Devices in Docker

To expose a USB/serial device to the container, uncomment the `devices` section in `docker-compose.yml`:

```yaml
devices:
  - /dev/ttyUSB0:/dev/ttyUSB0
```

## License

MIT
