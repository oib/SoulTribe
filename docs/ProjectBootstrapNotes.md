### Project Bootstrap Notes — SoulTribe.chat

This TXT is read by Windsurf to bootstrap programming for **SoulTribe.chat**.
Keep it concise and executable.

---

## 1) Environment & Domains

* APP_BASE_URL = https://soultribe.chat
* API_BASE_PATH = /api
* JITSI_BASE = https://jitsi.soultribe.chat  # reverse proxy to your Jitsi
* DATABASE_URL = postgresql://soultribe:***@localhost:5432/soultribe
* SECRET_KEY = (openssl rand -hex 32)
* DEFAULT_TZ = UTC

---

## 2) MVP Scope (from other chats)

* Pure astrology matching.
* Registration collects: birth date, birth time (optional), birth location, primary & secondary language.
* When a match is fixed, show a Jitsi link.
* Ephemeris stored in PostgreSQL **1950–2050** (expandable).
* Each user gets a **radix (birth chart) record** computed from ephemeris.

---

## 3) Database Schema (MVP)

### 3.1 Core tables

```sql
-- users
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  email_verified_at TIMESTAMPTZ
);

-- profiles
CREATE TABLE profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  birth_dt_utc TIMESTAMPTZ,           -- if time unknown, store noon UTC
  birth_time_known BOOLEAN DEFAULT FALSE,
  birth_place_name TEXT,
  birth_lat NUMERIC(9,6),
  birth_lon NUMERIC(9,6),
  birth_tz TEXT,                      -- IANA TZ at birthplace/time
  lang_primary TEXT,
  lang_secondary TEXT
);

-- ephemeris (daily)
CREATE TABLE ephemeris (
  day DATE NOT NULL,
  body TEXT NOT NULL,                 -- 'SUN','MOON','MERCURY','VENUS','MARS','JUPITER','SATURN'
  lon_deg NUMERIC(7,4) NOT NULL,      -- 0..360
  lat_deg NUMERIC(7,4) NULL,
  speed NUMERIC(9,5) NULL,
  PRIMARY KEY (day, body)
);
CREATE INDEX ephem_day_idx ON ephemeris(day);
CREATE INDEX ephem_body_idx ON ephemeris(body);

-- radix snapshot per user (computed once + recalculable)
CREATE TABLE radix (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ref_dt_utc TIMESTAMPTZ NOT NULL,    -- same as birth_dt_utc (normalized)
  method TEXT DEFAULT 'noon-fallback',
  json JSONB NOT NULL                 -- see 3.2 structure
);

-- matches (pairing + score)
CREATE TABLE matches (
  id BIGSERIAL PRIMARY KEY,
  a_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score_numeric INT NOT NULL,
  score_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested', -- suggested|pending|accepted|declined
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(a_user_id, b_user_id)
);

-- meetups (proposal/confirm + Jitsi)
CREATE TABLE meetups (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  proposed_dt_utc TIMESTAMPTZ,
  confirmed_dt_utc TIMESTAMPTZ,
  jitsi_room TEXT,
  status TEXT NOT NULL DEFAULT 'proposed' -- proposed|confirmed|cancelled
);

-- geo cache for geocoding/timezone results
CREATE TABLE geo_cache (
  name TEXT PRIMARY KEY,              -- "City, Country"
  lat NUMERIC(9,6),
  lon NUMERIC(9,6),
  tz TEXT,
  source TEXT
);
```

### 3.2 `radix.json` structure (compact)

```json
{
  "bodies": {
    "SUN": {"lon": 123.456},
    "MOON": {"lon": 78.901},
    "MERCURY": {"lon": 210.111},
    "VENUS": {"lon": 44.222},
    "MARS": {"lon": 355.333},
    "JUPITER": {"lon": 280.444},
    "SATURN": {"lon": 310.555}
  },
  "houses": null,
  "notes": "noon fallback used when birth time unknown"
}
```

---

## 4) Ephemeris Import (1950–2050)

* CSV columns: `day,body,lon_deg,lat_deg,speed`.
* Bodies: SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN.
* Load script: `scripts/load_ephemeris.py` (bulk insert; upsert on conflict).
* Indexes above support fast lookups.

---

## 5) Radix Generation (function spec)

* Input: `birth_dt_utc`, `birth_time_known`, `lat`, `lon`.
* Time unknown ⇒ set `birth_dt_utc` to **noon UTC** and mark method.
* For each body, interpolate from daily ephemeris (linear; Moon caution ok for MVP).
* Persist to `radix.json`.

---

## 6) Matching Algorithm (MVP decisions from other chat)

* Compare A vs B on: Sun↔Sun, Moon↔Moon, Sun↔Moon (both directions).
* Secondary bonus: Venus↔Mars (both directions), Suns share same element.
* Aspects considered; orbs & weights:

  * Conjunction 0°: +8
  * Sextile 60°: +6
  * Square 90°: −8
  * Trine 120°: +9
  * Opposition 180°: −7
  * Orb: ±6° for Sun/Moon, ±4° for others; else 0.
* Unknown birth time ⇒ halve Moon-related weights.
* Language bonus: +10 if primary equal; +4 if secondary equal (cumulative).
* Output: `score_numeric 0–100`, `score_json` with breakdown.

---

## 7) API Routes

```
POST   /api/auth/register         {email, password}
POST   /api/auth/login            {email, password}
PUT    /api/profile               {...birth*, languages}
POST   /api/match/find            → [{user_id, score, why}]
POST   /api/meetup/propose        {match_id, proposed_dt_utc}
POST   /api/meetup/confirm        {meetup_id} → {jitsi_url}
GET    /api/health
```

### Jitsi room generation (deterministic, no PII)

* `room = 'soultribe_' + base32( sha256(match_id || confirmed_dt_utc || SECRET_KEY) )[0:16]`
* URL: `${JITSI_BASE}/${room}`

---

## 8) Windsurf Task Order (do in this order)

1. Scaffold FastAPI app + `/api/health`.
2. Wire PostgreSQL + create tables above.
3. Auth (argon2) + session/JWT minimal.
4. Profile update endpoint + basic HTML form.
5. Ephemeris loader + seed a tiny sample for tests; full 1950–2050 later.
6. `services/ephem.py` (daily interpolation) + `services/radix.py`.
7. `services/scoring.py` implementing MVP weights/orbs.
8. `/api/match/find` naive (all others); later: pagination & rate limits.
9. Meetup propose/confirm + Jitsi room generator.
10. Nginx + systemd unit in `ops/` for prod.

---

## 9) Rate Limits & Privacy (MVP)

* `/api/match/find`: 10 req/min/user; 30 req/min/IP (DB counters ok for MVP).
* Email verification required before matching.
* Self-serve delete exports JSON then deletes after 30 days.

---

## 10) Ephemeris Source & Geo/Timezone

* Geocoding: Nominatim → cache in `geo_cache`.
* Timezone: timezonefinder (IANA TZ id) → store in `profiles.birth_tz`.

---

## 11) Definition of Done (MVP)

A new user can register → fill profile → see at least one match with a numeric score → propose & confirm a meetup → open a working Jitsi link.
