# Email Handling in the Application

## Overview
Transactional emails are sent through the shared helper in `services/email.py`. The helper wraps Python's `smtplib`/`email.message` modules and is now integrated with the meetup workflow (`routes/meetup.py`), so real users receive notifications without relying on standalone test scripts.

## Current Implementation

- **Module**: `services/email.py`
- **Exports**: `send_email(to, subject, html, text=None)`
- **Behavior**:
  - Builds both plain-text and HTML parts (deriving plain text automatically when omitted).
  - Sends mail via a configurable SMTP server.
  - When `EMAIL_DEV_MODE=1`, skips SMTP and logs the message content to stdout for safe local development.

### Environment Variables
- `EMAIL_DEV_MODE` (default `0`): set to `1` to print emails to stdout instead of sending.
- `SMTP_HOST` (default `localhost`): hostname of the SMTP relay.
- `SMTP_PORT` (default `25`): port used for the SMTP connection.
- `EMAIL_FROM` (default `noreply@soultribe.chat`): sender address used in outgoing emails.

No authentication or TLS is currently configured; configure the relay to handle security policy (see **Future Work**).

### Call Sites
- `routes/meetup.py`
  - `/api/meetup/propose`: notifies the non-proposing participant with UTC and recipient-local timestamps plus a dashboard link.
  - `/api/meetup/confirm`: emails both participants with the confirmed time and Jitsi room link.

Historical test scripts (`dev/scripts/testmail.py`, `dev/tests/testmail.py`) remain available for ad-hoc checks but the production code path should use `send_email`.

## Configuration Checklist
- Ensure SMTP relay reachable from the backend host (`SMTP_HOST`/`SMTP_PORT`).
- Provide a valid sender address via `EMAIL_FROM`.
- Set `EMAIL_DEV_MODE=1` in development to prevent accidental outbound emails.

## Future Work
- Support SMTP authentication and STARTTLS/SSL.
- Introduce templating (Jinja, MJML, etc.) for richer email content.
- Add retry/backoff with structured logging on failures.
- Integrate with a transactional email provider if higher reliability/delivery metrics are needed.

## Testing
In development, set `EMAIL_DEV_MODE=1` and trigger the relevant endpoint (e.g., `/api/meetup/propose`). The email body will print to stdout in the service logs (`[email.dev]` prefix). For manual SMTP testing, the legacy scripts remain usable:

```bash
EMAIL_DEV_MODE=0 SMTP_HOST=localhost SMTP_PORT=25 python3 dev/scripts/testmail.py
```

Ensure a local SMTP server is running before executing the script.
