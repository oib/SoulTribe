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

