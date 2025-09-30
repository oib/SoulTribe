#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta
import argparse
from typing import Sequence

from sqlmodel import select

# Ensure repo root is importable when running this script directly
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from db import session_scope, DATABASE_URL
from models import User, AvailabilitySlot, Meetup


def utcnow_naive() -> datetime:
    return datetime.utcnow()


# --------------------- Users: delete unverified older than threshold ---------------------

def find_unverified_users_older_than(hours: int) -> Sequence[User]:
    cutoff = utcnow_naive() - timedelta(hours=hours)
    with session_scope() as session:
        users = session.exec(
            select(User).where(
                User.email_verified_at.is_(None),
                User.created_at < cutoff,
            )
        ).all()
        return users


def delete_unverified_users(user_ids: list[int]) -> int:
    if not user_ids:
        return 0
    from sqlalchemy import delete
    from models import EmailVerificationToken, PasswordResetToken

    with session_scope() as session:
        session.exec(delete(EmailVerificationToken).where(EmailVerificationToken.user_id.in_(user_ids)))
        session.exec(delete(PasswordResetToken).where(PasswordResetToken.user_id.in_(user_ids)))
        session.exec(delete(User).where(User.id.in_(user_ids)))
        session.commit()
    return len(user_ids)


# --------------------- Availability: purge past slots ---------------------

def find_past_slots(grace_hours: int = 0) -> Sequence[AvailabilitySlot]:
    cutoff = utcnow_naive() - timedelta(hours=grace_hours)
    with session_scope() as session:
        slots = session.exec(
            select(AvailabilitySlot).where(AvailabilitySlot.end_dt_utc < cutoff)
        ).all()
        return slots


def delete_slots(slot_ids: list[int]) -> int:
    if not slot_ids:
        return 0
    from sqlalchemy import delete
    with session_scope() as session:
        session.exec(delete(AvailabilitySlot).where(AvailabilitySlot.id.in_(slot_ids)))
        session.commit()
    return len(slot_ids)


# --------------------- Meetups: purge past meetups ---------------------
def find_past_meetups(grace_hours: int = 0) -> Sequence[Meetup]:
    cutoff = utcnow_naive() - timedelta(hours=grace_hours)
    with session_scope() as session:
        # Consider confirmed_dt_utc if present; otherwise proposed_dt_utc
        # We can't easily compute COALESCE in SQLModel select here portably, so filter in Python
        meetups = session.exec(select(Meetup)).all()
        past = []
        for m in meetups:
            dt = m.confirmed_dt_utc or m.proposed_dt_utc
            if dt is not None and dt < cutoff:
                past.append(m)
        return past


def delete_meetups(meetup_ids: list[int]) -> int:
    if not meetup_ids:
        return 0
    from sqlalchemy import delete
    with session_scope() as session:
        session.exec(delete(Meetup).where(Meetup.id.in_(meetup_ids)))
        session.commit()
    return len(meetup_ids)


# --------------------- Main ---------------------

def mask_db_url(url: str) -> str:
    if "@" not in url:
        return url
    scheme_sep = url.find('://')
    at_pos = url.rfind('@')
    if scheme_sep != -1 and at_pos != -1 and at_pos > scheme_sep:
        return url[:scheme_sep+3] + "***:***" + url[at_pos:]
    return url


def main() -> None:
    p = argparse.ArgumentParser(description="Run maintenance cleanup tasks: delete stale unverified users and purge past availability slots.")
    p.add_argument("--users-hours", type=int, default=24, help="Delete users unverified older than this many hours (default: 24)")
    p.add_argument("--slots-grace-hours", type=int, default=0, help="Grace period before deleting past slots (default: 0)")
    p.add_argument("--dry-run", action="store_true", help="Only report what would be deleted")
    p.add_argument("--meetups-grace-hours", type=int, default=0, help="Grace period before deleting past meetups (default: 0)")
    args = p.parse_args()

    try:
        print(f"Using DATABASE_URL: {mask_db_url(str(DATABASE_URL))}")
    except Exception:
        pass

    # Users
    users = find_unverified_users_older_than(args.users_hours)
    user_ids = [u.id for u in users if u.id is not None]
    print(f"[Users] Found {len(user_ids)} unverified user(s) older than {args.users_hours}h")
    if user_ids:
        print("[Users] IDs:", ", ".join(map(str, user_ids)))

    # Slots
    slots = find_past_slots(args.slots_grace_hours)
    slot_ids = [s.id for s in slots if s.id is not None]
    print(f"[Slots] Found {len(slot_ids)} past slot(s) with grace {args.slots_grace_hours}h")
    if slot_ids:
        print("[Slots] IDs:", ", ".join(map(str, slot_ids[:50])) + (" ..." if len(slot_ids) > 50 else ""))

    # Meetups
    meetups = find_past_meetups(args.meetups_grace_hours)
    meetup_ids = [m.id for m in meetups if m.id is not None]
    print(f"[Meetups] Found {len(meetup_ids)} past meetup(s) with grace {args.meetups_grace_hours}h")
    if meetup_ids:
        print("[Meetups] IDs:", ", ".join(map(str, meetup_ids[:50])) + (" ..." if len(meetup_ids) > 50 else ""))

    if args.dry_run:
        print("Dry-run: no changes applied.")
        return

    deleted_users = delete_unverified_users(user_ids)
    deleted_slots = delete_slots(slot_ids)
    deleted_meetups = delete_meetups(meetup_ids)
    print(f"Deleted users: {deleted_users}")
    print(f"Deleted slots: {deleted_slots}")
    print(f"Deleted meetups: {deleted_meetups}")


if __name__ == "__main__":
    main()
