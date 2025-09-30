from __future__ import annotations
from datetime import datetime, timezone
import os
import sys

# Allow importing modules from the repository root when running this script directly
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from sqlmodel import select

from db import session_scope, init_db
from models import User, Profile, Radix
from services.radix import compute_radix_json


def ensure_user(session, email: str, password_hash: str = "argon2$dev", *,
                display_name: str | None = None,
                birth_dt: datetime | None = None,
                birth_time_known: bool = True,
                birth_lat: float | None = None,
                birth_lon: float | None = None,
                lang_primary: str | None = None,
                lang_secondary: str | None = None) -> int:
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        return existing.id

    u = User(email=email, password_hash=password_hash)
    session.add(u)
    session.commit()
    session.refresh(u)

    p = Profile(user_id=u.id)
    if display_name:
        p.display_name = display_name
    computed_birth_dt_utc = None
    if birth_dt is not None:
        dt = birth_dt
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt_utc = dt.astimezone(timezone.utc)
        if not birth_time_known:
            dt_utc = dt_utc.replace(hour=12, minute=0, second=0, microsecond=0)
        p.birth_dt_utc = dt_utc
        p.birth_time_known = bool(birth_time_known)
        computed_birth_dt_utc = dt_utc
    p.birth_lat = birth_lat
    p.birth_lon = birth_lon
    p.lang_primary = lang_primary
    p.lang_secondary = lang_secondary

    session.add(p)
    session.commit()

    # compute radix if we have birth_dt_utc
    # Use computed_birth_dt_utc to preserve tz awareness (SQLite may drop tzinfo)
    if computed_birth_dt_utc is not None:
        rjson = compute_radix_json(
            birth_dt_utc=computed_birth_dt_utc,
            birth_time_known=p.birth_time_known,
            lat=p.birth_lat,
            lon=p.birth_lon,
        )
        r = Radix(user_id=u.id, ref_dt_utc=p.birth_dt_utc, json=rjson)
        session.add(r)
        session.commit()

    return u.id


def main():
    init_db()
    with session_scope() as session:
        ids = []
        ids.append(ensure_user(
            session,
            email="alice@example.com",
            display_name="Alice",
            birth_dt=datetime(1990, 4, 12, 14, 35, tzinfo=timezone.utc),
            birth_time_known=True,
            lang_primary="en",
            lang_secondary="de",
        ))
        ids.append(ensure_user(
            session,
            email="bob@example.com",
            display_name="Bob",
            birth_dt=datetime(1988, 11, 5, 6, 0, tzinfo=timezone.utc),
            birth_time_known=True,
            lang_primary="en",
            lang_secondary=None,
        ))
        ids.append(ensure_user(
            session,
            email="carol@example.com",
            display_name="Carol",
            birth_dt=datetime(1992, 7, 23, 12, 0, tzinfo=timezone.utc),
            birth_time_known=False,  # triggers noon fallback behavior
            lang_primary="en",
            lang_secondary="es",
        ))
        print("Seeded user_ids:", ids)


if __name__ == "__main__":
    main()
