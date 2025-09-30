# SoulTribe Matchmaking & Jitsi Scheduling — Guide

This document was moved from `dev/bootstrap/matchmaking.txt` and kept intact for reference.

---

# SoulTribe Matchmaking & Jitsi Scheduling — Windsurf Guide (TXT)

## 0) Goal

Build a flow where:

1. A deterministic **match score** is computed for two users.
2. If the score ≥ 50, an **AI comment** about the match is generated via **Open-WebUI API** and displayed on the match page.
3. Each user sets **time windows** of availability.
4. The system finds **overlapping windows**; when found, both users are notified with a **Jitsi link** in the form `https://jitsi.bubuit.net/<ROOM_TOKEN>`.
5. The `<ROOM_TOKEN>` is **saved** and attached to the unique match.
6. A **batch script** can be run to evaluate **all pairs of users**, calculate their radix synastry, send it to Open-WebUI, and persist the reply in DB.

---

## 1) Minimal Data Model (PostgreSQL)

### 1.1 Tables

* `users`

  * `id` (pk)
  * `display_name` text
  * `birth_ts` timestamptz
  * `birth_place` text
  * `lang_primary` text
  * `lang_secondary` text   — nullable
  * `tz` text
  * `radix_json` jsonb      — cached radix/natal chart for user
  * `created_at` timestamptz

* `matches`

  * `id` (pk)
  * `user_a_id` (fk users)
  * `user_b_id` (fk users)
  * `score` int              — 0..100
  * `score_vector` jsonb
  * `ai_comment` text        — AI summary/comment
  * `ai_model` text
  * `ai_updated_at` timestamptz
  * `status` text            — 'hidden' (score<50) | 'visible' (score≥50)
  * `created_at` timestamptz

* `pairwise_ai_evals`

  * `id` (pk)
  * `user_a_id` bigint (fk users)
  * `user_b_id` bigint (fk users)
  * `pair_key` text unique   — `minId_maxId`
  * `score` int              — 0..100
  * `score_vector` jsonb
  * `ai_reply` text          — full OpenWebUI text reply
  * `ai_model` text
  * `eval_lang` text
  * `created_at` timestamptz
  * `updated_at` timestamptz

* `batch_logs`

  * `id` (pk)
  * `pair` text              — e.g., "userA-userB"
  * `started_at` timestamptz
  * `finished_at` timestamptz
  * `status` text            — 'ok' | 'error'
  * `error_msg` text nullable

* `availability_slots` … (unchanged)

* `match_sessions` … (unchanged)

* `notifications` … (unchanged)

### 1.2 Indices

* `matches(user_a_id, user_b_id)` unique (sorted ids)
* `pairwise_ai_evals(pair_key)` unique

---

## 2) Batch Script: Pairwise Evaluation

A standalone Python script (e.g. `batch_eval_matches.py`) will:

1. Pull all active `users`.
2. Iterate over all unique pairs `(userA, userB)`.
3. For each pair:

   * Compute or retrieve `radix_json` for both.
   * Call `calc_match(userA, userB)` using stored radices.
   * Store/update a row in `matches` with `score`, `vector`, `status`.
   * Call Open-WebUI and **always** persist the AI reply in `pairwise_ai_evals`.
   * If `score ≥ 50`, mirror the AI reply also into `matches.ai_comment`.
   * Log run in `batch_logs`.

### 2.1 Pseudo-code

```python
users = get_all_users()
for i, ua in enumerate(users):
    for ub in users[i+1:]:
        log_id = log_batch.start(ua.id, ub.id)
        try:
            ua = ensure_radix(ua)
            ub = ensure_radix(ub)

            res = calc_match(ua, ub)
            status = upsert_match(ua.id, ub.id, res)

            txt = openwebui_comment(res, ua, ub, lang=pick_lang(ua, ub))
            upsert_pairwise_ai(ua.id, ub.id, res, txt)

            if status == "visible":
                update_match_ai(ua.id, ub.id, txt)

            log_batch.finish(log_id, status="ok")
        except Exception as e:
            log_batch.finish(log_id, status="error", error_msg=str(e))
```

### 2.2 Scheduling

* Run nightly via cron or systemd timer.
* Ensures all pairs are refreshed and all AI replies are stored.

---

## 3) AI Match Comment (Open-WebUI)

* Generated for every pair and stored in `pairwise_ai_evals`.
* For `matches`, only shown if `score ≥ 50`.
* Prompt includes `radix_json` (natal chart data) from both users as hidden context.
* Visible result: **AI comment text only** (no score, no stars).

---

## 4) Page Integration (Match Page)

* Page shown **only if match.status = 'visible'**.
* Display: AI comment, availability editor, Jitsi link (if overlap exists).

---

## 5) Background Scheduler

* Batch script refreshes all matches nightly.
* Overlap detection runs only for visible matches.

---

## 6) Env Config (example)

```
APP_ENV=dev
DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/soultribe

OPENWEBUI_BASE_URL=https://openwebui.local
OPENWEBUI_API_KEY=sk-xxxx
OPENWEBUI_MODEL=gemma2:9b

JITSI_BASE_URL=https://jitsi.bubuit.net
MIN_MEET_MINUTES=30
OVERLAP_LOOKAHEAD_DAYS=21
MATCH_MIN_SCORE=50
```

---

## 7) Done Criteria

* Batch script can be run to evaluate **all pairs** and update DB.
* Matches < 50 hidden.
* Matches ≥ 50 visible with **AI comment only**.
* AI reply for **all pairs** stored in `pairwise_ai_evals`.
* Batch results logged in `batch_logs`.
* Availability & Jitsi scheduling works only for visible matches.
