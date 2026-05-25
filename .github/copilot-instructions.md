# MeshWarden — Copilot Instructions

## Project Overview

MeshWarden is a web-based dashboard for managing a MeshCore node and observing the mesh network. It runs as a Docker container exposing a Flask web server with a Vue 3 SPA frontend. There is **no build step** — all JavaScript runs directly in the browser via native ES modules and CDN imports.

---

## Architecture

### Backend (Python / Flask)
- **Flask 3.x** with app factory pattern (`backend/app/__init__.py`).
- **Flask-SocketIO** (threading async_mode) for real-time events to the frontend.
- **Flask-SQLAlchemy 3.x + SQLite** (file: `/data/meshwarden.db`). Models use `DeclarativeBase`.
- **meshcore Python library** (`pip install meshcore>=2.3`): async API. Always use `MeshCore.create_tcp()` or `MeshCore.create_serial()`. Commands via `mc.commands.*`. Subscribe via `mc.subscribe(None, handler)`. Contacts cached as `mc.contacts` dict.
- **asyncio ↔ Flask bridge**: A single background thread owns the asyncio event loop. Flask routes call into async code via `asyncio.run_coroutine_threadsafe(coro, loop).result(timeout=30)`. Async event handlers call back into Flask/SocketIO via `loop.run_in_executor(None, fn)`.
- **APScheduler 3.x** (pinned `<4.0`): `BackgroundScheduler` for automation rules.
- **JWT auth**: PyJWT HS256. 15-minute access tokens in `Authorization: Bearer` header. 30-day httpOnly `SameSite=Strict` refresh cookie with rotation. Refresh tokens stored as SHA-256 hashes in DB. bcrypt work factor 12.
- **Flask-Talisman** for security headers. **Flask-Limiter** for rate limiting auth endpoints.
- Blueprints: `auth`, `api`, `socket_handlers`. All registered in the app factory.

### Frontend (Vue 3 / No Build Step)
- **Vue 3.5.13** full ESM build via CDN importmap (see `backend/static/index.html`).
- **Pinia 2.3.1** for state management. **Vue Router 4.5.0** for SPA routing.
- **No npm, no Vite, no TypeScript, no build tooling.** All imports are via importmap or direct `./relative/path.js` in JS modules.
- Components are defined with `defineComponent({ template: \`...\` })` — template strings, not `.vue` SFC files.
- Socket.IO 4.7.5 and ApexCharts 3.49.0 are loaded as global `<script>` tags (not importmap).

### CDN Importmap (index.html — do not break)
```json
{
  "vue": "https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.esm-browser.prod.js",
  "vue-router": "https://cdn.jsdelivr.net/npm/vue-router@4.5.0/dist/vue-router.esm-browser.prod.js",
  "vue-demi": "https://cdn.jsdelivr.net/npm/vue-demi@0.14.10/lib/v3/index.mjs",
  "@vue/devtools-api": "/static/js/devtools-api-stub.js",
  "pinia": "https://cdn.jsdelivr.net/npm/pinia@2.3.1/dist/pinia.esm-browser.js"
}
```
- `vue-router` **must** use `.prod.js` — the dev build tries to import `@vue/devtools-api` which is stubbed.
- `pinia` has no prod ESM build; use the default `esm-browser.js` with the devtools-api stub.
- **Never add CDN URLs as bare specifiers** without adding them to the importmap first.
- **Leaflet 1.9.4** and **ApexCharts 3.49.0** are loaded as global `<script>` tags (not importmap). Access as `window.L` and `window.ApexCharts`.

---

## File Structure

```
backend/
  app/
    __init__.py          # App factory
    models.py            # SQLAlchemy models (DB is at backend/app/db/models.py)
    auth/                # JWT auth blueprint
    api/                 # REST API blueprints (nodes, contacts, groups, messages, etc.)
    node/                # meshcore connection + asyncio loop management
    socket/              # SocketIO event handlers
  static/
    index.html           # SPA entry — importmap + Tailwind CDN + Leaflet + global scripts
    js/
      app.js             # Vue app bootstrap — creates app, registers globals, mounts
      router.js          # Vue Router routes (6 routes: /setup, /login, /, /contacts, /contacts/:id, /settings)
      stores/            # Pinia stores (auth, nodes, contacts, messages, groups)
      views/             # Page-level Vue components
      components/
        layout/          # AppShell, Sidebar, BottomNav, NodeSwitcher
        shared/          # Icon, Logo, Modal, Toast, Spinner, ConfirmDialog, SignalBadge
        contacts/        # SignalBadge subcomponent
    icons/               # SVG app icons
    manifest.json        # PWA manifest
data/                    # SQLite DB (gitignored, Docker volume)
docker-compose.yml
Dockerfile
.env.example
requirements.txt
```

---

## Global Vue Components

These are registered globally in `app.js` and available in every template without import:

| Component      | Usage |
|----------------|-------|
| `<Icon>`       | `<Icon name="map" :size="20" />` — Heroicons v2 outline. See `components/shared/Icon.js` for all valid `name` values. |
| `<Logo>`       | `<Logo :size="32" />` — MeshWarden hexagon logo mark. |
| `<Modal>`      | Wrapper for overlay dialogs. |
| `<AppToast>`   | Global toast notification outlet. |
| `<Spinner>`    | Loading indicator. |
| `<ConfirmDialog>` | Destructive-action confirmation prompt. |
| `<SignalBadge>` | Displays SNR/RSSI signal quality badge. |

`<BottomNav>` and `<NodeSwitcher>` are imported locally in `AppShell.js` and `Sidebar.js` — not globally registered.

**Never use emojis in the UI.** All iconography must use the `<Icon>` component (Heroicons v2 outline, MIT license). The full icon lookup table is in `components/shared/Icon.js`. If you need a new icon, add its Heroicons v2 outline path there.

---

## Design System — 2026 Glassmorphic Dark Theme

### Color palette (Tailwind custom `surface` scale + violet accent)
- **Background**: `app-bg` CSS class — radial gradient (`#09090f` base, violet glow at top).
- **Surface scale**: `surface-950: #09090f`, `surface-900: #0f0f18`, `surface-800: #17172a`, `surface-700: #1f1f35`
- **Primary accent**: violet — `#7c3aed` → `#9333ea` gradient. Use for CTAs, active states, badges.
- **Secondary accents**: cyan (`#22d3ee`) for connected nodes; amber (`#f59e0b`) for rooms; emerald (`#34d399`) for sensors; rose for destructive actions.
- **Text**: `zinc-100` (primary), `zinc-400` (secondary), `zinc-600` (muted/placeholder).
- **Borders**: `rgba(255,255,255,0.06)` to `rgba(255,255,255,0.1)` — never solid gray.

### Glass utility
The `.glass` CSS class (defined in `index.html`):
```css
background: rgba(255,255,255,0.04);
backdrop-filter: blur(20px);
border: 1px solid rgba(255,255,255,0.08);
```
Use on cards, panels, dropdowns — anything that floats over the background.

### Input fields
```html
<input
  class="w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none"
  style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);"
/>
```

### Primary button
```html
<button style="background: linear-gradient(135deg, #7c3aed, #9333ea);" class="rounded-xl text-white font-semibold">
```

### Active nav state (sidebar)
```
bg-violet-500/15 text-violet-300 border border-violet-500/20 shadow-[0_0_12px_rgba(139,92,246,0.1)]
```

---

## Code Style

Follow **KISS, DRY, SOLID** strictly:
- One responsibility per module. No helper abstractions for one-off operations.
- No error handling for impossible cases. Only validate at system boundaries (API inputs, auth).
- No docstrings or comments on existing code unless you're documenting non-obvious behaviour.
- Trust other parts of the codebase. If the API returns a known schema, use it directly — no defensive fallbacks.
- No feature additions beyond what was requested.

---

## Security Requirements (OWASP Top 10)

- All auth endpoints are rate-limited via Flask-Limiter.
- Passwords hashed with bcrypt factor 12. Never store plaintext.
- JWT access tokens: 15-min expiry, HS256. Refresh tokens: 30-day expiry, httpOnly cookie, rotated on each use, stored as SHA-256 hash.
- All user-supplied input to database queries must go through SQLAlchemy ORM (parameterised). Never raw SQL string interpolation.
- CORS origins controlled by `ALLOWED_ORIGINS` env var. Flask-Talisman sets security headers.
- `SECRET_KEY` must be set via environment variable in production.
- Never log tokens, passwords, or sensitive data.

---

## Frontend Patterns

### Component definition
```js
import { defineComponent, ref, computed } from 'vue'

export default defineComponent({
  name: 'MyComponent',
  props: { ... },
  setup(props) {
    // reactive state and logic
    return { ... }
  },
  template: `<div>...</div>`,
})
```

### Using stores in components
```js
import { useAuthStore } from '../../stores/auth.js'
// inside setup():
const auth = useAuthStore()
```

### SocketIO (frontend)
`window.socket` is the global Socket.IO client. Use `socket.on('event', handler)` to subscribe. Clean up with `socket.off('event', handler)` in `onUnmounted`.

### API calls
Use `fetch('/api/...')` with `Authorization: Bearer ${auth.token}` header. The auth store handles token refresh automatically via an axios interceptor — but the project uses raw `fetch`. Refresh by calling `auth.refresh()` on 401 responses.

---

## Responsive / Mobile Layout

The app uses a **mobile-first flexbox column** layout (no fixed positioning for the main shell):

```
<div class="h-full flex flex-col">        ← AppShell root
  <header class="md:hidden ...">           ← Mobile header (logo + NodeSwitcher compact), h-12
  <div class="flex flex-1 min-h-0">        ← Content row
    <Sidebar class="hidden md:flex" />      ← Desktop sidebar, w-56
    <main class="flex-1 overflow-y-auto">  ← Main content
  </div>
  <BottomNav class="md:hidden" />          ← Mobile bottom nav
</div>
```

- **Mobile** (<md): header + main + bottom nav stacked vertically. No sidebar.
- **Desktop** (md+): sidebar left + main right. No header or bottom nav.
- Bottom nav: `padding-bottom: env(safe-area-inset-bottom, 0)` for iOS safe areas.

### Navigation structure
3 tabs: **Map** (`/`), **Contacts** (`/contacts`), **Settings** (`/settings`).
Node management lives inside Settings. No separate Nodes, Chat, Groups, or Dashboard routes.

### View layout patterns
- **Full-height views** (Map, Contacts, ContactDetail): `h-full flex flex-col` root. Scrollable section uses `flex-1 overflow-y-auto`. Map uses `h-full relative` with Leaflet filling `absolute inset-0`.
- **Scrolling views** (Settings): `px-4 pt-6 pb-20 max-w-xl mx-auto` root. Main scrolls naturally.
- **ContactDetail (mobile tabs)**: Chat (default) / Info / Activity. Desktop: Info panel (fixed 288px left) + Chat (flex-1 right) always visible side by side.
- **Tab visibility pattern**: `:class="activeTab !== 'chat' ? 'hidden md:flex' : 'flex'"` — `md:flex` overrides `hidden` at ≥768px.
- **Lists** (Contacts): native-style rows, full-width tap targets (min-h `56px`). `border-b border-white/[0.04]` dividers. `active:bg-white/[0.04]` press feedback. No tables.

---

## Docker / Running Locally

```bash
cp .env.example .env
# edit .env: set SECRET_KEY, connection details
docker compose up --build
# App at http://localhost:5001
```

First run redirects to `/setup` to create the admin account.

---

## meshcore Library Patterns

```python
from meshcore import MeshCore

# Connect (async)
mc = await MeshCore.create_tcp(host, port)
# or
mc = await MeshCore.create_serial(port, baud)

# Subscribe to all events
mc.subscribe(None, handle_event)

# Access cached contacts
mc.contacts  # dict keyed by node address

# Send commands
await mc.commands.get_device_info()
await mc.commands.send_msg(contact, text)
await mc.commands.set_radio_params(...)
```

Event handler signature: `async def handle_event(event_type: str, data: dict)`.
