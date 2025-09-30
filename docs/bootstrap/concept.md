# AstroMatch.org — Comprehensive Product Concept

## 1) Overview

**AstroMatch** is a privacy‑first platform for dating and friendship that connects people exclusively through **astrological compatibility**. Its purpose is to move matches quickly from discovery to a **scheduled meeting** and automatically provide a secure **Jitsi video room** once confirmed.

---

## 2) Goals

1. Deliver high‑quality, meaningful astrological matches.
2. Reduce chat fatigue by encouraging fast scheduling of meetings.
3. Guarantee a smooth video experience with automatic Jitsi room generation.
4. Protect user privacy with minimal data collection and explicit consent.

---

## 3) User Journey

### 3.1 Registration & Onboarding

1. Select intent: Dating, Friendship, or Both.
2. Required fields: **Birth date** and **Birth location** (city, country). Birth time optional, with confidence level.
3. Required fields: **Primary and secondary language** (ISO‑639‑1 codes; suggestions from device language).
4. Email verification (magic link) or passwordless OTP.
5. Preferences: age range, distance, gender of interest.
6. Privacy settings: exact birth details hidden by default.

### 3.2 Matching

1. Generate natal chart (Sun, Moon, Ascendant, personal planets, houses, aspects).
2. Compute and rank candidates regularly by synastry score.
3. Provide a curated list of 1–5 top matches per day or week.
4. Show concise compatibility highlights, e.g., “Strong emotional resonance (Moon trine Moon)” or “Potential communication challenge (Mercury square Mercury)”.

### 3.3 Scheduling

1. When both users like each other, they each propose **3 time slots**.
2. A mini‑scheduler displays overlaps and, optionally, astrologically favorable times (traffic‑light colors: green/yellow/red).
3. Once a slot is confirmed, generate a secure room at **[https://jitsi.bubuit.net](https://jitsi.bubuit.net)** using `astromatch-${randomId}` and store the URL on the meeting.
4. Users receive a calendar file (.ics), email reminders, and in‑app notifications.

### 3.4 Jitsi Call

1. Ten minutes before the meeting, a prominent “Join” button appears.
2. The Jitsi room uses a random name and lobby mode for security.
3. After the call: users provide quick feedback (“Met? Vibe? Continue?”).

---

## 4) Key Screens (MVP)

1. **Landing Page**: Value proposition, screenshots, and call‑to‑action.
2. **Onboarding Wizard**: Birth data, location, languages, preferences, and verification.
3. **Match Overview**: Cards with compatibility highlights.
4. **Profile View**: Photos (optional), short bio, placements, and compatibility summary.
5. **Scheduler**: Propose/confirm → Jitsi link.
6. **Call Lobby**: Countdown and Join button.
7. **Settings/Privacy**: Visibility controls, block/report options.
8. **Admin Panel**: Moderation, abuse management, and match quality metrics.

---

## 5) Data Model (High‑Level)

**User**

* id (UUID)
* email (unique, verified)
* intent: enum {dating, friendship, both}
* birth\_date (REQUIRED)
* birth\_time (nullable), time\_confidence (exact/approx/unknown)
* birth\_place\_id (FK → Place, REQUIRED)
* geo\_home (lat, lng, country, locality)
* primary\_language (ISO‑639‑1, REQUIRED)
* secondary\_language (ISO‑639‑1, REQUIRED)
* preferences: age\_min, age\_max, max\_distance\_km, gender\_target\[]
* privacy\_flags: hide\_birth\_time, hide\_location\_precision
* photos\[]
* bio (short text)
* onboarding\_completed\_at, last\_active\_at, created\_at

**Place**

* id, name, country\_code
* lat, lng
* tz\_database\_name (IANA)

**Chart**

* user\_id
* placements (JSONB)
* aspects (JSONB)
* computed\_at

**Radix**

* id
* user\_id (FK → User)
* chart\_id (FK → Chart)
* houses (JSONB)
* angles (ASC, MC, IC, DSC degrees)
* dominant\_signs (JSONB)
* dominant\_planets (JSONB)
* computed\_at

**Match**

* id
* user\_a\_id, user\_b\_id
* synastry\_score (0–100), rationale (3 pros/3 cons)
* status {suggested, liked\_one\_side, mutual\_like, scheduling, scheduled, completed, cancelled}
* timestamps

**Meeting**

* id, match\_id
* proposals\_a\[], proposals\_b\[]
* fixed\_start\_at, fixed\_end\_at
* jitsi\_room\_name, jitsi\_url, lobby\_enabled
* reminder\_sent

**AbuseReport**

* id
* reporter\_id, reported\_user\_id
* reason, details, created\_at, status

---

## 6) Technical Stack & Integration (Guidance for Developers)

**Frontend**

* Framework: Next.js (React) with TypeScript; Tailwind CSS for styling.
* i18n: simple JSON dictionaries; languages aligned with user primary/secondary.
* State/query: React Query (server cache) + Zustand or Context for UI state.
* Timezones: Day.js or Luxon; always display local user time.

**Backend**

* Option A (Python): FastAPI + Pydantic models; Uvicorn/Gunicorn.
* Option B (Node): NestJS + TypeScript; class‑validator.
* Background jobs: Celery/RQ (Python) or BullMQ (Node) for chart compute, batch matching, reminders.
* Auth: passwordless magic links (signed tokens), rate‑limited.

**Database & Cache**

* PostgreSQL as primary DB (JSONB for placements/aspects).
* Redis for queues, sessions, and short‑lived tokens.

**Astrology & Geo**

* Ephemeris: Swiss Ephemeris (pyswisseph/swisseph) for accurate charts.
* Geo: geocoding (city → lat/lng) and IANA timezone lookup; store tz name on Place.

**Scheduling & Calendar**

* All times stored in UTC; convert on client.
* Generate `.ics` invites (VEVENT) and email with 24h/10m reminders.

**Jitsi Integration**

* Base URL: `https://jitsi.bubuit.net` (existing self‑hosted instance).
* Room naming: `astromatch-${randomId}`; lobby enabled by default.
* Create rooms only when a slot is confirmed; share URL with both users.
* Optional JWT later to restrict access to scheduled participants.

**Notifications**

* Email via SMTP (transactional provider or Postfix relay).
* In‑app notifications; push later via Web Push.

**Infrastructure**

* Dockerized services; Nginx reverse proxy; Let’s Encrypt certificates.
* Object storage (S3‑compatible) for photos with presigned upload URLs.
* Backups: nightly Postgres dumps + object storage lifecycle rules.

**Security**

* Rate limiting on auth and scheduling.
* Content moderation endpoints and audit logging for admin actions.

---

## 7) Copy & UX Notes

* Tone: warm, welcoming, slightly mystical, not overly esoteric.
* Compatibility phrasing: not deterministic “impossible,” but “areas to explore.”
* Privacy: only necessary data visible by default.
* Registration: clear labels for birth date/location and language selection; auto‑complete for languages.

---

## 8) Acceptance Criteria (MVP)

* Registration requires: **Birth date**, **Birth location**, **Primary and secondary language**.
* Birth time optional; charts can be calculated with default time if missing.
* After onboarding: at least three matches available (seed data).
* Scheduling and Jitsi link generation function reliably.
* Jitsi room accessible on desktop and mobile; lobby active.
* Block/report available; admins can intervene.

---

## 9) Security & Privacy

* GDPR‑compliant: export and delete options available.
* No audio/video stored.
* Database backups encrypted.
* Jitsi rooms randomly named; lobby enabled by default.

---

## 10) Roadmap

**MVP (4–6 weeks)**

* Onboarding and chart calculation.
* Synastry scoring and match list.
* Scheduling and Jitsi link generation.
* Reminders and admin tools.

**V1.1**

* Transit overlay in calendar.
* Multilingual UI (EN/DE/ES).
* In‑app chat limited to scheduling context.

**V1.2**

* Seasonal group events.
* Real‑life meetup suggestions based on location.

---

## 11) Success Metrics

* Onboarding completion rate.
* Mutual like rate.
* Average time to scheduled meeting.
* Jitsi join rate.
* Positive feedback after calls.

---

## 12) Deployment on Your Stack (bubu / Debian 12)

**Runtime & Topology**

* Host: Debian 12 with Nginx reverse proxy + Certbot (Let’s Encrypt) on the host.
* App: LXC container `astromatch` running FastAPI (Uvicorn) behind Nginx.
* DB: PostgreSQL service (same container or dedicated DB container), daily dumps.
* Cache/Queue: Redis for sessions, rate limits, reminders.
* Video: Existing Jitsi at `https://jitsi.bubuit.net` with lobby enabled.

**Systemd Service (summary)**

* `astromatch.service` runs Uvicorn (e.g., 127.0.0.1:8010) inside the container.
* Log to journald; restart=always; environment via `/etc/astromatch/env`.

**Nginx (host)**

* Server block for `astromatch.org` terminates TLS and proxies to container IP\:port.
* Include standard security headers; gzip/brotli; large client body for photo uploads.

**Backups & Monitoring**

* Nightly `pg_dump` + object storage lifecycle.
* Health endpoints `/healthz` and `/readiness`.
* Basic metrics: request count, match creation, meeting confirmations.

**Email**

* Outbound via SMTP relay; SPF/DKIM/DMARC aligned on sending domain.

**Secrets & Config**

* `.env` or systemd environment file; separate keys for chart engine and JWT (if used for Jitsi later).

**Rollout**

* Blue/green by container image tag; database migrations gated.

---

## 13) Open Items to Align with Other Chats

1. Confirm container name and port (proposed: `astromatch`, 8010).
2. Decide whether to colocate Postgres or run a dedicated DB container.
3. Verify email relay domain and credentials.
4. Define rate limits (likes/day, proposals/day) and abuse thresholds.
5. Language support at launch (EN/DE/ES) and translation workflow.
