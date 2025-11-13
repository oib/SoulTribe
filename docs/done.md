# Completed Work Log

## 2025-10-06
- Integrated detailed logging around `routes/match.py::match_create()` and `routes/meetup.py::list_meetups()` with graceful fallbacks for legacy schemas lacking `match.comments_by_lang`.
- Implemented raw-SQL legacy paths for match creation and meetup flows to keep production operational pre-migration.
- Enhanced `/api/meetup/propose` emails to show both UTC and recipient local time plus direct dashboard login link.
- Added machine-translated `guestGuide` coverage for additional locales (ga/hr/lv/lt/hu/mt/nl/no/pl/pt/ro/sk/sl/fi/tr/el/bg/ru/uk) and restarted services to load the new strings.

## 2025-10-07
- Finalized full UI + guest guide translations for Bosnian (`web/i18n/locales/bs/translation.json`), Catalan (`web/i18n/locales/ca/translation.json`), Galician (`web/i18n/locales/gl/translation.json`), dhe Icelandic (`web/i18n/locales/is/translation.json`).
- Drafted Luxembourgish UI strings and prepared Albanian translation package for review; added manual follow-up instructions.
- Refreshed translation documentation in `docs/Translation_Status.md`, `docs/Translation_Needs.md`, dhe `docs/UI_Translation.md` to reflect the latest locale progress.

## 2025-10-09
- Persisted profile notification preferences end-to-end (`routes/profile.py`) and refreshed the frontend save flow (`web/profile.js`) to reload the page post-update so browser/email toggles accurately reflect stored state.

## 2025-11-02
- Added SEO assets: created `robots.txt` and `sitemap.xml` with all website pages and appropriate metadata
- Updated build script (`dev/scripts/build-frontend.js`) to copy SEO files from `src/frontend/` to `src/public/` during build process
- Ensured `robots.txt` and `sitemap.xml` are properly served at root URLs after `make build-frontend`

## 2025-10-27
- Repaired backend import paths post-`src/` migration and restored Gunicorn/systemd services; verified `/api/health` and user unit restart.
- Finished landing-page asset rewiring: build script now copies `pages/`, `assets/components/`, and `assets/css/`; `index.html` ships critical heading styles with deferred JS to eliminate layout thrash.
- Hardened dynamic component loader (`components.js`) by guarding inline script replacement to avoid null dereferences and added timezone badge/footer fixes.
- Polished profile UI: redesigned `#primaryLanguage` select styling and ensured component assets are bundled via `make build-frontend`.
- Updated `docs/dirs.md` to reflect the generated `src/frontend/public/` bundle and remaining reference-rewire tasks.
- Added esbuild minification to `dev/scripts/build-frontend.js`, shrinking shipped JS/CSS and keeping the generated bundle optimized.
