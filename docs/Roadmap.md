# SoulTribe.chat — roadmap & TODOs

Last updated: 2025-11-02

## Near-Term (High Priority)
- Auth
  - ✅ Email verification via one-click token
  - ✅ Lock down legacy manual verify to admin/localhost
  - ✅ Add resend verification endpoint and rate limit *(cooldown + token reuse implemented)*
  - ✅ Add refresh tokens or short-lived access tokens *(15m JWT + rotating refresh tokens)*
  - ✅ Add rate limiting on login and sensitive routes *(in-memory sliding window per client IP)*
- Matching
  - 🔲 Cache or precompute scores for common pairs *(optional)*
  - ✅ Add pagination to `/api/match/find` responses
  - ✅ Frontend filters: already hide non-overlap candidates
- Availability & Overlaps
  - ✅ Add PATCH to edit availability slot times
  - ~~Optional: user-configurable overlap window length (≥ 1 hour)~~ ❌ Won't implement (minimum overlap stays fixed at 1 hour)
  - ✅ UI: compact inputs in a single row; enforce same-day creation in UI
  - ✅ Timezone support with local time display and storage
- AI Annotation
  - ✅ Secrets already moved to `.env`; consider rotation automation
  - ~~Add background job to annotate newly created matches automatically~~ ❌ Won't implement (annotations remain manual-only via dashboard button)
- Meetup Flow
  - ✅ Proposer cannot confirm; only confirmer can unconfirm; either side can cancel
  - ✅ Add confirm dialogs for cancel/unconfirm *(browser prompts on dashboard actions)*
  - ✅ Email notifications include UTC + recipient local time and direct dashboard link
  - 🔲 Optional: send calendar `.ics` download links
- Security
  - ✅ Add basic rate limiting across `/api/match/*` and `/api/meetup/*` *(per-IP sliding window limits)*
  - ✅ Audit logs for annotate/meet actions *(structured JSON to `audit` logger)*
- Documentation & i18n
  - ✅ Guest Jitsi guide updated with full `data-i18n` coverage and localized strings (EN/DE/ES)
  - ✅ Provide native translations for remaining locales beyond English fallbacks (35 languages with draft AI translations)
  - ✅ Automate translation handoff (draft translations generated via AI for all locales)
  - ✅ Add SEO assets: `robots.txt` and `sitemap.xml` with proper metadata and build integration

## Medium-Term
- Profile
  - 🔲 Add avatar upload
  - 🔲 Add social handles and interests/tags
  - 🔲 Richer language metadata (proficiency levels)
- Matching Algorithm
  - 🔲 Improve weights; tune with feedback data
  - 🔲 Consider additional astrology aspects and houses (if desired)
- DB & Migrations
  - 🔲 Alembic in place; add more granular revisions and FK constraints
  - 🔲 Add indexes for frequent queries (e.g., match lookups)
  - 🔲 Ship production migration adding `match.comments_by_lang` column and backfill existing rows
- Frontend
  - Replace console with a proper app (React/Svelte)
  - ~~Add localization/i18n for UI strings~~ ✅ Completed (28 languages)
  - Toast system: small queue & durations per severity (partial: center‑bottom, palette, click‑to‑dismiss done)
  - CSS reorg by page/theme (done)
  - ✅ Frontend build step: `make build-frontend` / `npm run build-frontend` generates static bundle from `soul/frontend` into `soul/frontend/public/` (includes components/css/assets).
  - ✅ Primary language selector styled in profile UI; build bundles updated navbar/footer/components.
  - Add richer language metadata (proficiency levels) & multi-select polish (pending)
  - Implement RTL language support for Arabic, Hebrew, etc.

## Longer-Term Ideas
- Notifications (email/push) when a strong match appears or a meetup is scheduled
- **DONE (2025-10-09)**: Profile notification preference UI persists browser/email toggle state end-to-end with automatic post-save reload.
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
- ✅ Frontend restructure: source under `soul/frontend/{pages,css,js,i18n,assets}`; build step via `make build-frontend`.

## Notes
- The console is for development. The production UI should be a proper web client.
- Keep secrets in `.env` and do not commit them. Node runs with current process env; ensure the environment is loaded for that process.
