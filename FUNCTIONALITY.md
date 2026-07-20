# MeshWarden — Functionality Overview

This document describes the current, implemented functionality of MeshWarden as of 2026-07-20 (backend `app` package + Vue frontend under `backend/static/js`). It reflects what's actually wired up and reachable, not aspirational features (see [TODO.md](TODO.md) for planned work).

---

## 1. Authentication & Account

- **First-run setup wizard** (`/setup`) — creates the single admin account (username ≥3 chars, password ≥12 chars) with a live password-strength meter. Blocked once an account exists.
- **Login** (`/login`) with rate limiting (10/min).
- **JWT access tokens** (15-minute expiry, HS256) returned to the client and held in memory/localStorage.
- **Refresh tokens** — 30-day httpOnly, `SameSite=Strict` cookie scoped to `/api/auth`, rotated on every refresh, stored server-side as SHA-256 hashes, revocable.
- **Automatic token refresh** on 401 / Socket.IO `connect_error`.
- **Change password** (from Settings) — requires current password, revokes all outstanding refresh tokens (forces re-login everywhere).
- **Logout** — revokes the current refresh token and clears the cookie.
- Passwords hashed with bcrypt (work factor 12). All auth endpoints rate-limited via Flask-Limiter.

## 2. Multi-Node Management

- Add/edit/delete **MeshCore nodes**, each connected via:
  - **TCP** (host + port), or
  - **Serial/USB** (device path + baud rate).
- Per-node **connect / disconnect** control, with live connected/disconnected status shown throughout the UI.
- **Active node** concept — a node switcher (in the sidebar / mobile header) lets you pick which node's contacts/channels/map you're viewing; state persists across views.
- **Sync/reload** — re-pulls contacts from a connected node on demand.
- **Send advertisement** — zero-hop or flood advert broadcast from a node.
- **Export "My Info"** — fetches the node's own `meshcore://` contact URI and renders it as a QR code for pairing with other apps/devices.
- **Live stats** — battery voltage, uptime, radio noise floor, last RSSI/SNR, packet RX/TX counts, error counts (fetched from device on demand via `get_stats_core/radio/packets` + `get_bat`).
- **Radio/device config push** — change device name, LoRa frequency/bandwidth/spreading factor/coding rate, and TX power directly from the dashboard (guarded with an on-screen warning about disconnecting from the mesh).
- Node identity display: advertised name, public key prefix, current radio parameters.

## 3. Contacts

- **Real-time contact discovery** — new contacts and re-advertisements from the mesh are written to the DB and pushed to the browser instantly via Socket.IO (no polling).
- Contact list with:
  - Search by name.
  - Filter by active node.
  - Sort by favorite-first, then most-recently-heard.
  - Unread message badges per contact.
  - Type badges (Client / Repeater / Room / Sensor / Unknown) with distinct colors.
- **Favorites** — star/unstar any contact.
- **Notes** — free-text notes per contact (persisted, 4096-char cap).
- **Contact history** — tracked field changes over time (name, lat/lon).
- **Signal history** — SNR/RSSI over time for a contact, charted.
- **Zero-hop ping** — sends a status request and measures round-trip latency; results are logged as `PingRecord`s and shown in a history list.
- **Routing path management**:
  - View the current multi-hop out-path, decoded hop-by-hop into 4-byte hex segments, with matching known contacts resolved by public-key prefix where possible.
  - **Reset path** (fall back to flood routing).
  - **Manually set a path** (arbitrary hex hop sequence).
- **Telemetry**:
  - Request telemetry from repeaters/sensors (optionally authenticating with a password first).
  - Telemetry history browsing with typed field rendering (temperature, humidity, pressure, voltage/battery, altitude, lat/lon, uptime, RSSI/SNR, TX power, luminosity, power, noise floor) and graceful fallback for unknown LPP fields.
- **Repeater/room admin console** (for `REP` contacts):
  - **Login/logout** with a password (repeater admin auth), tracked client-side as a session state.
  - **Request status** (uptime, radio stats, errors) and **ACL** from the repeater.
  - **Raw CLI command** passthrough (`send_cmd`) with response history shown as a terminal-style log.
  - Structured **get/set** helpers for common device settings (name, TX power, frequency, bandwidth, spreading factor, coding rate).
- **Group membership** — add/remove a contact to/from groups directly from the contact detail page, including inline "create group and add" when typing a new group name.
- **Direct messaging** — full chat thread per contact (see Messaging below).

## 4. Messaging

- **Direct messages** to any contact and **channel messages** to any channel slot.
- Persisted message history (paginated, 50/page) with direction (`in`/`out`), text, SNR/RSSI, hop count, sender timestamp.
- **Delivery status tracking**: `sending` → `sent` (seen by mesh, matched via `expected_ack`) → `acked` (confirmed by recipient) or `failed`.
- **Real-time delivery**: incoming messages and ack/status updates are pushed over Socket.IO the moment they're received from the mesh — no polling required.
- **Unread counters** per conversation (per-contact and per-channel), shown as badges in navigation.
- Chat UI groups conversations by contact and by channel, auto-scrolls to latest message, and reverse-chronological pagination.

## 5. Channels

- **List all configured channel slots** on a node (reads every hardware slot via `get_channel`, showing only occupied ones).
- **Join/create a channel**:
  - **Public** — the well-known pre-shared "Public" channel (fixed PSK baked into firmware).
  - **Hashtag channel** (`#name`) — key auto-derived as `sha256(name)[:16]` by the meshcore library; no manual secret needed.
  - **Private channel** — either supply a 16-byte base64 PSK or auto-generate a new random one; the generated key is displayed once so it can be shared out-of-band with other participants.
- **Copy channel key** to clipboard.
- **Leave/remove a channel** (clears the slot with a blank name + all-zero key).
- Detects and prevents duplicate channel names and reports "no free slots" when the device's channel table is full.
- Per-channel chat thread with unread badges and last-message preview in the channel list.

## 6. Groups & Automation

*(Backend fully implemented; group **membership** is manageable from Contact Detail. Standalone group management/automation UI exists in the codebase but is not currently wired into navigation.)*

- **Groups** — logical collections of contacts across one or more nodes, with name, description, and color.
- **Membership management** — add/remove contacts; a group with zero remaining members is auto-deleted.
- **Automation rules** per group:
  - `telemetry` — periodically request telemetry from every member.
  - `status` — periodically zero-hop ping/status-request every member.
  - Configurable interval (minimum 60s), enable/disable toggle, `last_run` tracking.
  - Backed by APScheduler background jobs (one job per rule), created/updated/removed as rules change.

## 7. Map

- Interactive **Leaflet** map (dark CARTO basemap) plotting all contacts with known GPS coordinates for the active node.
- Color-coded markers by contact type (Client/Repeater/Room/Sensor).
- Marker popups with contact name and type.
- Auto-fit bounds on first load of geo-tagged contacts; live marker add/update/remove as contact positions change.
- Onboarding hints when no nodes are configured or no contacts have GPS data yet.

## 8. Real-Time Updates (Socket.IO)

- JWT-authenticated Socket.IO connection (token passed in the `connect` handshake; rejected connections trigger a client-side token refresh).
- Events pushed to all authenticated clients:
  - `nodes:status_snapshot` — connection status of every node, sent on connect.
  - `message:received`, `message:ack` — new inbound messages and delivery-status transitions.
  - `contact:new`, `contact:updated` — new contact discovery and advertisement updates.
  - Telemetry, admin status/ACL, and login success/failure events consumed by the Contact Detail admin console.
- No polling anywhere in the frontend for live mesh activity.

## 9. Progressive Web App

- Installable to home screen/desktop (manifest + service worker).
- Works fully client-side via native ES modules — **no build step**, no bundler.
- Offline-state detection (`/offline` route) with retry-connection flow if the backend becomes unreachable.

## 10. Security

- All mutating API routes require a valid JWT (`@require_auth`).
- Flask-Talisman security headers; CORS restricted to `ALLOWED_ORIGINS`.
- All database access via SQLAlchemy ORM (no raw SQL interpolation).
- Auth endpoints rate-limited (setup: 5/hr, login: 10/min, refresh: 30/min).
- Refresh tokens never stored in plaintext; only their SHA-256 hash is persisted.
- No secrets/tokens ever logged.

## 11. Operational / Deployment

- Single Docker container: Flask + Flask-SocketIO (threading async mode) serving both the API and the static SPA.
- SQLite database with lightweight in-process migrations (ad hoc `ALTER TABLE` on startup — no Alembic).
- Auto-computed app version string derived from the latest git commit date (shown in the sidebar).
- Serial/USB device passthrough supported via Docker `devices:` mapping.
- Configurable entirely through environment variables (`SECRET_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS`, `FLASK_ENV`, `PORT`).
