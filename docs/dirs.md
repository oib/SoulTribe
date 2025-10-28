# Directory Cleanup & Migration Status

_Last updated: 2025-10-27 (evening sync)_

We continue to migrate toward a tidy `src/`-centric layout using the incremental "touch-and-move" approach. This document now reflects the current state after the backend and several dev assets were relocated, together with the remaining work to restructure the frontend bundle.

## Goals
- Reduce clutter in the project root by relocating implementation code into `src/`.
- Separate build inputs (source files) from outputs (served/static artifacts).
- Prepare for future tooling (bundlers, type checkers, tests) without disrupting the current FastAPI + static deployment flow.
- Document the required rewiring so the transition can be executed incrementally without downtime.

## Target Top-Level Layout

| Path | Purpose | Status |
| --- | --- | --- |
| `src/backend/` | FastAPI app factory (`main.py`), database helpers (`db.py`), SQLModel tables (`models.py`), Pydantic schemas, routes, and services (including `services/llm`). | ✅ Migrated and live |
| `src/frontend/pages/` | HTML entry points grouped by feature (auth, dashboard, admin, legal, verify, etc.). | ✅ Migrated |
| `src/frontend/css/` | Page-specific and shared CSS (theme, layout, admin styles). | ✅ Migrated |
| `src/frontend/js/` | Shared JS modules (`app.js`, `dashboard.js`, `profile.js`, `components.js`, etc.). | ✅ Migrated |
| `src/frontend/assets/` | Components, legacy partials, and staging area for assets still being sorted. | ⚠️ Needs tidy-up |
| `src/frontend/public/` | Generated static bundle served by FastAPI; populated via `npm run build-frontend` / `make build-frontend` referencing `dev/scripts/build-frontend.js`. | ✅ Generated |
| `dev/scripts/`, `dev/node/`, `dev/systemd/`, `dev/shell/`, `dev/config/`, `dev/logs/` | Development utilities, Node helpers, systemd units, shell launchers, config, and log archives. | ✅ Sorted |
| `docs/` | Product and engineering documentation. | ✅ |
| `alembic/`, `dev/translations/`, `web/` | Alembic migrations, translation automation (`dev/translations/scripts/*.js`), legacy static directory (now unused; should become build output once the new pipeline lands). | ⚠️ Review/cleanup pending |

## Phase 0 — Prep (current sprint)
- Confirm no runtime code reads from `web/` at import time (only FastAPI static mount). ✅
- Introduce `src/` with empty `backend/` and `frontend/` directories (already present).
- Capture this migration plan in `docs/dirs.md` (this file). ✅

## Phase 1 — Frontend Source Relocation (in progress)
1. **Define target structure** ✅
   - Pages, CSS, and JS now live in dedicated subfolders under `src/frontend/`.
   - Shared components currently staged under `src/frontend/assets/` pending final tidy-up.
2. **Rewrite asset references** _(in progress)_
   - Landing (`index.html`) now pulls CSS/JS from the new `/css/**`, `/js/**`, `/components/**` paths with inline critical styles to avoid layout flashes.
   - Continue updating remaining HTML pages, service worker cache list, and Node tooling to the new layout.
3. **Introduce build step** ✅
   - `make build-frontend` / `npm run build-frontend` use `dev/scripts/build-frontend.js` to copy `src/frontend/{pages,css,js,i18n,assets}` into `src/frontend/public/` (favicons included).
   - Future enhancement: evaluate `esbuild`/`Vite` if bundling becomes necessary.
4. **Remove legacy `web/` directory**
   - Once the build pipeline is in place, drop the residual `web/` tree from git and ensure FastAPI serves the generated output.

## Phase 2 — Backend Relocation (done)
- `main.py`, `db.py`, `models.py`, and `schemas.py` now live in `src/backend/` and are imported via `src.backend.*`.
- Routes and services were moved under `src/backend/routes/` and `src/backend/services/` (including `services/llm`).
- Gunicorn launch scripts and systemd units target `src.backend.main:app` and share the config in `dev/config/gunicorn_config.py`.
- Dev utilities remain under `dev/scripts/` with environment-aware launchers in `dev/shell/`.

### Frontend Restructure TODOs (current sprint)
1. **Finish reference rewiring**
   - Remaining HTML pages (`reset-password.html`, `verify-email.html`, `terms.html`, `imprint.html`, `admin/dev.html`, `admin/stats.html`, `admin-i18n.html`) still need the new `/css/**`, `/js/**`, `/admin/**` paths.
   - Ensure every page-specific asset is sourced from `src/frontend/{css,js}` and bundled via the build step.
2. **Service worker & tooling adjustments**
   - Refresh `sw.js` cache list to the new asset locations.
   - Update translation scripts (`dev/translations/scripts/*.js`) and any Node helpers under `dev/node/` to read from `src/frontend/pages/css/js` instead of the legacy layout.
3. **Docs pages**
   - Update files under `src/frontend/public/docs/` to new asset paths and ensure build step can regenerate them if needed.
4. **Cleanup**
   - Remove redundant files once the build pipeline is in place, and prune placeholder directories (e.g., `src/frontend/assets/` once components are sorted).

### Build Step (implemented)
- **Script**: `dev/scripts/build-frontend.js` copies `src/frontend/{pages,css,js,i18n,assets/img,assets/components,assets/css}` into `src/frontend/public/` and places top-level favicons.
- **NPM / Make**: Run with `npm run build-frontend` or `make build-frontend` (`make clean-frontend` removes generated assets).
- **Result**: `src/frontend/public/` is a generated bundle; source of truth lives under `src/frontend/{pages,css,js,i18n,assets}`.
- **Next**: Ensure deployment docs invoke the build before serving and consider future bundling if needed.

## Phase 3 — Configuration Rewire (partial)
- `src/backend/main.py` mounts the frontend bundle from `src/frontend/public/`.
- `run_app.sh` and systemd units reference the new paths and log locations under `dev/`.
- TODO: update CI/deployment scripts to run `make build-frontend`/`npm run build-frontend` before deploying static assets.

## Phase 4 — Cleanup & Validation (upcoming)
- Prune the deprecated `web/` tree once the frontend migration is complete.
- Add lint/test coverage for both backend (`pytest`) and frontend (tooling TBD).
- Update `README.md`, `docs/CurrentState.md`, and onboarding docs to explain the new build flow.

## Open Questions / Decisions Needed
- Choose a frontend build tool: `esbuild`, `Vite`, or keep plain copy for now.
- Determine if legacy admin tools should remain as vanilla JS or migrate to a framework (React/Svelte) while moving to `src/frontend/`.
- Decide on bundling strategy for service worker (`sw.js`) and shared helper modules.
- Evaluate whether translation JSONs remain raw or gain an AI-assisted generation pipeline.

## Next Steps Checklist
- **Owner**: _TBD_
- **Approve plan** ➡️ move to Phase 1 execution.
- **Set up tracking** (issue/tickets) for each phase to avoid multi-week drift.

## Appendix — Current Frontend Bundle Snapshot (pre-refactor)
```
src/frontend/
├── pages/ (index.html, login.html, dashboard.html, profile.html, legal pages, admin/*)
├── css/ (theme.css, styles.css, page-specific CSS, admin-dev.css, admin-stats.css)
├── js/ (app.js, dashboard.js, profile.js, login.js, toast.js, components.js, admin/stats.js)
├── assets/
│   └── components/ (navbar.html, footer.html)
├── public/
│   ├── css/ & js/ (published copies until build step lands)
│   ├── docs/
│   ├── i18n/
│   ├── img/
│   ├── sw.js
│   └── misc static files (robots.txt, sitemap.xml, sellers.json, temp_ga.json, admin-i18n.js)
└── … (build tooling TBD)
```

The new hierarchy separates source pages/styles/scripts from the published bundle. During the remainder of Phase 1 we will finish rewriting references, prune unused assets, and introduce a build step so `src/frontend/public/` becomes a generated artifact again.
