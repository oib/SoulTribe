# Admin Pages and Access

This document explains how to access and use the built‑in admin pages for SoulTribe.chat, and what is required for authorization.

## Admin Pages

- /admin/dev.html
  - Developer utilities (manual triggers, debug helpers).
- /admin/stats.html
  - High‑level statistics and recent activity.

These are static pages located under `web/admin/` and are served by the app’s static file server mounted at `/`.

## Correct URLs

When the app is running locally (see below), open these exact URLs in your browser:

- http://127.0.0.1:8001/admin/dev.html
- http://127.0.0.1:8001/admin/stats.html

If you visit `http://127.0.0.1:8001/dev.html` or `http://127.0.0.1:8001/dev/dev.html`, you will get `{"detail":"Not Found"}` because the admin pages are under the `/admin/` path.

## How the app serves static files

The FastAPI app mounts the `web/` folder to the site root in `main.py`:

```python
# main.py
app = create_app()
app.mount("/", StaticFiles(directory="web", html=True), name="web")
```

That means any file under `web/` is available at `/<relative-path>`. For example:
- `web/admin/dev.html` → `/admin/dev.html`
- `web/admin/stats.html` → `/admin/stats.html`

## Authorization requirements

The admin pages are static, but they call admin API endpoints under `/api/admin/*` which enforce authorization. The API checks admin status in `routes/admin.py` via `_is_admin()`:

- Localhost access is considered admin:
  - Requests from `127.0.0.1`, `::1`, or `localhost` are allowed.
- Alternatively, allowlisted user IDs via environment variable:
  - Set `ADMIN_USER_IDS` env var to a comma‑separated list of user IDs.
  - Example: `ADMIN_USER_IDS=1,2,42`

If you are not accessing from localhost and your user ID is not allowlisted, the admin API will return `403 Admin only` and the admin pages will not function.

### Finding your user ID

After registering/logging in, your user id may be visible in various API responses or admin pages. Alternatively, query the database directly or add temporary logging.

## Running the app locally

There are multiple ways to run locally. For example, with uvicorn (see `dev/soultribe-uvicorn.service` for reference):

```bash
# Inside the project directory
# Ensure your virtualenv is active and dependencies are installed
# uvicorn main:app --reload --host 127.0.0.1 --port 8001

./.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001
```

Then open:
- http://127.0.0.1:8001/
- http://127.0.0.1:8001/admin/dev.html
- http://127.0.0.1:8001/admin/stats.html

## Common issues

- 404 Not Found on /dev.html or /dev/dev.html
  - Use `/admin/dev.html` — the admin pages live under `/admin/`.
- 403 Admin only from API calls
  - Ensure you are accessing from localhost OR set `ADMIN_USER_IDS` to include your user id and restart the app.
- Cached components not updating
  - The component loader (`web/js/components.js`) now appends a cache‑busting query (`?v=...`) when fetching components, but if you still see stale UI, do a hard refresh (Ctrl/Cmd+Shift+R).

## Related files

- `web/admin/dev.html`
- `web/admin/stats.html`
- `routes/admin.py` (admin API)
- `main.py` (static files mounting)
- `web/js/components.js` (component loader)
