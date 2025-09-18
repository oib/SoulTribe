#!/usr/bin/env python3
from __future__ import annotations
import os
import random
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from dotenv import load_dotenv

from db import session_scope, init_db
from models import User, Profile, Radix
from sqlmodel import select
from services.radix import compute_radix_json

# Small pools for randomization
LANG_POOL = ["en", "de", "fr", "es", "it", "pt", "nl", "sv", "no", "da"]
TZ_POOL = [
    "Europe/Berlin",
    "Europe/Paris",
    "Europe/London",
    "America/New_York",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Australia/Sydney",
    "Africa/Johannesburg",
]
CITY_POOL = [
    ("Berlin, Germany", 52.52, 13.405, "Europe/Berlin"),
    ("Paris, France", 48.8566, 2.3522, "Europe/Paris"),
    ("London, UK", 51.5074, -0.1278, "Europe/London"),
    ("New York, USA", 40.7128, -74.0060, "America/New_York"),
    ("Los Angeles, USA", 34.0522, -118.2437, "America/Los_Angeles"),
    ("São Paulo, Brazil", -23.5505, -46.6333, "America/Sao_Paulo"),
    ("Tokyo, Japan", 35.6762, 139.6503, "Asia/Tokyo"),
    ("Singapore", 1.3521, 103.8198, "Asia/Singapore"),
    ("Sydney, Australia", -33.8688, 151.2093, "Australia/Sydney"),
    ("Johannesburg, South Africa", -26.2041, 28.0473, "Africa/Johannesburg"),
]

START_DATE = datetime(1960, 1, 1, tzinfo=timezone.utc)
END_DATE = datetime(2010, 12, 31, 23, 59, tzinfo=timezone.utc)
PH = PasswordHasher()


def random_birth_dt() -> datetime:
    total_seconds = int((END_DATE - START_DATE).total_seconds())
    offset = random.randint(0, total_seconds)
    return START_DATE + timedelta(seconds=offset)


def main(count: int = 100, password: str = "secret123") -> None:
    load_dotenv()
    init_db()
    created = 0
    with session_scope() as session:
        for i in range(count):
            idx = i + 1
            email = f"gen{idx:03d}@example.com"
            if session.exec(
                select(User).where(User.email == email)
            ).first():
                continue
            pwd_hash = PH.hash(password)
            user = User(email=email, password_hash=pwd_hash, email_verified_at=datetime.now(timezone.utc))
            session.add(user)
            session.commit()
            session.refresh(user)

            # Profile
            display = f"GenUser {idx:03d}"
            birth_dt_utc = random_birth_dt()
            city, lat, lon, birth_tz = random.choice(CITY_POOL)
            live_tz = random.choice(TZ_POOL)
            # Always include English as primary; optionally add 0-2 more languages
            others_pool = [l for l in LANG_POOL if l != "en"]
            extra_count = random.randint(0, 2)
            extras = random.sample(others_pool, k=extra_count)
            langs = ["en", *extras]

            prof = Profile(
                user_id=user.id,
                display_name=display,
                birth_dt_utc=birth_dt_utc,
                birth_time_known=True,
                birth_place_name=city,
                birth_lat=lat,
                birth_lon=lon,
                birth_tz=birth_tz,
                live_tz=live_tz,
                languages=langs,
                lang_primary="en",
                lang_secondary=(extras[0] if len(extras) > 0 else None),
            )
            session.add(prof)
            session.commit()

            # Radix
            rjson = compute_radix_json(
                birth_dt_utc=birth_dt_utc,
                birth_time_known=True,
                lat=lat,
                lon=lon,
            )
            radix = Radix(user_id=user.id, ref_dt_utc=birth_dt_utc, json=rjson)
            session.add(radix)
            session.commit()

            created += 1
            if created % 10 == 0:
                print(f"Created {created} users…")

    print(f"Done. Created {created} new users.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate synthetic users and radices")
    parser.add_argument("--count", type=int, default=100, help="Number of users to generate")
    parser.add_argument("--password", type=str, default="secret123", help="Password for all users")
    args = parser.parse_args()

    main(count=args.count, password=args.password)
