from __future__ import annotations

import random
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo

from sqlmodel import select

from src.backend.models import User, Profile, AvailabilitySlot

BOT_EMAIL_PATTERN = "gen%@soultribe.chat"


def _random_local_slot_dt(tz: ZoneInfo) -> tuple[datetime, datetime]:
    now = datetime.now(tz)
    day_offset = random.randint(0, 2)
    local_date = (now + timedelta(days=day_offset)).date()
    start_hour = random.randint(15, 17)
    start_local = datetime.combine(local_date, time(hour=start_hour), tzinfo=tz)
    end_local = start_local + timedelta(hours=1)
    return start_local, end_local


def _create_slot_for_profile(session, profile: Profile) -> bool:
    tz_name = profile.live_tz or profile.birth_tz or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")

    start_local, end_local = _random_local_slot_dt(tz)
    start_utc = start_local.astimezone(ZoneInfo("UTC"))
    end_utc = end_local.astimezone(ZoneInfo("UTC"))

    existing = session.exec(
        select(AvailabilitySlot)
        .where(AvailabilitySlot.user_id == profile.user_id)
        .where(AvailabilitySlot.start_dt_utc == start_utc.replace(tzinfo=None))
    ).first()
    if existing:
        return False

    slot = AvailabilitySlot(
        user_id=profile.user_id,
        start_dt_utc=start_utc.replace(tzinfo=None),
        end_dt_utc=end_utc.replace(tzinfo=None),
        start_dt_local=start_local.replace(tzinfo=None),
        end_dt_local=end_local.replace(tzinfo=None),
        timezone=tz.key,
    )
    session.add(slot)
    return True


def schedule_random_bot_slot(session, *, max_attempts: int = 5) -> None:
    bot_users = session.exec(
        select(User.id)
        .where(User.email.like(BOT_EMAIL_PATTERN))
    ).all()
    if not bot_users:
        return
    attempts = 0
    while attempts < max_attempts:
        chosen_user_id = random.choice(bot_users)[0]
        profile = session.exec(
            select(Profile).where(Profile.user_id == chosen_user_id)
        ).first()
        if not profile:
            attempts += 1
            continue
        if _create_slot_for_profile(session, profile):
            session.commit()
            return
        session.rollback()
        attempts += 1
