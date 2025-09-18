# SoulTribe.chat — Roadmap & TODOs

Last updated: 2025-09-16

## Near-Term (High Priority)
- Auth
  - Email verification via one‑click token (done)
  - Lock down legacy manual verify to admin/localhost (done)
  - Add resend verification endpoint and rate limit (todo)
  - Add refresh tokens or short-lived access tokens if needed (todo)
  - Add rate limiting on login and sensitive routes (todo)
- Matching
  - Cache or precompute scores for common pairs (optional)
  - Add pagination to `/api/match/find` responses
  - Add ability to exclude blocked users (requires blocklist model)
  - Frontend filters: already hide non-overlap candidates (done)
- Availability & Overlaps
  - Add PATCH to edit availability slot times (done)
  - Optional: user-configurable overlap window length (≥ 1 hour) (todo)
  - UI: compact inputs in a single row (done), enforce same‑day creation in UI (done)
  - Timezone support with local time display and storage (done)
- AI Annotation
  - Secrets already moved to `.env`; consider rotation automation
  - Add background job to annotate newly created matches automatically
- Meetup Flow
  - Proposer cannot confirm (done); only confirmer can unconfirm (done); either side can cancel (done)
  - Add confirm dialogs for cancel/unconfirm (todo)
  - Optional: send calendar `.ics` download links (todo)
- Security
  - Add basic rate limiting across `/api/match/*` and `/api/meetup/*`
  - Audit logs for annotate/meet actions

## Medium-Term
- Profile
  - Add avatar upload
  - Add social handles and interests/tags
  - Richer language metadata (proficiency levels)
- Matching Algorithm
  - Improve weights; tune with feedback data
  - Consider additional astrology aspects and houses (if desired)
- DB & Migrations
  - Alembic in place; add more granular revisions and FK constraints
  - Add indexes for frequent queries (e.g., match lookups)
- Frontend
  - Replace console with a proper app (React/Svelte)
  - Add localization/i18n for UI strings
  - Toast system: small queue & durations per severity (partial: center‑bottom, palette, click‑to‑dismiss done)
  - CSS reorg by page/theme (done)

## Longer-Term Ideas
- Notifications (email/push) when a strong match appears or a meetup is scheduled
- Group matching or events
- Admin dashboard for moderation (partially done: admin stats dashboard + dev console under `/admin/*`)
- Export/import user data and profiles
- Public API documentation (OpenAPI rendered and docs site)

## Current TODO List Snapshot
- Postgres-only, no SQLite (done)
- Versioned migrations via Alembic (done)
- Gunicorn service units (system and user) on 8001 (done)
- Per-slot delete buttons in availability (done)
- Overlap UI: 3-column (UTC/you/other) with date/time/duration (done)
- Favicon across pages (done)
- Meetup: propose/confirm/list (done), unconfirm/cancel (done, with role guards)
- Matches: hide candidates without overlaps (done)
- Matches: fixed defaults and auto-use of logged-in user (done)
- Landing page: `index.html` replaces `welcome.html` (done)
- Admin section moved under `/admin` with client guard + server ACL (done)
- CSS docs at `docs/styles.md` (done)
- Timezone support with local time display and storage (done)
- Simplified meetup card UI (removed redundant status text, reorganized actions)
- Updated welcome page heading and layout

## Notes
- The console is for development. The production UI should be a proper web client.
- Keep secrets in `.env` and do not commit them. Node runs with current process env; ensure the environment is loaded for that process.
