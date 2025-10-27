#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from typing import List

from sqlmodel import select

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from db import session_scope
from models import User, Profile
from dev.bot_locale_data import EU_BOT_LOCALES


def build_timezone_map() -> dict[str, dict]:
    tz_map: dict[str, dict] = {}
    for entry in EU_BOT_LOCALES:
        tz = entry.get("timezone")
        if tz and tz not in tz_map:
            tz_map[tz] = entry
    return tz_map


LOCATION_LANG_HINTS = {
    "berlin": "de",
    "vienna": "de",
    "paris": "fr",
    "madrid": "es",
    "rome": "it",
    "lisbon": "pt",
    "london": "en",
    "amsterdam": "nl",
    "brussels": "fr",
    "prague": "cs",
    "warsaw": "pl",
    "budapest": "hu",
    "bucharest": "ro",
    "athens": "el",
    "dublin": "en",
    "copenhagen": "da",
    "stockholm": "sv",
    "helsinki": "fi",
    "oslo": "no",
    "tallinn": "et",
    "riga": "lv",
    "vilnius": "lt",
    "ljubljana": "sl",
    "zagreb": "hr",
    "belgrade": "sr",
    "sarajevo": "bs",
    "skopje": "mk",
    "tirane": "sq",
    "kyiv": "uk",
    "minsk": "be",
    "reykjavik": "is",
    "luxembourg": "lb",
    "lisboa": "pt",
    "stuttgart": "de",
    "munich": "de",
    "cologne": "de",
    "tokyo": "en",
    "singapore": "en",
    "los angeles": "en",
    "new york": "en",
    "sydney": "en",
    "johannesburg": "en",
    "são paulo": "pt",
    "sao paulo": "pt",
    "wien": "de"
}


def normalize_languages(profile: Profile, locale: dict | None, birth_lang: str | None, tz_lang: str | None) -> bool:
    locale_primary = locale.get("primary_lang") if locale else None
    locale_secondaries: List[str] = list(locale.get("secondary_langs") or []) if locale else []

    ordered: List[str] = []

    def add_lang(lang: str | None) -> None:
        if lang and lang not in ordered:
            ordered.append(lang)

    # Prefer locale primary, then birth language
    add_lang(locale_primary or birth_lang or profile.lang_primary)
    add_lang(tz_lang)
    add_lang(birth_lang)
    for lang in locale_secondaries:
        add_lang(lang)
    if profile.languages:
        for lang in profile.languages:
            add_lang(lang)
    add_lang("en")

    if not ordered:
        return False

    changed = False

    if profile.lang_primary != ordered[0]:
        profile.lang_primary = ordered[0]
        changed = True

    new_secondary = ordered[1] if len(ordered) > 1 else None
    if (profile.lang_secondary or None) != new_secondary:
        profile.lang_secondary = new_secondary
        changed = True

    if profile.languages != ordered:
        profile.languages = ordered
        changed = True

    return changed


def main() -> None:
    tz_map = build_timezone_map()
    updated = 0
    skipped = 0
    with session_scope() as session:
        rows = session.exec(
            select(Profile, User)
            .join(User, Profile.user_id == User.id)
            .where(User.email.like('gen%@%'))
        ).all()
        for profile, user in rows:
            hint = None
            if profile.birth_place_name:
                lowered = profile.birth_place_name.lower()
                for key, lang in LOCATION_LANG_HINTS.items():
                    if key in lowered:
                        hint = lang
                        break
            tz_lang = None
            if profile.live_tz:
                lowered_tz = profile.live_tz.lower().replace('_', ' ')
                for key, lang in LOCATION_LANG_HINTS.items():
                    if key in lowered_tz:
                        tz_lang = lang
                        break
            locale = tz_map.get(profile.live_tz or "")
            if not locale:
                if tz_lang or hint:
                    locale = {"primary_lang": tz_lang or hint, "secondary_langs": []}
                else:
                    skipped += 1
                    continue
            if normalize_languages(profile, locale, hint, tz_lang):
                session.add(profile)
                updated += 1
        session.commit()
    print(f"Updated languages for {updated} profiles; skipped {skipped} without matching timezone")


if __name__ == "__main__":
    main()
