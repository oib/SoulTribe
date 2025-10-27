#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import os
import secrets
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from zoneinfo import ZoneInfo

from argon2 import PasswordHasher
from dotenv import load_dotenv
from sqlmodel import select

# Ensure repo root is importable when running this script directly
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from db import init_db, session_scope  # noqa: E402
from models import AvailabilitySlot, Profile, User  # noqa: E402
from dev.bot_locale_data import EU_BOT_LOCALES  # noqa: E402

MIGRATION_ROOT = Path(REPO_ROOT) / "migrations/2025-09-bot-normalization"
LOGS_DIR = MIGRATION_ROOT / "logs"
STATE_PATH = MIGRATION_ROOT / "state.json"
ROLLBACK_PATH = LOGS_DIR / "rollback_snapshot.json"
EMAIL_MAP_PATH = LOGS_DIR / "email_mappings.csv"
NAME_MAP_PATH = LOGS_DIR / "display_name_mappings.csv"
INVENTORY_PATH = MIGRATION_ROOT / "bot_users_inventory.md"

SLOT_HOURS_LOCAL = [15, 16, 17]
PASSWORD_LENGTH = 16


@dataclass
class LocaleProfile:
    label: str
    timezone: str
    lat: float
    lon: float
    primary_lang: str
    secondary_langs: List[str]
    first_names: List[str]
    last_names: List[str]


def _coerce_locale(entry: dict) -> LocaleProfile:
    return LocaleProfile(
        label=entry["label"],
        timezone=entry["timezone"],
        lat=float(entry["lat"]),
        lon=float(entry["lon"]),
        primary_lang=entry["primary_lang"],
        secondary_langs=list(entry.get("secondary_langs", [])),
        first_names=list(entry.get("first_names", [])),
        last_names=list(entry.get("last_names", [])),
    )


LOCALES: List[LocaleProfile] = [_coerce_locale(entry) for entry in EU_BOT_LOCALES]
PH = PasswordHasher()


def ensure_dirs() -> None:
    MIGRATION_ROOT.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)


def load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text())
        except json.JSONDecodeError:
            pass
    return {"user_passwords": {}, "history": []}


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True))


def generate_password(user_id: int, state: dict) -> str:
    stored = state.get("user_passwords", {}).get(str(user_id))
    if stored:
        return stored
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+"
    password = "".join(secrets.choice(alphabet) for _ in range(PASSWORD_LENGTH))
    state.setdefault("user_passwords", {})[str(user_id)] = password
    return password


def replace_domain(email: str) -> tuple[str, str]:
    local, _at, _domain = email.partition("@")
    new_email = f"{local}@soultribe.chat"
    return new_email, local


def ensure_unique_email(session, desired_email: str, user_id: int) -> str:
    existing = session.exec(select(User).where(User.email == desired_email)).first()
    if not existing or existing.id == user_id:
        return desired_email
    local, domain = desired_email.split("@", 1)
    idx = 1
    candidate = f"{local}+{idx}@{domain}"
    while session.exec(select(User).where(User.email == candidate)).first():
        idx += 1
        candidate = f"{local}+{idx}@{domain}"
    return candidate


def pick_locale(user_id: int) -> LocaleProfile:
    index = user_id % len(LOCALES)
    return LOCALES[index]


def build_display_name(locale: LocaleProfile, user_id: int, used_names: set[str]) -> str:
    rng_seed = (user_id * 7919) % 2**32
    rng = secrets.SystemRandom()
    rng.seed = getattr(rng, "seed", None)  # silence type checker but no-op
    first = locale.first_names[user_id % len(locale.first_names)] if locale.first_names else f"Bot{user_id:03d}"
    last = locale.last_names[(user_id * 3) % len(locale.last_names)] if locale.last_names else "Soul"
    name = f"{first} {last}"
    if name in used_names:
        suffix = 2
        while f"{name} {suffix}" in used_names:
            suffix += 1
        name = f"{name} {suffix}"
    used_names.add(name)
    return name


def build_languages(locale: LocaleProfile) -> tuple[str, List[str]]:
    primary = locale.primary_lang
    secondary_pool = list(dict.fromkeys(locale.secondary_langs))
    if "en" not in secondary_pool and primary != "en":
        secondary_pool.append("en")
    languages = [primary, *secondary_pool]
    return primary, languages


def ensure_timezone(tz_name: Optional[str]) -> ZoneInfo:
    try:
        if tz_name:
            return ZoneInfo(tz_name)
    except Exception:
        pass
    return ZoneInfo("Europe/Vienna")


def ensure_slots_for_user(session, user_id: int, timezone_name: str, target_day: date) -> List[str]:
    tz = ensure_timezone(timezone_name)
    utc = ZoneInfo("UTC")
    created_slots: List[str] = []
    for hour in SLOT_HOURS_LOCAL:
        start_local = datetime.combine(target_day, time(hour=hour), tzinfo=tz)
        end_local = start_local + timedelta(hours=1)
        start_utc = start_local.astimezone(utc).replace(tzinfo=None)
        end_utc = end_local.astimezone(utc).replace(tzinfo=None)
        exists = session.exec(
            select(AvailabilitySlot).where(
                (AvailabilitySlot.user_id == user_id)
                & (AvailabilitySlot.start_dt_utc == start_utc)
            )
        ).first()
        if exists:
            created_slots.append(f"{start_local.strftime('%Y-%m-%d %H:%M')}–{end_local.strftime('%H:%M')} {timezone_name}")
            continue
        slot = AvailabilitySlot(
            user_id=user_id,
            start_dt_utc=start_utc,
            end_dt_utc=end_utc,
            start_dt_local=start_local.replace(tzinfo=None),
            end_dt_local=end_local.replace(tzinfo=None),
            timezone=timezone_name,
        )
        session.add(slot)
        created_slots.append(f"{start_local.strftime('%Y-%m-%d %H:%M')}–{end_local.strftime('%H:%M')} {timezone_name}")
    return created_slots


def build_inventory_markdown(rows: List[dict]) -> str:
    header = (
        "| id | email (@soultribe.chat) | original_email | password | display_name | birth_location | original_location | timezone | primary_lang | secondary_langs | slots (local 15–18) | notes |\n"
        "| --- | ----------------------- | --------------- | -------- | ------------ | --------------- | ---------------- | --------- | ------------ | ---------------- | ------------------- | ----- |\n"
    )
    lines = ["# Bot Users Inventory", "", "| id | email (@soultribe.chat) | original_email | password | display_name | birth_location | original_location | timezone | primary_lang | secondary_langs | slots (local 15–18) | notes |", "| --- | ----------------------- | --------------- | -------- | ------------ | --------------- | ---------------- | --------- | ------------ | ---------------- | ------------------- | ----- |"]
    for row in rows:
        line = "| {id} | {email} | {original_email} | `{password}` | {display_name} | {birth_location} | {original_location} | {timezone} | {primary_lang} | {secondary_langs} | {slots} | {notes} |".format(**row)
        lines.append(line)
    lines.append("")
    lines.append("> Inventory generated by `dev/bot_system_migration.py`. Update passwords after QA and remove this file from source control if it contains secrets.")
    return "\n".join(lines)


def main() -> None:
    load_dotenv()
    init_db()
    ensure_dirs()
    state = load_state()
    timestamp = datetime.utcnow().isoformat()

    inventory_rows: List[dict] = []
    email_mappings: List[tuple[int, str, str]] = []
    name_mappings: List[tuple[int, str, str]] = []
    rollback_snapshot: Dict[int, dict] = {}

    target_day = datetime.now(ZoneInfo("UTC")).astimezone(ZoneInfo("Europe/Vienna")).date() + timedelta(days=1)

    processed_users = 0
    created_slots_total = 0

    with session_scope() as session:
        users = session.exec(select(User).where(User.email.like('%@example.com'))).all()
        used_names = set(
            name for name, in session.exec(select(Profile.display_name).where(Profile.display_name.is_not(None)))
        )

        for user in users:
            profile: Optional[Profile] = session.get(Profile, user.id)
            if not profile:
                continue

            original_email = user.email
            original_display = profile.display_name or ""
            original_location = profile.birth_place_name or ""

            locale = pick_locale(user.id)
            display_name = build_display_name(locale, user.id, used_names)
            primary_lang, languages = build_languages(locale)
            secondary_langs = [lang for lang in languages[1:]]

            new_email, _local = replace_domain(user.email)
            new_email = ensure_unique_email(session, new_email, user.id)

            password_plain = generate_password(user.id, state)
            password_hash = PH.hash(password_plain)

            rollback_snapshot[user.id] = {
                "email": original_email,
                "password_hash": user.password_hash,
                "profile": {
                    "display_name": original_display,
                    "birth_place_name": profile.birth_place_name,
                    "birth_lat": profile.birth_lat,
                    "birth_lon": profile.birth_lon,
                    "birth_tz": profile.birth_tz,
                    "live_tz": profile.live_tz,
                    "lang_primary": profile.lang_primary,
                    "lang_secondary": profile.lang_secondary,
                    "languages": profile.languages,
                },
            }

            user.email = new_email
            user.password_hash = password_hash

            profile.display_name = display_name
            profile.birth_place_name = locale.label
            profile.birth_lat = locale.lat
            profile.birth_lon = locale.lon
            profile.birth_tz = locale.timezone
            profile.live_tz = locale.timezone
            profile.lang_primary = primary_lang
            profile.lang_secondary = secondary_langs[0] if secondary_langs else None
            profile.languages = languages

            created_slots = ensure_slots_for_user(session, user.id, locale.timezone, target_day)
            created_slots_total += len(created_slots)

            email_mappings.append((user.id, original_email, new_email))
            name_mappings.append((user.id, original_display or "", display_name))

            inventory_rows.append(
                {
                    "id": user.id,
                    "email": new_email,
                    "original_email": original_email,
                    "password": password_plain,
                    "display_name": display_name,
                    "birth_location": locale.label,
                    "original_location": original_location or "-",
                    "timezone": locale.timezone,
                    "primary_lang": primary_lang,
                    "secondary_langs": ", ".join(secondary_langs) if secondary_langs else "-",
                    "slots": ", ".join(created_slots) if created_slots else "-",
                    "notes": "",
                }
            )

            processed_users += 1
            session.add(user)
            session.add(profile)

        session.commit()

    state.setdefault("history", []).append({
        "timestamp": timestamp,
        "processed_users": processed_users,
    })
    save_state(state)

    if inventory_rows:
        INVENTORY_PATH.write_text(build_inventory_markdown(sorted(inventory_rows, key=lambda r: r["id"])))

    if email_mappings:
        with EMAIL_MAP_PATH.open("w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["user_id", "old_email", "new_email"])
            writer.writerows(email_mappings)

    if name_mappings:
        with NAME_MAP_PATH.open("w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["user_id", "old_display_name", "new_display_name"])
            writer.writerows(name_mappings)

    if rollback_snapshot:
        ROLLBACK_PATH.write_text(json.dumps(rollback_snapshot, indent=2, sort_keys=True))

    summary_path = LOGS_DIR / f"summary_{timestamp.replace(':', '-')}.json"
    summary_path.write_text(
        json.dumps(
            {
                "timestamp": timestamp,
                "processed_users": processed_users,
                "slots_created": created_slots_total,
                "inventory_path": str(INVENTORY_PATH.relative_to(REPO_ROOT)),
                "email_map_path": str(EMAIL_MAP_PATH.relative_to(REPO_ROOT)),
                "name_map_path": str(NAME_MAP_PATH.relative_to(REPO_ROOT)),
                "rollback_snapshot_path": str(ROLLBACK_PATH.relative_to(REPO_ROOT)),
            },
            indent=2,
            sort_keys=True,
        )
    )

    print(f"Processed users: {processed_users}")
    print(f"Availability slots created or confirmed: {created_slots_total}")
    print(f"Inventory written to: {INVENTORY_PATH}")
    print("Done.")


if __name__ == "__main__":
    main()
