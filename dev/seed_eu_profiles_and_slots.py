#!/usr/bin/env python3
from __future__ import annotations
import random
from datetime import datetime, timezone
from typing import List, Tuple

from dotenv import load_dotenv
from sqlmodel import select

from db import session_scope, init_db
from models import User, Profile

# Reuse availability seeding to create slots for the next 3 days
from dev.seed_availability import seed_availability

# European capitals (label, lat, lon, tz, primary_lang)
EU_CAPITALS: List[Tuple[str, float, float, str, str]] = [
    ("Vienna, Austria", 48.2082, 16.3738, "Europe/Vienna", "de"),
    ("Berlin, Germany", 52.5200, 13.4050, "Europe/Berlin", "de"),
    ("Paris, France", 48.8566, 2.3522, "Europe/Paris", "fr"),
    ("Madrid, Spain", 40.4168, -3.7038, "Europe/Madrid", "es"),
    ("Rome, Italy", 41.9028, 12.4964, "Europe/Rome", "it"),
    ("Lisbon, Portugal", 38.7223, -9.1393, "Europe/Lisbon", "pt"),
    ("Amsterdam, Netherlands", 52.3676, 4.9041, "Europe/Amsterdam", "nl"),
    ("Brussels, Belgium", 50.8503, 4.3517, "Europe/Brussels", "fr"),
    ("Dublin, Ireland", 53.3498, -6.2603, "Europe/Dublin", "en"),
    ("Copenhagen, Denmark", 55.6761, 12.5683, "Europe/Copenhagen", "da"),
    ("Oslo, Norway", 59.9139, 10.7522, "Europe/Oslo", "no"),
    ("Stockholm, Sweden", 59.3293, 18.0686, "Europe/Stockholm", "sv"),
    ("Helsinki, Finland", 60.1699, 24.9384, "Europe/Helsinki", "fi"),
    ("Prague, Czechia", 50.0755, 14.4378, "Europe/Prague", "cs"),
    ("Warsaw, Poland", 52.2297, 21.0122, "Europe/Warsaw", "pl"),
    ("Budapest, Hungary", 47.4979, 19.0402, "Europe/Budapest", "hu"),
    ("Bucharest, Romania", 44.4268, 26.1025, "Europe/Bucharest", "ro"),
    ("Athens, Greece", 37.9838, 23.7275, "Europe/Athens", "el"),
    ("Tallinn, Estonia", 59.4370, 24.7536, "Europe/Tallinn", "et"),
    ("Riga, Latvia", 56.9496, 24.1052, "Europe/Riga", "lv"),
    ("Vilnius, Lithuania", 54.6872, 25.2797, "Europe/Vilnius", "lt"),
    ("Ljubljana, Slovenia", 46.0569, 14.5058, "Europe/Ljubljana", "sl"),
    ("Zagreb, Croatia", 45.8150, 15.9819, "Europe/Zagreb", "hr"),
    ("Belgrade, Serbia", 44.8125, 20.4612, "Europe/Belgrade", "sr"),
    ("Sarajevo, Bosnia and Herzegovina", 43.8563, 18.4131, "Europe/Sarajevo", "bs"),
    ("Skopje, North Macedonia", 41.9981, 21.4254, "Europe/Skopje", "mk"),
    ("Tirana, Albania", 41.3275, 19.8189, "Europe/Tirane", "sq"),
    ("Kyiv, Ukraine", 50.4501, 30.5234, "Europe/Kyiv", "uk"),
    ("Minsk, Belarus", 53.9006, 27.5590, "Europe/Minsk", "be"),
    ("Reykjavík, Iceland", 64.1466, -21.9426, "Atlantic/Reykjavik", "is"),
    ("Luxembourg, Luxembourg", 49.6116, 6.1319, "Europe/Luxembourg", "lb"),
]

# European languages (match front-end SimpleI18n.languages)
EU_LANGS = [
    'en','de','fr','es','it','pt','nl','sv','no','da','fi','is','ga','cy','mt','lb','ca','gl','eu',
    'pl','cs','sk','hu','ro','bg','hr','sr','sl','mk','sq','bs','et','lv','lt','el','tr','ru','uk','be'
]


def pick_secondaries(primary: str, n: int) -> List[str]:
    pool = [c for c in EU_LANGS if c != primary]
    return random.sample(pool, k=n) if n > 0 else []


def update_profiles_and_seed_slots() -> None:
    load_dotenv()
    init_db()
    updated = 0
    with session_scope() as session:
        users = session.exec(select(User)).all()
        for u in users:
            p: Profile = session.get(Profile, u.id)
            if not p:
                continue
            # Assign a EU capital deterministically but distributed
            info = EU_CAPITALS[u.id % len(EU_CAPITALS)]
            city, lat, lon, tz, primary = info
            # 1 or 2 secondaries
            nsec = random.choice([1, 2])
            secs = pick_secondaries(primary, nsec)
            languages = [primary, *secs]

            # Update profile fields
            p.display_name = p.display_name or f"User {u.id}"
            p.live_tz = tz
            p.birth_place_name = p.birth_place_name or city
            p.birth_lat = p.birth_lat or lat
            p.birth_lon = p.birth_lon or lon
            p.lang_primary = primary
            p.lang_secondary = secs[0] if secs else None
            p.languages = languages
            # Ensure email verified for matching
            if not u.email_verified_at:
                u.email_verified_at = datetime.now(timezone.utc)
            session.add(p)
            session.add(u)
            session.commit()
            updated += 1

    # Seed availability slots for the next 3 days
    total_slots = seed_availability()
    print(f"Updated {updated} profiles with EU capitals and languages; seeded {total_slots} availability slots.")


if __name__ == "__main__":
    update_profiles_and_seed_slots()
