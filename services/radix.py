# services/radix.py
from __future__ import annotations
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple, List

import swisseph as swe  # pyswisseph

# TIP: If you install Swiss Ephemeris data files, set the path here:
# swe.set_ephe_path("/usr/share/ephe")
# For zero-deps operation, use the Moshier algorithm (no data files needed).
# Include FLG_SPEED so calc_ut returns velocity components consistently.
FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED  # or swe.FLG_SWIEPH | swe.FLG_SPEED if ephe files are installed

# Ecliptic longitudes for MVP bodies
BODIES = {
    "SUN": swe.SUN,
    "MOON": swe.MOON,
    "MERCURY": swe.MERCURY,
    "VENUS": swe.VENUS,
    "MARS": swe.MARS,
    "JUPITER": swe.JUPITER,
    "SATURN": swe.SATURN,
    "URANUS": swe.URANUS,
    "NEPTUNE": swe.NEPTUNE,
    "PLUTO": swe.PLUTO,
}

def _to_decimal_hours(dt: datetime) -> float:
    h = dt.hour + dt.minute / 60.0 + (dt.second + dt.microsecond / 1e6) / 3600.0
    return h

def _julday_utc(dt_utc: datetime) -> float:
    """Swiss Ephemeris expects Y, M, D, and fractional hour in UT."""
    if dt_utc.tzinfo is None:
        # DB may store naive timestamps; interpret as UTC by convention
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    else:
        dt_utc = dt_utc.astimezone(timezone.utc)
    return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, _to_decimal_hours(dt_utc))

def compute_radix_json(
    birth_dt_utc: datetime,
    birth_time_known: bool,
    lat: Optional[float],
    lon: Optional[float],
    house_system: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Compute compact radix JSON using pyswisseph.
    If time is unknown, pass a noon UTC datetime upstream and set birth_time_known=False.
    """
    jd_ut = _julday_utc(birth_dt_utc)

    bodies_out: Dict[str, Any] = {}
    for name, pid in BODIES.items():
        # Some pyswisseph builds return only (lon, lat) even if flags are passed.
        # We only need longitude for MVP, so handle both shapes safely.
        try:
            res = swe.calc_ut(jd_ut, pid, FLAGS)
        except TypeError:
            # Fallback: older signature without flags
            res = swe.calc_ut(jd_ut, pid)
        # Some versions return (values, retflag)
        if isinstance(res, (list, tuple)) and len(res) == 2 and isinstance(res[0], (list, tuple)):
            values = res[0]
        else:
            values = res
        lon_deg = float(values[0])
        # normalize longitude into 0..360
        lon_deg = lon_deg % 360.0
        bodies_out[name] = {"lon": round(lon_deg, 4)}

    # Optionally compute houses if we have a reliable time and location
    houses_payload: Optional[Dict[str, Any]] = None
    if birth_time_known and (lat is not None) and (lon is not None):
        try:
            # Map short codes to SwissEph house letters (bytes)
            HSYS_MAP = {
                None: b'P',
                '': b'P',
                'P': b'P',  # Placidus
                'W': b'W',  # Whole Sign
                'K': b'K',  # Koch
                'E': b'E',  # Equal
            }
            hsys = HSYS_MAP.get((house_system or '').upper(), b'P')
            # Prefer modern signature: houses_ex(jd_ut, flags, lat, lon, hsys)
            cusps, ascmc = swe.houses_ex(jd_ut, FLAGS, float(lat), float(lon), hsys)
        except TypeError:
            # Fallback: houses_ex(jd_ut, lat, lon, hsys) or houses(jd_ut, lat, lon, hsys)
            try:
                cusps, ascmc = swe.houses_ex(jd_ut, float(lat), float(lon), hsys)
            except Exception:
                cusps, ascmc = swe.houses(jd_ut, float(lat), float(lon), hsys)
        try:
            # Normalize SwissEph cusps output to 12 values for houses 1..12
            # Some builds return length-13 (index 1..12; index 0 unused),
            # others return length-12 (index 0..11 for houses 1..12).
            def norm(x: float) -> float:
                return round(float(x) % 360.0, 4)
            cusps_raw = list(cusps)
            if len(cusps_raw) >= 13:
                cusps_iter = cusps_raw[1:13]
            else:
                cusps_iter = cusps_raw[0:12]
            cusps_list: List[float] = [norm(c) for c in cusps_iter]
            asc = norm(ascmc[0])  # ASC
            mc = norm(ascmc[1])   # MC
            system_name = {
                b'P': 'Placidus',
                b'W': 'Whole Sign',
                b'K': 'Koch',
                b'E': 'Equal',
            }.get(hsys, 'Placidus')
            houses_payload = {
                "system": system_name,
                "cusps": cusps_list,
                "asc": asc,
                "mc": mc,
            }
        except Exception:
            houses_payload = None

    return {
        "bodies": bodies_out,
        "houses": houses_payload,  # null if insufficient data
        "notes": "computed with pyswisseph; noon fallback when time unknown",
        "meta": {
            "birth_time_known": bool(birth_time_known),
            "lat": lat,
            "lon": lon,
            "algo": "MOSEPH" if FLAGS == swe.FLG_MOSEPH else "SWIEPH",
        },
    }
