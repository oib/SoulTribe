# services/scoring.py
from __future__ import annotations
from typing import Dict, Any, Tuple, List, Optional

ASPECTS = [
    (0,   8),   # conjunction
    (60,  6),   # sextile
    (90, -8),   # square
    (120, 9),   # trine
    (180,-7),   # opposition
]
ORB_SUN_MOON = 6.0
ORB_OTHERS   = 4.0

def _delta(a: float, b: float) -> float:
    """smallest angular distance in degrees (0..180)."""
    d = abs((a - b) % 360.0)
    return d if d <= 180 else 360 - d

def _match_aspect(delta: float, orb: float) -> int:
    for angle, weight in ASPECTS:
        if abs(delta - angle) <= orb:
            return weight
    return 0

def _sun_element(lon: float) -> str:
    # Fire: Aries-Leo-Sag | Earth: Taurus-Virgo-Cap | Air: Gemini-Libra-Aqu | Water: Cancer-Scorpio-Pisces
    sign = int(lon // 30)  # 0..11
    return ["Fire","Earth","Air","Water"][ [0,1,2,3, 0,1,2,3, 0,1,2,3][sign] ]

def score_pair(radix_a: Dict[str,Any], radix_b: Dict[str,Any], *, moon_half_weight: bool,
               lang_primary_equal: bool, lang_secondary_equal: bool) -> Tuple[int, Dict[str,Any]]:
    a = radix_a["bodies"]; b = radix_b["bodies"]

    # Core aspects
    s_s  = _match_aspect(_delta(a["SUN"]["lon"],  b["SUN"]["lon"]),  ORB_SUN_MOON)
    m_m  = _match_aspect(_delta(a["MOON"]["lon"], b["MOON"]["lon"]), ORB_SUN_MOON)
    s_m1 = _match_aspect(_delta(a["SUN"]["lon"],  b["MOON"]["lon"]), ORB_SUN_MOON)
    s_m2 = _match_aspect(_delta(a["MOON"]["lon"], b["SUN"]["lon"]),  ORB_SUN_MOON)

    # Secondary
    orb_other = ORB_OTHERS
    v_m1 = _match_aspect(_delta(a["VENUS"]["lon"], b["MARS"]["lon"]),  orb_other)
    v_m2 = _match_aspect(_delta(a["MARS"]["lon"],  b["VENUS"]["lon"]), orb_other)
    same_element_bonus = 4 if _sun_element(a["SUN"]["lon"]) == _sun_element(b["SUN"]["lon"]) else 0

    # Language bonuses
    lang_bonus = (10 if lang_primary_equal else 0) + (4 if lang_secondary_equal else 0)

    # Moon uncertainty handling
    moon_factor = 0.5 if moon_half_weight else 1.0
    core_total = s_s + moon_factor*(m_m + s_m1 + s_m2)
    secondary  = v_m1 + v_m2 + same_element_bonus

    # --- Houses (optional, light-weight overlay bonuses) ---
    def _normalize_cusps(cusps: Any) -> Optional[List[float]]:
        try:
            arr = list(cusps)
            if len(arr) < 12:
                return None
            vals: List[float] = []
            for i in range(12):
                v = arr[i]
                if v is None:
                    vals.append(float('nan'))
                else:
                    vals.append(float(v))
            return vals
        except Exception:
            return None

    def _next_valid(cusps: List[float], i: int) -> int:
        for k in range(1, 13):
            j = (i + k) % 12
            if not (cusps[j] != cusps[j]):  # not NaN
                return j
        return -1

    def _house_index(cusps: List[float], lon: float) -> int:
        # Return 0..11 house index, or -1 if cannot classify
        try:
            x = ((lon % 360.0) + 360.0) % 360.0
            for i in range(12):
                a = cusps[i]
                if a != a:  # NaN
                    continue
                j = _next_valid(cusps, i)
                if j == -1 or j == i:
                    continue
                bb = cusps[j]
                if bb != bb:
                    continue
                if a <= bb:
                    if x >= a and x < bb:
                        return i
                else:
                    # wrap over 360
                    if x >= a or x < bb:
                        return i
            return -1
        except Exception:
            return -1

    def _sun_house_bonus(h: int) -> int:
        # 1/7 = +4, 5/11 = +3, 4/10 = +3
        if h in (0, 6):
            return 4
        if h in (4, 10):
            return 3
        if h in (3, 9):  # 4th/10th are indices 3/9
            return 3
        if h in (4, 10):
            return 3
        if h in (4, 10):
            return 3
        if h in (4, 10):
            return 3
        if h in (4, 10):
            return 3
        # Not in the highlighted houses
        return 0

    def _moon_house_bonus(h: int) -> int:
        # 1/7 = +3, 5/11 = +2
        if h in (0, 6):
            return 3
        if h in (4, 10):
            return 2
        if h in (4, 10):
            return 2
        return 0

    def _modality_group(h: int) -> Optional[str]:
        if h < 0:
            return None
        # 0-based: Angular 0,3,6,9 | Succedent 1,4,7,10 | Cadent 2,5,8,11
        if h in (0, 3, 6, 9):
            return 'Angular'
        if h in (1, 4, 7, 10):
            return 'Succedent'
        if h in (2, 5, 8, 11):
            return 'Cadent'
        return None

    houses_a = (radix_a.get("houses") or {})
    houses_b = (radix_b.get("houses") or {})
    cusps_a = _normalize_cusps(houses_a.get("cusps"))
    cusps_b = _normalize_cusps(houses_b.get("cusps"))

    house_bonus = 0
    houses_breakdown: Dict[str, Any] = {}
    if cusps_a and cusps_b:
        # A bodies in B houses
        h_A_sun_in_B = _house_index(cusps_b, float(a["SUN"]["lon"]))
        h_A_moon_in_B = _house_index(cusps_b, float(a["MOON"]["lon"]))
        # B bodies in A houses
        h_B_sun_in_A = _house_index(cusps_a, float(b["SUN"]["lon"]))
        h_B_moon_in_A = _house_index(cusps_a, float(b["MOON"]["lon"]))

        sun_b = _sun_house_bonus(h_A_sun_in_B) + _sun_house_bonus(h_B_sun_in_A)
        moon_b = _moon_house_bonus(h_A_moon_in_B) + _moon_house_bonus(h_B_moon_in_A)

        # Sun modality resonance (own-chart house modalities)
        sun_mod_A = _modality_group(_house_index(cusps_a, float(a["SUN"]["lon"])))
        sun_mod_B = _modality_group(_house_index(cusps_b, float(b["SUN"]["lon"])))
        sun_mod_bonus = 2 if (sun_mod_A and sun_mod_B and sun_mod_A == sun_mod_B) else 0

        house_bonus = sun_b + moon_b + sun_mod_bonus
        houses_breakdown = {
            "A.Sun→B.house": (h_A_sun_in_B + 1) if h_A_sun_in_B >= 0 else None,
            "A.Moon→B.house": (h_A_moon_in_B + 1) if h_A_moon_in_B >= 0 else None,
            "B.Sun→A.house": (h_B_sun_in_A + 1) if h_B_sun_in_A >= 0 else None,
            "B.Moon→A.house": (h_B_moon_in_A + 1) if h_B_moon_in_A >= 0 else None,
            "sun_modality": {"A": sun_mod_A, "B": sun_mod_B, "bonus": sun_mod_bonus},
            "house_bonus_total": house_bonus,
        }

    # --- Angles (ASC/MC) explicit aspects (optional) ---
    angles_bonus = 0
    angles_breakdown: Dict[str, Any] = {}
    try:
        houses_a = (radix_a.get("houses") or {})
        houses_b = (radix_b.get("houses") or {})
        asc_a = houses_a.get("asc", None)
        mc_a  = houses_a.get("mc", None)
        asc_b = houses_b.get("asc", None)
        mc_b  = houses_b.get("mc", None)
        have_asc = (asc_a is not None) and (asc_b is not None)
        have_mc  = (mc_a is not None) and (mc_b is not None)
        # We use lighter weights for angles; ASC is a bit stronger than MC
        # Sun↔ASC: +6 each direction; Moon↔ASC: +5 each direction
        # Sun↔MC: +5 each direction
        # ASC↔ASC: +7; MC↔MC: +5
        def W(delta: float, base: int) -> int:
            return _match_aspect(delta, ORB_OTHERS) and base or 0
        angs: Dict[str, int] = {}
        if have_asc:
            da_sa = _delta(float(a["SUN"]["lon"]), float(asc_b))
            db_sa = _delta(float(b["SUN"]["lon"]), float(asc_a))
            da_ma = _delta(float(a["MOON"]["lon"]), float(asc_b))
            db_ma = _delta(float(b["MOON"]["lon"]), float(asc_a))
            da_aa = _delta(float(asc_a), float(asc_b))
            angs["Sun(A)↔ASC(B)"]  = W(da_sa, 6)
            angs["Sun(B)↔ASC(A)"]  = W(db_sa, 6)
            angs["Moon(A)↔ASC(B)"] = W(da_ma, 5)
            angs["Moon(B)↔ASC(A)"] = W(db_ma, 5)
            angs["ASC↔ASC"]         = W(da_aa, 7)
        if have_mc:
            da_sm = _delta(float(a["SUN"]["lon"]), float(mc_b))
            db_sm = _delta(float(b["SUN"]["lon"]), float(mc_a))
            da_mm = _delta(float(mc_a), float(mc_b))
            angs["Sun(A)↔MC(B)"]   = W(da_sm, 5)
            angs["Sun(B)↔MC(A)"]   = W(db_sm, 5)
            angs["MC↔MC"]          = W(da_mm, 5)
        # Sum and keep only non-zero entries in breakdown
        angles_bonus = sum(v for v in angs.values() if isinstance(v, int))
        angles_breakdown = {k: v for k, v in angs.items() if v}
    except Exception:
        pass

    raw = core_total + secondary + lang_bonus + house_bonus + angles_bonus

    # Map roughly into 0..100 (simple clamp for MVP)
    score = int(round(max(0, min(100, 50 + raw))))  # center ~50; adjust as you tune weights

    breakdown = {
        "core": {"Sun-Sun": s_s, "Moon-Moon": m_m, "Sun-Moon(A→B)": s_m1, "Sun-Moon(B→A)": s_m2, "moon_factor": moon_factor},
        "secondary": {"Venus→Mars": v_m1, "Mars→Venus": v_m2, "same_sun_element": same_element_bonus},
        "lang": {"primary": 10 if lang_primary_equal else 0, "secondary": 4 if lang_secondary_equal else 0},
        "houses": houses_breakdown,
        "angles": angles_breakdown,
        "raw": raw,
    }
    return score, breakdown
