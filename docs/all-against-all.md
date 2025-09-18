Got it. Here’s a concrete, copy-pasteable setup:

# 1) SQL — table to store “all-against-all” AI replies

```sql
-- pairwise_ai_evals: stores the OpenWebUI reply for EVERY user pair (visible or hidden)
CREATE TABLE IF NOT EXISTS pairwise_ai_evals (
  id               bigserial PRIMARY KEY,
  user_a_id        bigint NOT NULL REFERENCES users(id),
  user_b_id        bigint NOT NULL REFERENCES users(id),
  pair_key         text   NOT NULL,  -- 'minId_maxId' for idempotency
  score            integer,          -- 0..100 (internal)
  score_vector     jsonb,            -- internal breakdown
  ai_reply         text,             -- full OpenWebUI text reply
  ai_model         text,
  eval_lang        text,             -- e.g., 'en'
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Unique per unordered pair (min/max)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pairwise_ai_pair_key ON pairwise_ai_evals(pair_key);

-- You can keep matches as your UI-facing table; it remains the “gate” (≥ 50 visible).
-- Ensure matches has a unique constraint for unordered pairs:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_matches_pair'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uq_matches_pair
             ON matches (LEAST(user_a_id, user_b_id), GREATEST(user_a_id, user_b_id));';
  END IF;
END$$;
```

# 2) Batch script (Python) — evaluates all pairs, waits for OpenWebUI reply, writes to DB

* Location: `/root/scripts/soultribe/batch_pair_eval.py`
* Behavior:

  * Pulls all users.
  * Ensures `users.radix_json` is present (you can wire your existing ephemeris call in `ensure_radix()`).
  * Calculates score & vector.
  * **Writes**:

    * `matches` (status `hidden` if score < 50, `visible` if ≥ 50).
    * `pairwise_ai_evals` (always stores the OpenWebUI reply for the pair, as requested).
  * Resumable/idempotent via `pair_key`.

```python
#!/usr/bin/env python3
# Script Version: 01
# Batch: pairwise evaluation with OpenWebUI comment persistence

import os, json, time, itertools, math
from datetime import datetime, timezone
import psycopg
import requests

DB_URL             = os.getenv("DATABASE_URL", "postgresql+psycopg://user:pass@127.0.0.1:5432/soultribe").replace("+psycopg","")
OPENWEBUI_BASE_URL = os.getenv("OPENWEBUI_BASE_URL", "http://127.0.0.1:3000")
OPENWEBUI_API_KEY  = os.getenv("OPENWEBUI_API_KEY", "")
OPENWEBUI_MODEL    = os.getenv("OPENWEBUI_MODEL", "gemma2:9b")
MATCH_MIN_SCORE    = int(os.getenv("MATCH_MIN_SCORE", "50"))
RATE_DELAY_SEC     = float(os.getenv("OPENWEBUI_RATE_DELAY_SEC", "0.8"))  # gentle pacing

def log(msg):
    print(f"[{datetime.now().isoformat(timespec='seconds')}] {msg}")

def fetch_users(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, display_name, birth_ts, birth_place, lang_primary, lang_secondary, tz, radix_json
            FROM users
            ORDER BY id ASC
        """)
        rows = cur.fetchall()
    return [
        dict(id=r[0], display_name=r[1], birth_ts=r[2], birth_place=r[3],
             lang_primary=r[4], lang_secondary=r[5], tz=r[6], radix_json=r[7])
        for r in rows
    ]

def ensure_radix(conn, user):
    """Plug your ephemeris build here. If radix_json is null, compute and store."""
    if user["radix_json"] is not None:
        return user
    # TODO: populate via Swiss Ephemeris / your pipeline
    fake = {"planets": {}, "houses": {}, "meta": {"computed": True}}
    with conn.cursor() as cur:
        cur.execute("UPDATE users SET radix_json=%s WHERE id=%s", (json.dumps(fake), user["id"]))
    user["radix_json"] = fake
    return user

def calc_match(user_a, user_b):
    """Replace with your real synastry. Returns {'score': int, 'vector': {...}}"""
    # Placeholder scoring; implement real logic using user_a["radix_json"], user_b["radix_json"]
    # Normalize to 0..100
    score = 57  # dummy deterministic placeholder
    vector = {"sun": 0.6, "moon": 0.55, "asc": 0.5, "venus_mars": 0.65, "element_balance": 0.52, "house_overlays": 0.58}
    return {"score": score, "vector": vector}

def pick_lang(ua, ub):
    return ua["lang_primary"] or ub["lang_primary"] or "en"

def openwebui_comment(res, ua, ub, lang="en"):
    """Calls OpenWebUI and returns text reply (single string)."""
    url = f"{OPENWEBUI_BASE_URL}/v1/chat/completions"
    headers = {"Content-Type":"application/json"}
    if OPENWEBUI_API_KEY:
        headers["Authorization"] = f"Bearer {OPENWEBUI_API_KEY}"

    system = (
        "You write concise, friendly, non-cringe match summaries based on astrological factors. "
        "Do not mention numeric scores or star ratings. No therapy, no medical or legal advice."
    )
    user_prompt = (
        f"Two users were matched with synastry metrics.\n"
        f"Return one short paragraph (max 90 words) and a 3-bullet strengths list.\n"
        f"Language: {lang}\n\n"
        f"Factors (0..1):\n"
        f"- Sun relation: {res['vector'].get('sun', 0)}\n"
        f"- Moon relation: {res['vector'].get('moon', 0)}\n"
        f"- Asc relation: {res['vector'].get('asc', 0)}\n"
        f"- Venus/Mars chemistry: {res['vector'].get('venus_mars', 0)}\n"
        f"- Element balance: {res['vector'].get('element_balance', 0)}\n"
        f"- House overlays: {res['vector'].get('house_overlays', 0)}\n\n"
        f"Names: {ua['display_name']} & {ub['display_name']}\n"
        f"(Additional hidden context may exist server-side.)"
    )

    payload = {
        "model": OPENWEBUI_MODEL,
        "messages": [
            {"role":"system","content": system},
            {"role":"user","content": user_prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 500
    }
    r = requests.post(url, headers=headers, data=json.dumps(payload), timeout=120)
    r.raise_for_status()
    data = r.json()
    # OpenAI-compatible shape:
    txt = data["choices"][0]["message"]["content"].strip()
    return txt

def upsert_matches(conn, ua_id, ub_id, res):
    status = "visible" if res["score"] >= MATCH_MIN_SCORE else "hidden"
    with conn.cursor() as cur:
        # Using LEAST/GREATEST to keep pairs canonical
        cur.execute("""
            INSERT INTO matches (user_a_id, user_b_id, score, score_vector, status, created_at)
            VALUES (LEAST(%s,%s), GREATEST(%s,%s), %s, %s, %s, now())
            ON CONFLICT (LEAST(user_a_id, user_b_id), GREATEST(user_a_id, user_b_id))
            DO UPDATE SET
              score        = EXCLUDED.score,
              score_vector = EXCLUDED.score_vector,
              status       = EXCLUDED.status,
              ai_updated_at = CASE 
                                WHEN matches.ai_comment IS NOT NULL THEN matches.ai_updated_at
                                ELSE matches.ai_updated_at
                              END
        """, (ua_id, ub_id, ua_id, ub_id, res["score"], json.dumps(res["vector"]), status))
    return status

def upsert_pairwise_ai(conn, ua_id, ub_id, res, ai_text, model, lang):
    key = f"{min(ua_id, ub_id)}_{max(ua_id, ub_id)}"
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO pairwise_ai_evals (user_a_id, user_b_id, pair_key, score, score_vector, ai_reply, ai_model, eval_lang, created_at, updated_at)
            VALUES (LEAST(%s,%s), GREATEST(%s,%s), %s, %s, %s, %s, %s, now(), now())
            ON CONFLICT (pair_key) DO UPDATE
            SET score=%s,
                score_vector=%s,
                ai_reply=%s,
                ai_model=%s,
                eval_lang=%s,
                updated_at=now()
        """, (
            ua_id, ub_id, ua_id, ub_id, key,
            res["score"], json.dumps(res["vector"]), ai_text, model, lang,
            res["score"], json.dumps(res["vector"]), ai_text, model, lang
        ))

def main():
    log("[DEBUG] starting batch_pair_eval")
    with psycopg.connect(DB_URL, autocommit=True) as conn:
        users = fetch_users(conn)
        log(f"[DEBUG] users loaded: {len(users)}")
        for ua, ub in itertools.combinations(users, 2):
            ua = ensure_radix(conn, ua)
            ub = ensure_radix(conn, ub)

            res = calc_match(ua, ub)
            status = upsert_matches(conn, ua["id"], ub["id"], res)

            # Always store AI reply in pairwise_ai_evals (as requested)
            lang = pick_lang(ua, ub)
            try:
                ai_text = openwebui_comment(res, ua, ub, lang=lang)
            except Exception as e:
                log(f"[DEBUG] OpenWebUI error for pair {ua['id']}-{ub['id']}: {e}")
                ai_text = "[AI unavailable at this time]"

            upsert_pairwise_ai(conn, ua["id"], ub["id"], res, ai_text, OPENWEBUI_MODEL, lang)

            # Optional: If you want to mirror AI comment into matches only for visible pairs
            if status == "visible" and ai_text and ai_text != "[AI unavailable at this time]":
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE matches
                           SET ai_comment=%s, ai_model=%s, ai_updated_at=now()
                         WHERE user_a_id=LEAST(%s,%s)
                           AND user_b_id=GREATEST(%s,%s)
                    """, (ai_text, OPENWEBUI_MODEL, ua["id"], ub["id"], ua["id"], ub["id"]))

            log(f"[DEBUG] pair {ua['id']}-{ub['id']} processed (score={res['score']} status={status})")
            time.sleep(RATE_DELAY_SEC)

if __name__ == "__main__":
    main()
```

# 3) Minimal Zsh wrapper (optional)

`/root/scripts/soultribe/run_batch_pair_eval.sh`

```bash
#!/usr/bin/env bash
# Script Version: 01
set -euo pipefail

export DATABASE_URL="postgresql+psycopg://user:pass@127.0.0.1:5432/soultribe"
export OPENWEBUI_BASE_URL="http://127.0.0.1:3000"
export OPENWEBUI_API_KEY=""   # if needed
export OPENWEBUI_MODEL="gemma2:9b"
export MATCH_MIN_SCORE="50"
export OPENWEBUI_RATE_DELAY_SEC="0.8"

python3 /root/scripts/soultribe/batch_pair_eval.py
```

# 4) (Optional) systemd unit + timer

`/etc/systemd/system/soultribe-batch-eval.service`

```
[Unit]
Description=SoulTribe Pairwise Match Batch

[Service]
Type=oneshot
ExecStart=/root/scripts/soultribe/run_batch_pair_eval.sh
WorkingDirectory=/root/scripts/soultribe
User=root
Group=root
```

`/etc/systemd/system/soultribe-batch-eval.timer`

```
[Unit]
Description=Run SoulTribe Pairwise Match Batch nightly

[Timer]
OnCalendar=*-*-* 03:27:00
Persistent=true
Unit=soultribe-batch-eval.service

[Install]
WantedBy=timers.target
```

Enable:

```bash
systemctl daemon-reload
systemctl enable --now soultribe-batch-eval.timer
systemctl list-timers | grep soultribe-batch-eval
```

---

## Notes

* Frontend still **does not** show scores or stars. Visibility remains controlled by `matches.status` (≥ 50 → visible).
* The **research/analysis** table is now `pairwise_ai_evals`, which **always** stores the OpenWebUI text reply for every pair, as you requested.
* `matches` remains the UI-facing, deduplicated pair table used by scheduling/notifications.
