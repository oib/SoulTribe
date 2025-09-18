from __future__ import annotations
from sqlmodel import select
from db import get_session
from models import Radix, Profile, User
from services.scoring import score_pair


def run(user_id: int):
    with get_session() as session:
        user = session.get(User, user_id)
        print("user:", user)
        target_radix = session.get(Radix, user_id)
        target_profile = session.get(Profile, user_id)
        print("target_radix exists:", target_radix is not None)
        radices = session.exec(select(Radix)).all()
        profiles = {p.user_id: p for p in session.exec(select(Profile)).all()}
        out = []
        for row in radices:
            oid = row.user_id
            if oid == user_id:
                continue
            op = profiles.get(oid)
            if op is None:
                continue
            a_known = bool(target_profile.birth_time_known) if target_profile else True
            b_known = bool(op.birth_time_known)
            moon_half = not (a_known and b_known)
            lp_equal = (
                target_profile and op and (target_profile.lang_primary and target_profile.lang_primary == op.lang_primary)
            ) or False
            ls_equal = (
                target_profile and op and (target_profile.lang_secondary and target_profile.lang_secondary == op.lang_secondary)
            ) or False
            score, breakdown = score_pair(
                target_radix.json,
                row.json,
                moon_half_weight=bool(moon_half),
                lang_primary_equal=bool(lp_equal),
                lang_secondary_equal=bool(ls_equal),
            )
            out.append((oid, score))
        print("results:", out)


if __name__ == "__main__":
    run(1)
