#!/usr/bin/env python3
from __future__ import annotations
import os
import random
import subprocess
from datetime import datetime, timedelta, timezone
from typing import List, Tuple

from dotenv import load_dotenv
from sqlmodel import select

from db import session_scope, init_db
from models import User, Profile, Radix, AvailabilitySlot, Match
from services.scoring import score_pair

LOOKAHEAD_DAYS = 3
SLOTS_PER_USER = (3, 6)  # inclusive range
DUR_HOURS_CHOICES = [1, 2, 3]  # must be whole hours


def hour_aligned(dt: datetime, *, up: bool) -> datetime:
    dt = dt.astimezone(timezone.utc)
    if up:
        base = dt.replace(minute=0, second=0, microsecond=0)
        if dt == base:
            return base
        return base + timedelta(hours=1)
    else:
        return dt.replace(minute=0, second=0, microsecond=0)


def seed_availability() -> int:
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=LOOKAHEAD_DAYS)
    total = 0
    with session_scope() as session:
        users = session.exec(select(User)).all()
        for u in users:
            # Create 2-4 random slots
            n = random.randint(*SLOTS_PER_USER)
            for _ in range(n):
                # pick random day/hour within horizon
                rand_secs = random.randint(0, int((horizon - now).total_seconds()))
                start = now + timedelta(seconds=rand_secs)
                start = hour_aligned(start, up=True)
                dur_h = random.choice(DUR_HOURS_CHOICES)
                end = start + timedelta(hours=dur_h)
                # enforce unique-ish by checking overlap with existing for this user
                exists = session.exec(
                    select(AvailabilitySlot).where(
                        (AvailabilitySlot.user_id == u.id)
                        & (AvailabilitySlot.start_dt_utc <= end)
                        & (AvailabilitySlot.end_dt_utc >= start)
                    )
                ).first()
                if exists:
                    continue
                slot = AvailabilitySlot(user_id=u.id, start_dt_utc=start, end_dt_utc=end)
                session.add(slot)
                session.commit()
                total += 1
    return total


def annotate_top_matches_for(user_email: str, top_n: int = 3) -> List[Tuple[int, int]]:
    """Compute scores for user vs others (language intersection), create idempotent matches, run annotator.
    Returns list of (match_id, other_user_id).
    """
    out: List[Tuple[int, int]] = []
    with session_scope() as session:
        user = session.exec(select(User).where(User.email == user_email)).first()
        if not user:
            raise SystemExit(f"User not found: {user_email}")
        ra = session.get(Radix, user.id)
        pa = session.get(Profile, user.id)
        if not ra or not pa:
            raise SystemExit("User missing radix or profile")

        # collect candidates
        profiles = {p.user_id: p for p in session.exec(select(Profile)).all()}
        radices = session.exec(select(Radix)).all()

        def langs(p: Profile | None) -> set[str]:
            s: set[str] = set()
            if not p:
                return s
            if p.languages:
                s.update([x.strip().lower() for x in p.languages if isinstance(x, str)])
            if p.lang_primary:
                s.add(p.lang_primary.strip().lower())
            if p.lang_secondary:
                s.add(p.lang_secondary.strip().lower())
            return s

        L_a = langs(pa)
        scored: List[Tuple[int, int]] = []  # (score, other_id)
        for r in radices:
            if r.user_id == user.id:
                continue
            pb = profiles.get(r.user_id)
            if not pb:
                continue
            L_b = langs(pb)
            if L_a and L_b and L_a.isdisjoint(L_b):
                continue
            rb = r
            # flags
            a_known = bool(pa.birth_time_known)
            b_known = bool(pb.birth_time_known)
            moon_half = not (a_known and b_known)
            has_lang_overlap = bool(L_a and L_b and not L_a.isdisjoint(L_b))
            lp_equal = has_lang_overlap
            ls_equal = False
            score, _bd = score_pair(ra.json, rb.json, moon_half_weight=moon_half, lang_primary_equal=lp_equal, lang_secondary_equal=ls_equal)
            scored.append((score, r.user_id))
        scored.sort(reverse=True)
        top = scored[:top_n]

        for score, other_id in top:
            # idempotent match lookup
            existing = session.exec(
                select(Match).where(
                    ((Match.a_user_id == user.id) & (Match.b_user_id == other_id))
                    | ((Match.a_user_id == other_id) & (Match.b_user_id == user.id))
                )
            ).first()
            if existing:
                mid = existing.id
            else:
                # create new match with breakdown via score_pair again to store json
                rb = session.get(Radix, other_id)
                pb = profiles.get(other_id)
                a_known = bool(pa.birth_time_known)
                b_known = bool(pb.birth_time_known) if pb else True
                moon_half = not (a_known and b_known)
                has_lang_overlap = True  # by construction
                lp_equal = has_lang_overlap
                ls_equal = False
                sc, bd = score_pair(ra.json, rb.json, moon_half_weight=moon_half, lang_primary_equal=lp_equal, lang_secondary_equal=ls_equal)
                m = Match(a_user_id=user.id, b_user_id=other_id, score_numeric=sc, score_json=bd, status="suggested")
                session.add(m)
                session.commit()
                session.refresh(m)
                mid = m.id
            # run annotator via Node (uses .env)
            try:
                seq = [
                    f"Match {mid}",
                    f"Users: A={user.id} B={other_id}",
                    f"Score: {score}",
                    f"Breakdown: (omitted)",
                ]
                completed = subprocess.run([
                    "node", "dev/ollama_cli.mjs", __import__("json").dumps(seq)
                ], capture_output=True, text=True, cwd=".", timeout=60)
                if completed.returncode == 0:
                    comment = (completed.stdout or "").strip()
                    m = session.get(Match, mid)
                    m.comment = comment
                    session.add(m)
                    session.commit()
                else:
                    print("Annotator error:", completed.stderr.strip() or completed.stdout.strip())
            except Exception as e:
                print("Annotator exception:", e)
            out.append((mid, other_id))
    return out


def main():
    load_dotenv()
    init_db()
    total = seed_availability()
    print(f"Seeded {total} availability slots.")
    pairs = annotate_top_matches_for("gen001@example.com", top_n=3)
    print("Annotated matches:", pairs)


if __name__ == "__main__":
    main()
