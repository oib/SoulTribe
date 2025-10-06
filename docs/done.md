# Completed Work Log

## 2025-10-06
- Integrated detailed logging around `routes/match.py::match_create()` and `routes/meetup.py::list_meetups()` with graceful fallbacks for legacy schemas lacking `match.comments_by_lang`.
- Implemented raw-SQL legacy paths for match creation and meetup flows to keep production operational pre-migration.
- Enhanced `/api/meetup/propose` emails to show both UTC and recipient local time plus direct dashboard login link.
