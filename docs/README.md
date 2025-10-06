# SoulTribe.chat API

FastAPI backend for SoulTribe.chat with Postgres, Alembic migrations, and a static dashboard UI.

## Quickstart

1) Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2) Install dependencies

```bash
pip install -r requirements.txt
```

3) Configure database (Postgres only)

Set `DATABASE_URL` (or put it in `.env`). Example:

```bash
export DATABASE_URL="postgresql+psycopg2://soultribe:pass@127.0.0.1:5432/soultribe"
```

4) Initialize/upgrade DB schema (Alembic)

```bash
alembic upgrade head
```

5) Run the API (Gunicorn, reload)

```bash
make dev
# serves on http://127.0.0.1:8001/
```

6) Health check

```bash
curl -s http://127.0.0.1:8001/api/health
```

## Systemd Services

- System-wide (root-controlled): copy `dev/soultribe-gunicorn.service` to `/etc/systemd/system/soultribe-gunicorn@.service`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable soultribe-gunicorn@<your-user>
sudo systemctl start soultribe-gunicorn@<your-user>
```

- User-level (no sudo):

```bash
mkdir -p ~/.config/systemd/user
cp dev/soultribe-gunicorn.user.service ~/.config/systemd/user/soultribe-gunicorn.service
systemctl --user daemon-reload
systemctl --user enable soultribe-gunicorn
systemctl --user start soultribe-gunicorn
```

## Endpoints (Summary)

- `GET /api/health` → `{ "ok": true }`
- Auth (`routes/auth.py`): `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/verify`
- Profile (`routes/profile.py`): `PUT /api/profile`, `GET /api/profile/radix`, `POST /api/profile/interpret`
- Availability (`routes/availability.py`): `GET /api/availability`, `POST /api/availability`, `PATCH /api/availability/{slot_id}`, `DELETE /api/availability/{slot_id}`
- Match (`routes/match.py`): `POST /api/match/find`, `POST /api/match/create`, `POST /api/match/annotate`, `POST /api/match/score`
- Meetup (`routes/meetup.py`): `POST /api/meetup/propose`, `POST /api/meetup/confirm`, `POST /api/meetup/unconfirm`, `POST /api/meetup/cancel`, `GET /api/meetup/list`

## Frontend Highlights (2025-09-16)

### Timezone Support
- Full timezone awareness with local time display and storage
- All times shown with appropriate timezone indicators

### Dashboard Improvements
- Simplified Matches interface:
  - Uses fixed defaults (`min_score`=50, `lookahead_days`=3, `max_overlaps`=5)
  - Always uses the logged-in user automatically (no user id input)
  - Renders only candidates with at least one overlap
- Overlap chips show three columns (UTC • you • other) with date, time, duration; a "Propose this time" button creates a match (if needed) and proposes a meetup at that time.
### Meetup Flow
- Proposer cannot confirm their own meetup (403)
- Only the confirmer can unconfirm (403)
- Either side can cancel
- Simplified meetup card UI with cleaner action buttons
- Removed redundant status text (relying on badges instead)
### Backend
### Availability UI
- Date, start, and end in a single row on desktop (mobile reflows to one column)
- Same‑day enforcement when creating slots
- Edit existing slots via PATCH (hour-aligned, ≥1h, future-only)
- Timezone-aware scheduling with local time display
- Toasts are center‑bottom, high‑contrast, and click‑to‑dismiss.

## Frontend

The frontend lives under `web/` and is bundled as static files served by FastAPI's `StaticFiles` at `/`.

### CSS structure (2025-09-14)

We reorganized CSS to improve maintainability. Summary:

- `web/theme.css` — global theme and dark-mode overrides; topbar/footer styles
- `web/styles.css` — shared utilities only (no page-specific rules)
- Page CSS
  - `web/index.css` (landing/welcome)
  - `web/dashboard.css` (dashboard-only UI)
  - `web/profile.css` (profile-only UI: Radix, language/tag UI, autocomplete)
  - `web/login.css` (login/register)
  - `web/admin/stats.css`, `web/admin/dev.css` (admin pages)

Load order in pages:

```
<link rel="stylesheet" href="/theme.css" />
<link rel="stylesheet" href="/styles.css" />
<link rel="stylesheet" href="/<page>.css" />
<link rel="stylesheet" href="/mobile.css" />
```

Details: see `docs/styles.md`.

### Admin pages

Admin pages are now under `web/admin/`:

- `/admin/stats.html` — stats dashboard, guarded by `/api/admin/ping`
- `/admin/dev.html` — dev console, guarded by `/api/admin/ping`

Topbars show an Admin button only for admins/localhost.

### Landing page

The canonical landing page is `index.html` (previously `welcome.html`).
`welcome.html` has been removed; `index.html` renders the welcome content and loads `index.css`.

## Project Structure

- `main.py` — FastAPI app factory and app instance; mounts static `web/` at `/`.
- `db.py` — SQLModel engine/session helpers.
- `models.py` — SQLModel tables.
- `schemas.py` — Pydantic request/response models.
- `routes/` — Feature routers: `auth.py`, `profile.py`, `availability.py`, `match.py`, `meetup.py`.
- `services/` — Services for availability, jitsi, jwt, etc.
- `alembic/` — Alembic config and versioned migrations.
- `web/` — Static UI (dashboard, login, welcome).

## Notes

- Postgres-only. SQLite is removed.
- Migrations use Alembic; no boot-time schema hacks.
- Server runs on port 8001 (Gunicorn with Uvicorn workers). Open `http://127.0.0.1:8001/`.

## Operating the service

Common commands:

- User-level service (no sudo):

```bash
systemctl --user restart soultribe-gunicorn
systemctl --user status --no-pager soultribe-gunicorn
journalctl --user -u soultribe-gunicorn -f
```

- System service (replace <your-user>):

```bash
sudo systemctl restart soultribe-gunicorn@<your-user>
sudo systemctl status --no-pager soultribe-gunicorn@<your-user>
sudo journalctl -u soultribe-gunicorn@<your-user> -f
```

- DB migrations:

```bash
.venv/bin/alembic upgrade head
```

- Local dev:

```bash
make dev
```
