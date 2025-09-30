#!/usr/bin/env python3
# Script Version: 01
"""
Compute radix snapshot with pyswisseph and push into Postgres via upsert_user_radix_snapshot().
This is the small-profile mode: no global ephemeris, compute once per account.
"""

import os
import psycopg2
import json
import swisseph as swe
import datetime as dt

DB_DSN = os.environ.get("EPHEM_DSN", "dbname=postgres user=postgres host=127.0.0.1")

# Example: compute for 1990-04-12 14:35 in Vienna
BIRTH_DATE = dt.date(1990, 4, 12)
BIRTH_TIME = dt.time(14, 35)
LAT = 48.210033
LON = 16.363449
TZ = "Europe/Vienna"
LOCATION = "Vienna, Austria"
USER_ID = 42

# which bodies to compute
BODIES = {
    0: swe.SUN,
    1: swe.MOON,
    2: swe.MERCURY,
    3: swe.VENUS,
    4: swe.MARS,
    5: swe.JUPITER,
    6: swe.SATURN,
    7: swe.URANUS,
    8: swe.NEPTUNE,
    9: swe.PLUTO,
}

def jd_from_datetime(dt_obj):
    return swe.julday(dt_obj.year, dt_obj.month, dt_obj.day,
                      dt_obj.hour + dt_obj.minute/60.0 + dt_obj.second/3600.0,
                      swe.GREG_CAL)

# convert birth date+time to UTC naive datetime
ts = dt.datetime.combine(BIRTH_DATE, BIRTH_TIME)
jd_ut = jd_from_datetime(ts)

positions = []
for bid, sweid in BODIES.items():
    lon, lat, dist = swe.calc_ut(jd_ut, sweid)[0:3]
    positions.append({
        "body_id": bid,
        "lon_deg": round(lon % 360, 6),
        "lat_deg": round(lat, 6),
        "dist_au": round(dist, 9),
        "speed_lon_d": None,
        "house_num": None
    })

# houses (Placidus example)
ascmc, cusps = swe.houses(jd_ut, LAT, LON, b'P')
houses = []
for i in range(1,13):
    houses.append({"system":"Placidus","house_num":i,"cusp_deg":round(cusps[i-1],6)})

# aspects (naive example: only Sun-Moon conjunction within 10°)
aspects = []
sun = positions[0]["lon_deg"]
moon = positions[1]["lon_deg"]
orb = abs((sun - moon + 180) % 360 - 180)
if orb <= 10:
    aspects.append({"a_body_id":0,"b_body_id":1,"aspect":"conjunction","orb_deg":orb,"exact":orb < 1.0})

# connect to DB and call function
conn = psycopg2.connect(DB_DSN)
cur = conn.cursor()
cur.execute("""
    SELECT upsert_user_radix_snapshot(
      %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
    )
""", (
    USER_ID,
    BIRTH_DATE,
    BIRTH_TIME,
    LOCATION,
    LAT,
    LON,
    TZ,
    'Placidus',
    json.dumps(positions),
    json.dumps(houses),
    json.dumps(aspects),
    json.dumps({"positions":positions,"houses":houses,"aspects":aspects})
))
new_id = cur.fetchone()[0]
conn.commit()
cur.close()
conn.close()

print(f"Inserted radix_id={new_id}")

-- ================================================================
-- Python backend snippet (pyswisseph → upsert_user_radix_snapshot)
-- Save as: backend/create_radix_snapshot.py
-- Requires: pip install pyswisseph psycopg2-binary pytz
-- Run: EPHEM_DSN='dbname=postgres user=postgres host=127.0.0.1' \
--      python3 backend/create_radix_snapshot.py
-- ================================================================
# Script Version: 01
# Compute positions, houses, and aspects once at signup and persist to DB.

python_code = r"""
import os, json, math
import datetime as dt
import pytz
import psycopg2
import swisseph as swe

DSN = os.environ.get('EPHEM_DSN', 'dbname=postgres user=postgres host=127.0.0.1')
SE_EPHE_PATH = os.environ.get('SE_EPHE_PATH')  # optional

# Bodies mapping must match astro_body IDs
BODIES = [
    (0, swe.SUN), (1, swe.MOON), (2, swe.MERCURY), (3, swe.VENUS), (4, swe.MARS),
    (5, swe.JUPITER), (6, swe.SATURN), (7, swe.URANUS), (8, swe.NEPTUNE), (9, swe.PLUTO)
]

ASPECTS = {
    'conjunction': 0.0,
    'sextile': 60.0,
    'square': 90.0,
    'trine': 120.0,
    'opposition': 180.0,
}
# Default max orb per aspect (deg)
ASPECT_ORBS = {
    'conjunction': 8.0,
    'sextile': 4.0,
    'square': 6.0,
    'trine': 6.0,
    'opposition': 8.0,
}

FLAGS = swe.FLG_SWIEPH | swe.FLG_SPEED  # Swiss Ephemeris, include speeds

if SE_EPHE_PATH:
    swe.set_ephe_path(SE_EPHE_PATH)


def to_jd_ut(ts_utc: dt.datetime) -> float:
    return swe.julday(ts_utc.year, ts_utc.month, ts_utc.day,
                      ts_utc.hour + ts_utc.minute/60.0 + ts_utc.second/3600.0,
                      swe.GREG_CAL)


def norm360(x: float) -> float:
    x = math.fmod(x, 360.0)
    return x + 360.0 if x < 0.0 else x


def angle_delta(a: float, b: float) -> float:
    # smallest signed difference b - a in degrees
    d = (b - a + 540.0) % 360.0 - 180.0
    return d


def detect_aspects(longitudes):
    aspects = []
    n = len(longitudes)
    for i in range(n):
        for j in range(i+1, n):
            a = longitudes[i][0]  # lon
            b = longitudes[j][0]
            d = abs(angle_delta(a, b))
            # map to 0..180
            if d > 180.0:
                d = 360.0 - d
            for name, exact in ASPECTS.items():
                orb = abs(d - exact)
                if orb <= ASPECT_ORBS[name]:
                    aspects.append({
                        'a_body_id': longitudes[i][1],
                        'b_body_id': longitudes[j][1],
                        'aspect': name,
                        'orb_deg': round(orb, 2),
                        'exact': orb < 0.01,
                    })
    return aspects


def compute_radix(birth_dt_local: dt.datetime, tz_name: str, lat_deg: float, lon_deg: float,
                   house_system: str = 'P'):
    # Convert local naive or aware dt to UTC aware
    if birth_dt_local.tzinfo is None:
        tz = pytz.timezone(tz_name)
        birth_dt_local = tz.localize(birth_dt_local)
    ts_utc = birth_dt_local.astimezone(pytz.UTC)
    jd_ut = to_jd_ut(ts_utc)

    # Planetary positions
    positions = []
    longitudes_for_aspects = []
    for body_id, swe_id in BODIES:
        lon, lat, dist, slon, slat, sdist = swe.calc_ut(jd_ut, swe_id, FLAGS)
        lon = norm360(lon)
        positions.append({
            'body_id': body_id,
            'lon_deg': round(lon, 6),
            'lat_deg': round(lat, 6),
            'dist_au': round(dist, 9),
            'speed_lon_d': round(slon, 6),
            # house_num filled after houses are computed
        })
        longitudes_for_aspects.append((lon, body_id))

    # Houses & angles (Placidus by default; use house_system char e.g. 'P','K','R','W')
    # Note: lon_deg East+, Swiss Ephemeris expects geographic longitude (East positive)
    cusps, ascmc = swe.houses(jd_ut, lat_deg, lon_deg, house_system.encode('ascii'))
    houses = []
    for i in range(12):
        houses.append({
            'system': 'Placidus' if house_system == 'P' else house_system,
            'house_num': i+1,
            'cusp_deg': round(norm360(cusps[i]), 6),
        })

    # Assign house numbers to bodies (simple method: which cusp segment contains the body)
    # Build 12 segments in order starting from house 1
    segments = [(norm360(cusps[i-1]), norm360(cusps[i])) for i in range(1, 12)] + [(norm360(cusps[11]), norm360(cusps[0]))]

    def house_of(lon):
        cur = norm360(lon)
        for idx, (a, b) in enumerate(segments, start=2):  # houses 2..12
            if a < b:
                if a <= cur < b:
                    return idx
            else:  # wrap across 360
                if cur >= a or cur < b:
                    return idx
        return 1  # fallback

    for p in positions:
        p['house_num'] = house_of(p['lon_deg'])

    # Aspects
    aspects = detect_aspects(longitudes_for_aspects)

    return positions, houses, aspects, ts_utc


def save_to_db(user_id: int, birth_date: dt.date, birth_time: dt.time, birth_location: str,
               lat: float, lon: float, tz_name: str, positions, houses, aspects, raw_json=None,
               system_label='Placidus'):
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT upsert_user_radix_snapshot(
            %(user_id)s, %(birth_date)s, %(birth_time)s, %(birth_location)s,
            %(lat)s, %(lon)s, %(tz)s, %(system)s,
            %(positions)s::jsonb, %(houses)s::jsonb, %(aspects)s::jsonb, %(raw_json)s::jsonb
        )
        """,
        {
            'user_id': user_id,
            'birth_date': birth_date,
            'birth_time': birth_time,
            'birth_location': birth_location,
            'lat': lat, 'lon': lon, 'tz': tz_name, 'system': system_label,
            'positions': json.dumps(positions),
            'houses': json.dumps(houses),
            'aspects': json.dumps(aspects),
            'raw_json': json.dumps(raw_json) if raw_json is not None else None,
        }
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close(); conn.close()
    return new_id


if __name__ == '__main__':
    # Example payload (Vienna): 1990-04-12 14:35 Europe/Vienna
    birth_local = dt.datetime(1990, 4, 12, 14, 35, 0)
    tz_name = 'Europe/Vienna'
    lat, lon = 48.210033, 16.363449
    positions, houses, aspects, ts_utc = compute_radix(birth_local, tz_name, lat, lon, house_system='P')

    new_id = save_to_db(
        user_id=42,
        birth_date=birth_local.date(),
        birth_time=birth_local.time(),
        birth_location='Vienna, Austria',
        lat=lat, lon=lon, tz_name=tz_name,
        positions=positions, houses=houses, aspects=aspects,
        raw_json={'computed_at_utc': ts_utc.isoformat()}
    )
    print(f'Inserted radix_id={new_id}')
"""


-- ================================================================
-- From other project chats → required additions for windsuf wiring
-- Context pulled in: registration requires birth date, location, primary & secondary language;
-- after a match fixes a date, provide a Jitsi link.
-- Below are minimal SQL + FastAPI endpoints to connect signup → radix snapshot → match scheduling.
-- ================================================================

-- File: db/users.sql (minimal users table referenced by user_radix.user_id)
-- Notes: extend with auth later (passwordless, OAuth, etc.).
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         citext UNIQUE,
  display_name  text,
  birth_date    date NOT NULL,
  birth_time    time,
  birth_location text NOT NULL,
  latitude      decimal(9,6),
  longitude     decimal(9,6),
  timezone      text NOT NULL,
  lang_primary  text NOT NULL,
  lang_secondary text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Helpful view: expose sign names for quick filters/matching
CREATE OR REPLACE VIEW v_user_radix_signs AS
SELECT r.user_id,
       b.name AS body,
       ub.sign AS sign_idx,
       CASE ub.sign
         WHEN 0 THEN 'Aries' WHEN 1 THEN 'Taurus' WHEN 2 THEN 'Gemini' WHEN 3 THEN 'Cancer'
         WHEN 4 THEN 'Leo' WHEN 5 THEN 'Virgo' WHEN 6 THEN 'Libra' WHEN 7 THEN 'Scorpio'
         WHEN 8 THEN 'Sagittarius' WHEN 9 THEN 'Capricorn' WHEN 10 THEN 'Aquarius' WHEN 11 THEN 'Pisces'
       END AS sign
FROM user_radix_body ub
JOIN user_radix r ON r.id = ub.radix_id
JOIN astro_body b ON b.id = ub.body_id;

-- Quick compatibility sketch (very simple: +2 for Sun sign match, +1 for Moon/Venus/Mars sign match)
CREATE OR REPLACE FUNCTION simple_match_score(p_user_a int, p_user_b int)
RETURNS int LANGUAGE sql STABLE AS $$
  WITH signs AS (
    SELECT user_id, body, sign_idx FROM v_user_radix_signs WHERE body IN ('Sun','Moon','Venus','Mars')
  ),
  a AS (SELECT body, sign_idx FROM signs WHERE user_id = p_user_a),
  b AS (SELECT body, sign_idx FROM signs WHERE user_id = p_user_b)
  SELECT COALESCE(SUM(CASE s.body
    WHEN 'Sun'   THEN CASE WHEN s.sign_idx = t.sign_idx THEN 2 ELSE 0 END
    ELSE CASE WHEN s.sign_idx = t.sign_idx THEN 1 ELSE 0 END
  END),0)
  FROM a s JOIN b t USING (body);
$$;

-- ================================================================
-- File: backend/api.py (FastAPI endpoints: signup → compute radix → store; Jitsi link builder)
-- Run: uvicorn backend.api:app --host 0.0.0.0 --port 8010
-- Requires: fastapi, uvicorn, psycopg2-binary, pyswisseph, pytz
-- ================================================================
# >>> backend/api.py >>>
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, EmailStr
import os, json, datetime as dt
import psycopg2
import pytz
import swisseph as swe

APP_DSN = os.environ.get('EPHEM_DSN','dbname=postgres user=postgres host=127.0.0.1')
JITSI_BASE = os.environ.get('JITSI_BASE','https://meet.jit.si')  # or your self-hosted instance

app = FastAPI(title='AstroMatch API')

class SignupIn(BaseModel):
    email: EmailStr | None = None
    display_name: str | None = None
    birth_date: dt.date
    birth_time: dt.time | None = None
    birth_location: str
    latitude: float
    longitude: float
    timezone: str = Field(examples=['Europe/Vienna'])
    lang_primary: str
    lang_secondary: str | None = None
    house_system: str = 'P'  # Placidus by default

class SignupOut(BaseModel):
    user_id: int
    radix_id: int

class MatchIn(BaseModel):
    user_a: int
    user_b: int

class MeetingIn(BaseModel):
    user_a: int
    user_b: int
    when_utc: dt.datetime  # ISO8601 UTC


def db():
    return psycopg2.connect(APP_DSN)


def _norm360(x: float) -> float:
    x = x % 360.0
    return x + 360.0 if x < 0 else x

BODIES = [(0, swe.SUN),(1, swe.MOON),(2, swe.MERCURY),(3, swe.VENUS),(4, swe.MARS),
          (5, swe.JUPITER),(6, swe.SATURN),(7, swe.URANUS),(8, swe.NEPTUNE),(9, swe.PLUTO)]
FLAGS = swe.FLG_SWIEPH | swe.FLG_SPEED


def compute_positions_houses(bd: dt.date, bt: dt.time | None, tzname: str, lat: float, lon: float, syschar: str):
    # local → UTC
    local = dt.datetime.combine(bd, bt or dt.time(12,0))
    tz = pytz.timezone(tzname)
    local = tz.localize(local)
    ts_utc = local.astimezone(pytz.UTC)
    jd_ut = swe.julday(ts_utc.year, ts_utc.month, ts_utc.day,
                       ts_utc.hour + ts_utc.minute/60 + ts_utc.second/3600, swe.GREG_CAL)

    positions, longitudes = [], []
    for bid, sid in BODIES:
        lon_deg, lat_deg, dist_au, slon, _, _ = swe.calc_ut(jd_ut, sid, FLAGS)
        lon_deg = _norm360(lon_deg)
        positions.append({'body_id': bid, 'lon_deg': round(lon_deg,6), 'lat_deg': round(lat_deg,6),
                          'dist_au': round(dist_au,9), 'speed_lon_d': round(slon,6)})
        longitudes.append((lon_deg, bid))

    cusps, ascmc = swe.houses(jd_ut, lat, lon, syschar.encode('ascii'))
    houses = [{'system': 'Placidus' if syschar=='P' else syschar,
               'house_num': i+1, 'cusp_deg': round(_norm360(cusps[i]),6)} for i in range(12)]

    # assign house numbers (simple segment test)
    segs = [(_norm360(cusps[i-1]), _norm360(cusps[i])) for i in range(1,12)] + [(_norm360(cusps[11]), _norm360(cusps[0]))]
    def house_of(lon):
        for idx,(a,b) in enumerate(segs, start=2):
            if (a < b and a <= lon < b) or (a > b and (lon >= a or lon < b)):
                return idx
        return 1
    for p in positions:
        p['house_num'] = house_of(p['lon_deg'])

    # aspects (basic)
    aspects = []
    def angdiff(a,b):
        d = (b - a + 540.0) % 360.0 - 180.0
        return abs(d if d <= 180 else 360 - d)
    defs = [('conjunction',0,8),('sextile',60,4),('square',90,6),('trine',120,6),('opposition',180,8)]
    for i in range(len(longitudes)):
        for j in range(i+1,len(longitudes)):
            d = angdiff(longitudes[i][0], longitudes[j][0])
            for name, exact, orbmax in defs:
                orb = abs(d - exact)
                if orb <= orbmax:
                    aspects.append({'a_body_id': longitudes[i][1], 'b_body_id': longitudes[j][1],
                                    'aspect': name, 'orb_deg': round(orb,2), 'exact': orb < 0.01})
                    break

    return positions, houses, aspects


@app.post('/signup', response_model=SignupOut)
def signup(info: SignupIn):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (email, display_name, birth_date, birth_time, birth_location,
                                   latitude, longitude, timezone, lang_primary, lang_secondary)
                VALUES (%(email)s,%(display)s,%(bd)s,%(bt)s,%(loc)s,%(lat)s,%(lon)s,%(tz)s,%(lp)s,%(ls)s)
                RETURNING id
                """,
                {'email': info.email, 'display': info.display_name,
                 'bd': info.birth_date, 'bt': info.birth_time, 'loc': info.birth_location,
                 'lat': info.latitude, 'lon': info.longitude, 'tz': info.timezone,
                 'lp': info.lang_primary, 'ls': info.lang_secondary}
            )
            user_id = cur.fetchone()[0]

            positions, houses, aspects = compute_positions_houses(
                info.birth_date, info.birth_time, info.timezone, info.latitude, info.longitude, info.house_system
            )

            cur.execute(
                """
                SELECT upsert_user_radix_snapshot(
                  %(user_id)s, %(birth_date)s, %(birth_time)s, %(birth_location)s,
                  %(lat)s, %(lon)s, %(tz)s, %(system)s,
                  %(positions)s::jsonb, %(houses)s::jsonb, %(aspects)s::jsonb, %(raw)s::jsonb
                )
                """,
                {'user_id': user_id,
                 'birth_date': info.birth_date, 'birth_time': info.birth_time,
                 'birth_location': info.birth_location, 'lat': info.latitude, 'lon': info.longitude,
                 'tz': info.timezone, 'system': 'Placidus' if info.house_system=='P' else info.house_system,
                 'positions': json.dumps(positions), 'houses': json.dumps(houses), 'aspects': json.dumps(aspects),
                 'raw': json.dumps({'v':'start-small','bodies':len(positions)})}
            )
            radix_id = cur.fetchone()[0]
    return SignupOut(user_id=user_id, radix_id=radix_id)


@app.post('/match/score')
def match_score(m: MatchIn):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT simple_match_score(%s,%s)", (m.user_a, m.user_b))
            score = cur.fetchone()[0]
    return {'score': score}


@app.post('/meeting/link')
def meeting_link(inp: MeetingIn):
    # build a deterministic but anonymous room name from user ids and date
    slug = f"u{inp.user_a}-u{inp.user_b}-{inp.when_utc.strftime('%Y%m%dT%H%M')}"
    return {'url': f"{JITSI_BASE}/{slug}"}
# <<< backend/api.py <<<

