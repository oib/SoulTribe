#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, time
from typing import Optional
from zoneinfo import ZoneInfo

from sqlmodel import select
from argon2 import PasswordHasher

# Ensure repo root is importable when running this script directly
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from db import session_scope, DATABASE_URL
from models import User, Profile, AvailabilitySlot


NEW_DOMAIN = "soultribe.chat"
NEW_PASSWORD = "U6mta31QzD5UVCDl"
ph = PasswordHasher()


def mask_db_url(url: str) -> str:
    if "@" not in url:
        return url
    scheme_sep = url.find('://')
    at_pos = url.rfind('@')
    if scheme_sep != -1 and at_pos != -1 and at_pos > scheme_sep:
        return url[:scheme_sep+3] + "***:***" + url[at_pos:]
    return url


def replace_domain(email: str, new_domain: str) -> str:
    local = email.split("@", 1)[0]
    return f"{local}@{new_domain}"


def ensure_unique_email(session, desired_email: str, user_id: int) -> str:
    """If desired_email exists for another user, suffix with +<id>."""
    existing = session.exec(select(User).where(User.email == desired_email)).first()
    if not existing or existing.id == user_id:
        return desired_email
    local, domain = desired_email.split("@", 1)
    candidate = f"{local}+{user_id}@{domain}"
    return candidate


def tz_or_utc(tz: Optional[str]) -> ZoneInfo:
    try:
        if tz:
            return ZoneInfo(tz)
    except Exception:
        pass
    return ZoneInfo("UTC")


def build_slot_datetimes(day: datetime, tz: ZoneInfo, start_local: time, duration_hours: int = 2):
    # day is a date-ish datetime (naive UTC), construct local dt
    local_dt = datetime(year=day.year, month=day.month, day=day.day,
                        hour=start_local.hour, minute=start_local.minute, second=0, microsecond=0,
                        tzinfo=tz)
    end_local_dt = local_dt + timedelta(hours=duration_hours)
    # Convert to UTC naive for storage consistency in our codebase
    start_utc = local_dt.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    end_utc = end_local_dt.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    # Keep local naive timestamps for AvailabilitySlot local fields
    start_local_naive = local_dt.replace(tzinfo=None)
    end_local_naive = end_local_dt.replace(tzinfo=None)
    return start_utc, end_utc, start_local_naive, end_local_naive


def create_next_7_days_slots_for_user(session, user_id: int, live_tz: Optional[str], start_hour_local: int = 18):
    tz = tz_or_utc(live_tz)
    today = datetime.utcnow().date()
    created = 0
    for i in range(7):
        d = today + timedelta(days=i)
        start_utc, end_utc, start_local, end_local = build_slot_datetimes(
            datetime(d.year, d.month, d.day), tz, time(hour=start_hour_local), duration_hours=2
        )
        # Avoid duplicates: check existing slot with same user_id and start_dt_utc
        exists = session.exec(
            select(AvailabilitySlot).where(
                (AvailabilitySlot.user_id == user_id) & (AvailabilitySlot.start_dt_utc == start_utc)
            )
        ).first()
        if exists:
            continue
        slot = AvailabilitySlot(
            user_id=user_id,
            start_dt_utc=start_utc,
            end_dt_utc=end_utc,
            start_dt_local=start_local,
            end_dt_local=end_local,
            timezone=live_tz or "UTC",
        )
        session.add(slot)
        created += 1
    return created


def main():
    print(f"Using DATABASE_URL: {mask_db_url(str(DATABASE_URL))}")
    total_users = 0
    updated_users = 0
    seeded_slots = 0

    with session_scope() as session:
        # Find users with @example.com
        users = session.exec(select(User).where(User.email.like('%@example.com'))).all()
        total_users = len(users)
        for u in users:
            # Update email domain
            new_email = replace_domain(u.email, NEW_DOMAIN)
            new_email = ensure_unique_email(session, new_email, u.id)
            if u.email != new_email:
                u.email = new_email
            # Update password
            u.password_hash = ph.hash(NEW_PASSWORD)
            session.add(u)
            updated_users += 1

            # Seed slots for next 7 days at 18:00 local time (2h)
            prof = session.exec(select(Profile).where(Profile.user_id == u.id)).first()
            seeded_slots += create_next_7_days_slots_for_user(session, u.id, getattr(prof, 'live_tz', None), start_hour_local=18)
        session.commit()

    print(f"Matched users: {total_users}")
    print(f"Updated users: {updated_users}")
    print(f"New availability slots created: {seeded_slots}")
    print("Done.")


if __name__ == "__main__":
    main()
