# Agents in SoulTribe.chat

This document enumerates autonomous and semi-autonomous agents in this repository. Agents are components that run without direct user action, or are triggered by events/cron/timers/flows to perform background work.

Agents typically operate inside the FastAPI backend process or as external timers/services. All agents follow these principles:
- Minimal external side effects beyond declared permissions
- Clear trigger/entry points
- Explicit inputs/outputs and data boundaries

## Agent Directory

| Agent | Role | Trigger/Entry | Input | Output | Permissions | Source |
|---|---|---|---|---|---|---|
| bot_slot_scheduler | Schedule random availability slots for bot users | Function call on user login: `routes/auth.py` → `schedule_random_bot_slot(session)` | DB session; optional `max_attempts` (int) | Inserts `AvailabilitySlot` rows (UTC/local times, timezone) | DB read/write; no FS; no network | `services/bot_slot_scheduler.py`, call site: `routes/auth.py` |
| maintenance_cleanup | Periodic maintenance: delete unverified users, purge past slots and past meetups | systemd timer `dev/soultribe-cleanup.timer` → service runs `dev/soultribe_cleanup.py` every 3h | CLI args: `--users-hours` (int, default 24), `--slots-grace-hours` (int), `--meetups-grace-hours` (int), `--dry-run` (flag) | Deletes rows in `User`, `AvailabilitySlot`, `Meetup`; logs to stdout | DB read/write; no network; no FS writes beyond stdout | `dev/soultribe_cleanup.py`, `dev/soultribe-cleanup.timer` |

## Configuration

- Environment variables used by related services (examples; see source files for details):
  - `REFRESH_TOKEN_EXPIRE_DAYS`, `REFRESH_TOKEN_BYTES`, `MAX_REFRESH_TOKENS_PER_USER` in token service (not an agent, but influences auth flows that trigger the scheduler).
  - Database connectivity via `DATABASE_URL` (used by maintenance cleanup script via `db.session_scope`).
- systemd timer:
  - File: `dev/soultribe-cleanup.timer`
  - Schedule: every 3 hours (OnUnitActiveSec=3h)
  - Unit: `soultribe-cleanup.service` (service file expected alongside; ensure it calls `dev/soultribe_cleanup.py`)
- Entry points:
  - Login flow triggers bot scheduler inside API process: `POST /auth/login` in `routes/auth.py`.
  - Maintenance runs via systemd timer on the host.

## Interfaces/Protocols

- bot_slot_scheduler
  - Function: `services.bot_slot_scheduler.schedule_random_bot_slot(session, *, max_attempts: int = 5) -> None`
  - Behavior: selects a bot user (email like `gen%@soultribe.chat`), derives timezone from profile, computes a future 1-hour slot in local time (start hour 15–17), converts to UTC, and inserts an `AvailabilitySlot` if not duplicate.
  - Input schema: implicit (DB `Session`; optional integer `max_attempts`)
  - Output schema: side-effect only; commits a new `AvailabilitySlot` row or no-op.
  - Related models: `User`, `Profile`, `AvailabilitySlot`.

- maintenance_cleanup
  - CLI: `python dev/soultribe_cleanup.py [--users-hours INT] [--slots-grace-hours INT] [--meetups-grace-hours INT] [--dry-run]`
  - Behavior: finds and deletes
    - Unverified users older than threshold hours (default 24)
    - Availability slots whose `end_dt_utc` is in the past (with optional grace)
    - Meetups whose confirmed/proposed time is in the past (with optional grace)
  - Input schema: CLI args (integers and boolean flag)
  - Output schema: stdout lines summarizing counts; DB deletions

## Security & Permissions

- Least privilege by design:
  - bot_slot_scheduler: requires only DB read/write for `User`, `Profile`, and `AvailabilitySlot`. No network, no filesystem writes.
  - maintenance_cleanup: requires DB read/write for `User`, `AvailabilitySlot`, `Meetup` and dependent token tables; writes to stdout. No external network access.
- Data boundaries:
  - No PII is sent to external services by these agents.
  - Timezone handling uses `zoneinfo`; conversions remain in-process.

## Interaction Flows

- Login-triggered scheduling
  - `POST /auth/login` validates user → updates `last_login_at` → calls `schedule_random_bot_slot(session)` → optionally creates a new bot `AvailabilitySlot` → commit.

- Periodic cleanup
  - systemd timer fires → service runs `dev/soultribe_cleanup.py` → queries DB for stale entities → optionally deletes them → logs counts to stdout.

## Examples

- Invoke maintenance cleanup manually (dry-run):

```sh
python dev/soultribe_cleanup.py --users-hours 24 --slots-grace-hours 0 --meetups-grace-hours 0 --dry-run
```

- Programmatic call to bot scheduler (inside an existing DB session):

```python
from services.bot_slot_scheduler import schedule_random_bot_slot

schedule_random_bot_slot(session, max_attempts=5)
```

## Changelog

### 2025-10-24 — Agent registry creation and refresh
- Initial registry with 2 agents: bot_slot_scheduler and maintenance_cleanup
- Documented triggers, inputs/outputs, permissions, and sources

### 2025-10-22 — Support and fixes for AGENTS.md
- Baseline entry to anchor historical changes
