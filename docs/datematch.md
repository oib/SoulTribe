# DateMatch: Timezone‑safe availability & matching (PostgreSQL + UTC)

This doc defines a **one‑off (non‑recurring)** availability model. Users create concrete local windows (date + start hour + duration). The backend converts them to **UTC** and stores them both as simple UTC instants (for API ergonomics) and as a PostgreSQL `tstzrange` (for fast overlap). Matching happens on UTC ranges and results are rendered back in each user’s local time.

---

## Core Principles (no recurrence)

1. **Store concrete instants in UTC.**
2. **Keep the user’s IANA timezone on the slot** (and on the profile for defaults) for faithful rendering.
3. **Convert local → UTC on write** (server recomputes from local+tz as source of truth); **UTC → local on read**.
4. **Index range overlaps** with a Postgres GiST on `tstzrange` and match via `&&`.
5. **Normalize response UTC**: all API responses return UTC-aware timestamps (Z).

---

## Schema (current)

```sql
-- Users (existing)
-- ...

-- Primary app table (SQLModel): simple columns for API ergonomics
-- stores UTC instants and also the local wall times and tz for fidelity
CREATE TABLE availabilityslot (
  id              bigserial PRIMARY KEY,
  user_id         integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  start_dt_utc    timestamptz NOT NULL,
  end_dt_utc      timestamptz NOT NULL,
  start_dt_local  timestamp NULL,
  end_dt_local    timestamp NULL,
  timezone        text NULL,
  created_at      timestamp NOT NULL DEFAULT now()
);

-- Optimized range table for matching (Postgres power)
CREATE TABLE availability_once (
  id         bigserial PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  window_utc tstzrange NOT NULL                  -- [start_utc, end_utc)
);
CREATE INDEX availability_once_gist ON availability_once USING gist(window_utc);
```

Notes:
- New writes dual‑write into `availabilityslot` and `availability_once` (best‑effort); updates refresh the range.
- A migration backfilled `availability_once` from existing rows and normalized UTC columns to `timestamptz`.

---

## Write Path: Local input → UTC storage (create)

**API: POST** `/api/availability`

**Request JSON** (dashboard uses profile timezone and local inputs):

```json
{
  "date": "2025-09-13",
  "local_start": "14:00",        // local wall time
  "local_end":   "16:00",        // local wall time (derived: start + duration)
  "tzid": "America/New_York"     // profile.live_tz
}
```

**Server behavior**

1) The backend validators parse `start_dt_utc/end_dt_utc` and accept `Z`.
2) If `local_start/local_end` and `tzid` are provided, the server ALWAYS recomputes UTC from `(date + local) AT TIME ZONE tzid` and uses that as source of truth.
3) It stores:
   - `availabilityslot`: `start_dt_utc`, `end_dt_utc`, `start_dt_local`, `end_dt_local`, `timezone`.
   - `availability_once`: `[start_dt_utc, end_dt_utc)` as `tstzrange` (GiST indexed).

**Validation**

- Reject if `local_end <= local_start` (keep dashboard simple; users can create two slots if crossing midnight).
- Enforce minimum duration (e.g., 15 minutes) and maximum (e.g., 8 hours).

**Response JSON** (returns UTC and local, normalizing UTC to Z):

```json
{
  "id": 123,
  "start_utc": "2025-09-13T18:00:00Z",
  "end_utc":   "2025-09-13T22:00:00Z",
  "start_local": "2025-09-13T14:00:00-04:00",
  "end_local":   "2025-09-13T16:00:00-04:00",
  "tzid": "America/New_York"
}
```

> Server computes `start_local/end_local` from stored UTC using `:tzid` and returns both.

---

## Read Path: List my slots (UTC + local)

**API: GET** `/api/availability`

```sql
WITH tz AS (
  SELECT COALESCE(:tzid, u.tzid) AS tzid FROM app_user u WHERE u.id = :user_id
)
-- Implementation detail: API responds from availabilityslot and normalizes UTC to tz=UTC.
-- Local fields are returned as stored (or can be derived client-side as fallback).
```

---

## Matching Two Users (Bob ↔ Alice)

**API: GET **``

```sql
WITH horizon AS (
  SELECT now() AT TIME ZONE 'UTC' AS t0,
         (now() AT TIME ZONE 'UTC') + (:horizon_days || ' days')::interval AS t1
),
ua AS (
  SELECT window_utc FROM availability_once WHERE user_id = :user_a
    AND window_utc && tstzrange((SELECT t0 FROM horizon), (SELECT t1 FROM horizon), '[)')
),
ub AS (
  SELECT window_utc FROM availability_once WHERE user_id = :user_b
    AND window_utc && tstzrange((SELECT t0 FROM horizon), (SELECT t1 FROM horizon), '[)')
)
SELECT 
  GREATEST(lower(a.window_utc), lower(b.window_utc)) AS start_dt_utc,
  LEAST(upper(a.window_utc),  upper(b.window_utc))  AS end_dt_utc
FROM ua a
JOIN ub b ON a.window_utc && b.window_utc
WHERE GREATEST(lower(a.window_utc), lower(b.window_utc)) < LEAST(upper(a.window_utc), upper(b.window_utc))
ORDER BY 1
LIMIT :lim;
```

**Render for each user’s local time**

```sql
-- For Bob (NY)
SELECT (lower(overlap_utc) AT TIME ZONE 'America/New_York') AS start_local,
       (upper(overlap_utc) AT TIME ZONE 'America/New_York') AS end_local
FROM (<overlap-query>) q;

-- For Alice (Paris)
SELECT (lower(overlap_utc) AT TIME ZONE 'Europe/Paris') AS start_local,
       (upper(overlap_utc) AT TIME ZONE 'Europe/Paris') AS end_local
FROM (<overlap-query>) q;
```

---

## Dashboard (dashboard.html) wiring

**Availability form fields (Create)**

- `date` (type=date)
- `start hour` (select 0–23)
- `duration` (select 1–3 hours)
- `tzid`  (hidden/select; default from profile.live_tz; browser fallback)

**Edit inline**

- Mirrors the create UI: `date`, `start hour`, `duration (1–3h)`; on save, computes end = start + duration.
- Sends `PATCH /api/availability/:id` with new UTC start/end; server normalizes and recomputes locals from saved `timezone`.

**UI display**

```html
<div class="slot">
  <div class="slot__local">14:00–18:00 <span class="tz">America/New_York</span></div>
  <div class="slot__utc">18:00–22:00 UTC</div>
</div>
```

- The dashboard also shows a timezone label with the offset at the slot start, e.g. `Europe/Vienna (UTC+02:00)`.

**Edit/Delete**

- `PATCH /api/availability/:id` → accept updated UTC start/end (client computes from local+tz); server normalizes UTC and recomputes local from stored `timezone` for fidelity.
- `DELETE /api/availability/:id` → remove slot.

---

## Gotchas

1. **DST safety**: Always build UTC from `(date + local_time) AT TIME ZONE tzid` (server recomputation guards against client drift).
2. **End‑exclusive**: Keep ranges `[)` to avoid double‑count on touching windows.
3. **Midnight‑crossing**: Disallow in a single slot; user creates two if needed.
4. **Indexing**: GiST on `tstzrange` is critical for overlap speed; Python fallback exists for non‑range path.
5. **Normalize UTC in responses** for consistent UI rendering and comparisons.

---

## TL;DR

- Collect one‑off local windows (date + start hour + duration).
- Convert to UTC on write; store UTC instants and `tstzrange` for overlap.
- Match via SQL `&&` on `availability_once` (GiST), fallback to Python if needed.
- Render results in each user’s local time. No recurrence logic required.

