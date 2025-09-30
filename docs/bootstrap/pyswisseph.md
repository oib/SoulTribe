# pyswisseph — Notes for Development

## What it is

- `pyswisseph` is the official Python wrapper around Swiss Ephemeris, a C library widely used in astrology software.
- It provides planetary positions, house cusps, sidereal/ayanamsa support, eclipses, etc.

## Install (Debian 12)

```bash
apt install -y python3-pip
pip install pyswisseph
```

Optionally set environment variable to point to Swiss Ephemeris data files (if not in default path):

```bash
export SE_EPHE_PATH="/path/to/ephe"
```

## Core usage

```python
import swisseph as swe

# 1. Convert datetime → Julian Day (UT)
jd = swe.julday(1990, 4, 12, 14.5833)  # year, month, day, hours (14h35m)

# 2. Planetary positions (Sun example)
lon, lat, dist, lon_speed = swe.calc_ut(jd, swe.SUN)[0:4]

# 3. Houses
cusps, ascmc = swe.houses(jd, 48.21, 16.36, b'P')  # lat, lon, system (Placidus)
```

## Flags

- `swe.FLG_SWIEPH` — use Swiss Ephemeris data files
- `swe.FLG_SPEED` — also return velocities
- Combine with `|` (bitwise OR)

## Key constants

- `swe.SUN, swe.MOON, swe.MERCURY, …, swe.PLUTO`
- Also nodes (`swe.MEAN_NODE`, `swe.TRUE_NODE`), Chiron, etc.

## Practical tips

- Always normalize longitudes to `[0,360)`.
- For house computations, longitude must be East positive.
- Use `datetime + pytz` to manage local time → UTC → JD conversions.

## Why we use it

- Backend code (FastAPI) uses `pyswisseph` to compute radix snapshot once at signup.
- Results are written into the database; no heavy ephemeris DB required at this stage.

## Debugging

1. Create a minimal Python scratch file.
2. Run JD and `swe.calc_ut` with known dates.
3. Compare against online Swiss Ephemeris calculator for validation.

## Extensions later

- Add Chiron, Nodes, Asteroids by ID.
- Switch house system (Placidus, Koch, Whole Sign, etc.).
- Use `swe.set_sid_mode()` for sidereal zodiac.

---

TL;DR:
- `pip install pyswisseph`
- Use `swe.julday()` + `swe.calc_ut()` + `swe.houses()`.
- Normalize longitudes; feed results into your DB schema.
