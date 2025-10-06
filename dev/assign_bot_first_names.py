#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from itertools import cycle

from sqlmodel import select

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from db import session_scope
from models import User, Profile

FIRST_NAMES = [
    "Aiden", "Ava", "Ben", "Bella", "Caleb", "Chloe", "Dylan", "Daisy",
    "Eli", "Ella", "Finn", "Freya", "Gabe", "Grace", "Henry", "Hazel",
    "Ian", "Isla", "Jack", "Jade", "Kai", "Keira", "Leo", "Luna",
    "Mason", "Mia", "Noah", "Nora", "Owen", "Olive", "Parker", "Piper",
    "Quinn", "Riley", "Sam", "Sofia", "Theo", "Tessa", "Uri", "Una",
    "Vince", "Violet", "Wyatt", "Wren", "Xander", "Xena", "Yuri", "Yara",
    "Zane", "Zoe", "Adrian", "Alexa", "Blake", "Brielle", "Cole", "Cora",
    "Damon", "Delia", "Emmett", "Elsa", "Felix", "Fiona", "Gavin", "Gemma",
    "Hugo", "Helena", "Iker", "Ines", "Jasper", "Juno", "Kieran", "Kaia",
    "Landon", "Lena", "Miles", "Molly", "Nico", "Nina", "Oscar", "Opal",
    "Peter", "Paige", "Reid", "Romy", "Silas", "Siena", "Trent", "Talia",
    "Ulric", "Uma", "Victor", "Vera", "Wade", "Willow", "Xavi", "Ximena",
    "Yosef", "Yvette", "Zion", "Zara", "Arlo", "Ada", "Byron", "Bianca",
    "Cyrus", "Calla", "Derek", "Daria", "Edan", "Elsie", "Fraser", "Flora",
    "Gideon", "Gia", "Harvey", "Holly", "Irvin", "Ida", "Jared", "June",
    "Keaton", "Kira", "Lyle", "Lia", "Malik", "Maya", "Neal", "Nadia",
    "Omar", "Orla", "Pierce", "Priya", "Quentin", "Quilla", "Rhys", "Rhea",
    "Stellan", "Sage", "Torin", "Tia", "Ulises", "Ula", "Vaughn", "Vida",
    "Wes", "Willa", "Yann", "Yulia", "Zeke", "Zadie"
]


def is_placeholder(name: str | None) -> bool:
    if not name:
        return True
    lowered = name.strip().lower()
    return lowered.startswith("genuser") or lowered.startswith("user ") or lowered in {"test user", "testuser", "-"}


def main() -> None:
    assigned = 0
    names_iter = cycle(FIRST_NAMES)
    with session_scope() as session:
        results = session.exec(
            select(Profile, User)
            .join(User)
            .where(User.email.like('gen%'))
            .order_by(User.id)
        ).all()
        for profile, user in results:
            if not is_placeholder(profile.display_name):
                continue
            profile.display_name = next(names_iter)
            session.add(profile)
            assigned += 1
        session.commit()
    print(f"Updated display names for {assigned} users")


if __name__ == "__main__":
    main()
