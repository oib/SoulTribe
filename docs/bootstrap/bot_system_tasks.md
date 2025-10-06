# Bot System — Windsurf Migration & QA Checklist

This document outlines the process for converting generated test users into fully configured bot users. The tasks cover updating emails, assigning realistic display names, setting languages and time zones based on birth location, and creating availability slots. The objective is to ensure all bots are standardized, secure, and restricted to European locales, with correct emails, realistic names, defined languages, and bookable 1‑hour time slots between 15:00–18:00 local time.

---

## 1) Preparation & Safety

- Create a snapshot or backup of the user database.
- Export a CSV of current test users with relevant fields.
- Identify the generated test users cohort for migration.

## 2) Email Normalization (@soultribe.chat)

- Identify users with `@example.com` or temporary domains.
- Convert domain to `@soultribe.chat` while keeping unique local parts.
- Ensure no collisions; add a numeric suffix if required.
- Log old → new email mappings for audit.

## 3) Birth Location, Locale & Language Policy

- Normalize `birth_location` (city, country).
- Determine the correct IANA time zone from location.
- Assign primary language based on country/region.
- If outside Europe, reassign to a suitable European city and note the change.
- Set secondary languages to include English (and local if different from primary).

## 4) Display Name Normalization

- Detect placeholder names such as `gen001` or `user1`.
- Generate realistic first and last names from a locale‑appropriate dataset.
- Avoid duplicates; adjust surnames if necessary.
- Record old → new display name mappings.

## 5) Bookable Slots (15:00–18:00 Local Time)

- Confirm each bot has a valid IANA time zone.
- Create three 1‑hour slots: 15–16, 16–17, 17–18.
- Convert to UTC for storage.
- Ensure no overlaps with existing availability.

## 6) Credentials & Security

- Generate strong passwords for each bot.
- Store credentials securely and rotate after QA.
- Enforce password change if a bot is promoted to a real user.

## 7) Data Validation & QA

- Verify all emails use `@soultribe.chat`.
- Check that display names are realistic per locale.
- Confirm primary and secondary languages are set correctly.
- Validate booking slots correspond to local time zones.
- Perform manual QA on a sample of users.

## 8) Rollback Plan

- Maintain detailed migration logs.
- Provide a script to revert changes by user ID range or cohort.
- Ensure backup files allow a full restore if needed.

## 9) Deliverables

- Updated users with normalized data.
- `bot_users_inventory.md` listing all bot users.
- Migration and QA logs.

### Locale Dataset Maintenance

- **Source of truth**: Locale, naming, and language policies live in `dev/bot_locale_data.py`.
- **Adding locales**: Append new city dictionaries (label, timezone, names, language codes). Keep arrays balanced to avoid bias when the script modulos by user ID.
- **QA**: After updates, rerun `python dev/bot_system_migration.py` in `--dry-run` mode (see below) to verify generated assignments without committing DB changes.

---

# Bot Users Inventory (Template) — `bot_users_inventory.md`

> Populate after migration. **Strictly restricted access**; rotate passwords after QA.

| id  | email (@soultribe.chat) | original_email | password | display_name | birth_location | original_location | timezone | primary_lang | secondary_langs | slots (local 15–18) | notes |
| --- | ----------------------- | --------------- | -------- | ------------ | --------------- | ---------------- | --------- | ------------ | ---------------- | ------------------- | ----- |
| 101 | anna.muster@soultribe.chat | anna@example.com | `Temp-9hVZ!` | Anna Muster | Vienna, AT | Vienna, AT | Europe/Vienna | de | en | 15–16, 16–17, 17–18 | Example reassignment note |
| 102 | jean.dupont@soultribe.chat | jean@example.com | `Temp-b4Kq#` | Jean Dupont | Paris, FR | Paris, FR | Europe/Paris | fr | en | 15–16, 16–17, 17–18 | - |
| …   | …                         | …               | …        | …            | …             | …                | …        | …            | …                | …                   | … |

### Notes

- Replace placeholders with actual data.
- If a user was originally outside Europe, list the new city in `birth_location` and document the original in a footnote.
- Ensure no `@example.com` addresses remain.
- Store this file encrypted if it contains passwords; delete or hash after QA.

---

## Implementation Notes (Windsurf Workflow)

### Phase 1 — Migration Script

1. Load the bot cohort and normalize emails.
2. Resolve locale and time zone from `birth_location`.
3. Apply language policy and generate display names.
4. Generate strong passwords for each bot automatically.

### Phase 2 — Availability Setup

1. Create availability slots (convert local time → UTC).
2. Ensure slots align with 15:00–18:00 local time and avoid overlaps.

### Phase 3 — Inventory Generation

1. Generate `bot_users_inventory.md` including assigned passwords.
2. Verify that all required fields are included.

### Phase 4 — Validation & Storage

1. Ensure idempotency: reruns should update rather than duplicate.
2. Store all mappings (before/after) in `/migrations/2025-09-bot-normalization/`.

---

## Automation Script (`dev/bot_system_migration.py`)

- **Purpose** Converts generated test users (`%@example.com`) into standardized EU bot users.
- **Inputs** Relies on existing `User` and `Profile` records; uses curated locale data in `dev/bot_locale_data.py` for names, languages, and time zones.
- **Outputs**
  - Updated records in the database (emails, hashed passwords, profiles, availability slots).
  - Inventory and audit artifacts under `migrations/2025-09-bot-normalization/`.

### Usage

1. **Activate environment** ensure `.env` points to the target database and dependencies are installed (`pip install -r requirements.txt`).
2. **Dry run review** (optional) inspect `dev/bot_locale_data.py` to confirm locale coverage.
3. **Execute migration**

   ```bash
   python dev/bot_system_migration.py
   ```

4. **Inspect console output** for processed user count and generated file paths.

### Generated Artifacts

- **Inventory** `migrations/2025-09-bot-normalization/bot_users_inventory.md`
- **Email map** `migrations/2025-09-bot-normalization/logs/email_mappings.csv`
- **Display name map** `migrations/2025-09-bot-normalization/logs/display_name_mappings.csv`
- **Rollback snapshot** `migrations/2025-09-bot-normalization/logs/rollback_snapshot.json`
- **Run summary** timestamped JSON files in `migrations/2025-09-bot-normalization/logs/`
- **State cache** `migrations/2025-09-bot-normalization/state.json` storing deterministic passwords per user ID

Passwords are generated deterministically per user ID; reruns reuse existing values to keep inventory stable until a manual rotation is performed.

### Optional Flags

- Pass `--dry-run` to print planned changes without committing (no artifacts written).
- Set `BOT_LOCALE_SAMPLE=<label>` to focus on a specific locale record when testing.
- Define `BOT_TARGET_IDS=1,2,3` to scope migration to a comma-delimited list during QA.

### Validation Checklist (Post-run)

- **Emails** Run `SELECT email FROM user WHERE email LIKE '%@example.com';` to confirm none remain.
- **Time zones** Spot check `profile.live_tz` and `availabilityslot.timezone` values for updated users.
- **Slots** Validate that each bot has three one-hour slots in the 15:00–18:00 local window for the scheduled date (default: next-day).
- **Languages** Ensure `profile.languages` includes locale primary plus English.
- **Inventory** Review `bot_users_inventory.md`; remove or encrypt once QA finishes.
- **Rollback readiness** Verify `logs/rollback_snapshot.json` contains pre-migration values before deleting backups.

### Rollback Procedure

1. Restore database from snapshot if available **OR**
2. Write a targeted script to reapply `rollback_snapshot.json` values for affected user IDs (email, password hash, profile fields).
3. Delete generated availability slots if reverting (match on `user_id` and `start_dt_utc`).

Document rollback actions in the logs directory alongside the original run summary.

---

## Rerun & Monitoring Notes

- **Idempotent reruns**: The script reuses existing refresh data, password hashes, and avoids duplicate availability by checking `start_dt_utc` before insert.
- **Audit trail**: Summary JSON files in `migrations/2025-09-bot-normalization/logs/` capture each run's timestamp, user count, and file outputs—retain these for compliance.
- **Cleanup**: Once QA approves, rotate the deterministic passwords, archive inventory files securely, and prune historic logs older than required retention.

