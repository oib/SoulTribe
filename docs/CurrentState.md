# SoulTribe.chat — Current State (Backend, API, DB, Frontend)

Last updated: 2025-11-02

## Backend and DB
- Postgres-only via `DATABASE_URL` in `.env`.
- Versioned migrations with Alembic (no more boot-time lightweight migrations in `db.py`).
  - First revision: `a20250910_meetup_cols` adds `meetup.proposer_user_id` and `meetup.confirmer_user_id` and indexes.
  - New: `a20250914_email_verif` adds `user.email_verified_at` and `emailverificationtoken` table; `65518767e3af` merges heads.
- Models in `models.py` (key tables):
  - `User` (with `email_verified_at`), `Profile` (`live_tz`, `languages` JSON list), `Radix`, `Match` (includes `comment`), `Meetup`, `AvailabilitySlot`, `EmailVerificationToken`.
- Radix computation uses Swiss Ephemeris via `services/radix.py` and tolerates naive timestamps (treated as UTC).
- Scoring algorithm: `services/scoring.py` returns integer scores with a simple weighted heuristic and language bonus.
- Availability helper: `services/availability.py` computes 1‑hour step overlaps between users’ availability windows for the next N days.
- Bot slot automation: `services/bot_slot_scheduler.schedule_random_bot_slot()` selects a bot (`gen%@soultribe.chat`), generates a one-hour slot between 15:00–18:00 local time within the next three days, and persists it (invoked on each successful user login).
- Redis caching: `services/redis_client.py` connects to DB `1` (override with `REDIS_DB`/`REDIS_URL`) and stores match score caches under keys like `match:score:*`; DB `0` remains reserved for other apps.

## API Summary (FastAPI)
- Auth: `routes/auth.py`
  - `POST /api/auth/register` → returns JWT and creates an email verification token
  - `POST /api/auth/login` → returns JWT and, on success, calls `services.bot_slot_scheduler.schedule_random_bot_slot()` to publish one new availability slot for a random bot within the next 3 days (15:00–18:00 local window)
  - `POST /api/auth/verify` (admin/localhost only) → sets `email_verified_at` (legacy dev convenience)
  - `GET /api/auth/verify-email?token=...` → one‑click verification (48h tokens, single use)
- Profile: `routes/profile.py` (JWT)
  - `GET /api/profile/me` → lightweight auth check and profile snapshot
  - `PUT /api/profile` → upsert profile; supports `display_name`, `live_tz`, `languages`, birth data, etc.; recomputes radix if enough data
- Match: `routes/match.py`
  - `POST /api/match/score` → raw scoring for two radix JSONs
  - `POST /api/match/find` (JWT, requires verified target user) → returns candidates with:
    - `score`, `breakdown`, `overlaps` (UTC + localized using `live_tz`), `comment` (AI), optional `match_id`
    - Filters by shared language intersection
    - Supports `min_score`, `lookahead_days`, `max_overlaps`
  - `POST /api/match/create` (JWT) → computes score from stored radices and creates a `Match`
  - `POST /api/match/annotate` (JWT) → runs `dev/ollama_cli.mjs` to generate an AI `comment` and stores it in `Match.comment`
- Meetup: `routes/meetup.py` (JWT)
  - `POST /api/meetup/propose` → creates a proposed meetup; allows optional `proposed_dt_utc`
  - `POST /api/meetup/confirm` → confirms with `confirmed_dt_utc` and generates a Jitsi URL (open server; room name deterministic)
    - Guard: proposer cannot confirm their own meetup (403)
  - `POST /api/meetup/unconfirm` → reverts a confirmed meetup to proposed
    - Guard: only the user who confirmed may unconfirm (403)
  - `POST /api/meetup/cancel` → cancels a meetup
  - `GET /api/meetup/list` → for the current user, returns meetups and clickable room URLs
- Availability: `routes/availability.py` (JWT)
  - `GET /api/availability` → list your slots
  - `POST /api/availability` → create hour-aligned slot (≥ 1 hour)
  - `PATCH /api/availability/{slot_id}` → edit a slot (hour-aligned, ≥ 1 hour, future-only)
  - `DELETE /api/availability/{slot_id}`

- Admin: `routes/admin.py`
  - `GET /api/admin/stats` (admin/localhost) → aggregate counts and recent activity
  - `GET /api/admin/ping` (admin/localhost) → boolean check for admin

## Mini-game / LLM Integration
- `dev/ollama.js`: OpenAI-compatible chat completions client.
  - Config from `.env`: `OLLAMA_BASE`, `OLLAMA_API_KEY`, `OLLAMA_MODEL`.
  - System prompt tailored to produce a concise, friendly match annotation.
- `dev/ollama_cli.mjs`: Node wrapper to call `checkWithOllama()` from the backend.
- `routes/match.py /annotate` calls the Node wrapper and persists the reply in `Match.comment`.

## Frontend (Static)
- Source lives under `src/frontend/{pages,css,js,i18n,assets}`.
- Built bundle is generated into `src/frontend/public/` via `npm run build-frontend` or `make build-frontend`.
- Mounted at `/` from `src/frontend/public/`.
- Landing page is `index.html` (formerly `welcome.html`).
- Topbar includes an Admin button shown only for admins/localhost.
- Admin pages are under `/admin`: `admin/stats.html`, `admin/dev.html` and perform a client‑side guard (`/api/admin/ping`) on load.
- Supports Auth, Profile updates (including `live_tz` and `languages`), Availability CRUD, simplified Match Find (fixed defaults), and Meetup flows.
- Availability list shows a per-slot `Delete` button; global delete control removed.
- Overlap chips show a 3‑column layout (UTC • you • other) with per‑person blocks: label, date, time, duration.
- Favicon added and linked across pages.
- Match list renders only candidates with at least one overlap and includes:
  - Users + score, AI comment (read‑only), “Annotate” button, and overlap grid; “Propose this time” per overlap proposes a meetup.
  - The "Find Matches" flow uses fixed defaults (`min_score`=50, `lookahead_days`=3, `max_overlaps`=5) and the logged‑in user automatically.
- JWT is persisted in localStorage and shown in the header; logout clears it.
  - `window.currentUserId` is kept as a value (not a function) and synced globally for dashboard usage.
  - External links (e.g., Jitsi join) open normally; event delegation avoids intercepting `_blank`/external anchors.

## Known Behaviors and Constraints
- Email verification gating: `/api/match/find` requires `email_verified_at` for the requested user.
- Availability slots must be strictly aligned to whole hours and have ≥ 1-hour duration.
- Availability creation in the UI enforces same‑day start/end.
- Language matching requires non-empty intersection (`Profile.languages` used if present; falls back to `lang_primary`/`lang_secondary`).
- The AI comment is read-only (generated via `/api/match/annotate`).
- Node.js must be available to run `dev/ollama_cli.mjs`.

## UI/UX updates (2025‑09‑16)

### Timezone Support
- `AvailabilitySlot` stores both UTC and local times with timezone for historical accuracy.
- Timezone handling uses `pytz` with `Europe/Vienna` as the default.
- Frontend shows local times with timezone indicators where relevant.
- Timezone hint moved from below the form to the section header for better visibility.

### Meetup Card Improvements
- Simplified meetup card UI with cleaner action buttons
- Removed redundant status text (relying on badges instead)
- Reorganized action buttons for better usability

### Welcome Page
- Simplified welcome heading
- Updated layout and styling

### UI/UX Updates (2025-10-10)

#### Landing Page Redesign
- Consolidated duplicate sections ("How It Works", "Getting Started", "Next Steps") into streamlined cards.
- Updated "How SoulTribe Works" with detailed 7-step onboarding flow.
- Revised "Why SoulTribe is Different" with accurate feature highlights (consent-first scheduling, AI insights).
- Refactored "What You'll Experience" to focus on resonance-first introductions and AI-guided conversations.
- Expanded "How Matching Works" with technical details on chart synthesis, scoring, and AI context.
- Refined "Support & Resources" to emphasize concierge onboarding and 1:1 meetups.
- Global community section now highlights translated interface and timezone awareness.

#### Internationalization (i18n)
- All 35 supported locales now have draft translations for landing page content.
- Translation system updated with new keys under `landing.*` sections.
- UI now loads localized strings for the landing page across all languages.

#### Toast and Auth Fixes
- Fixed login page toast notifications by loading `toast.js` before `app.js`.
- Account deletion now shows success toast, clears tokens, and redirects to landing page.

### Previous Updates (2025‑09‑14)
- Availability inputs are compact and aligned in a single row (date, start, end). Mobile reflows to one column.
- Toast notifications moved to center‑bottom with readable light/dark palettes and click‑to‑dismiss.
- Proposer cannot confirm; only confirmer can unconfirm; either side can cancel.
- Matches section hides candidates without overlaps.
- CSS reorganization:
  - Global/dark theme in `web/theme.css`
  - Shared utilities in `web/styles.css`
  - Page CSS: `index.css`, `dashboard.css`, `profile.css`, `login.css`, `admin/*.css`
  - See `docs/styles.md` for details

## Health
- `GET /api/health` → { ok: true }
- Server runs on port 8001 under Gunicorn (Uvicorn workers).

## Deployment & Services
- Dev: `make dev` runs Gunicorn with reload on port 8001.
- Frontend build: `make build-frontend` (or `npm run build-frontend`) generates the static bundle into `src/frontend/public/`.
- Systemd (system‑wide): `dev/soultribe-gunicorn.service` → `/etc/systemd/system/soultribe-gunicorn@.service`.
- Systemd (user): `dev/soultribe-gunicorn.user.service`.
