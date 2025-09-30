from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from zoneinfo import ZoneInfo
from datetime import datetime, timedelta

from services.scoring import score_pair
from db import get_session
from models import Radix, Profile, User
from models import Match
from services.jwt_auth import get_current_user_id
from models import AvailabilitySlot
from sqlalchemy import text
from services.availability import intersect_hourly_slots
import json
import re
import subprocess

router = APIRouter(prefix="/api/match", tags=["match"])

# Minimal display names for EU languages we support on the frontend; fallback to code
LANG_DISPLAY = {
    'en': 'English', 'de': 'German', 'fr': 'French', 'es': 'Spanish', 'it': 'Italian', 'pt': 'Portuguese',
    'nl': 'Dutch', 'sv': 'Swedish', 'no': 'Norwegian', 'da': 'Danish', 'fi': 'Finnish', 'is': 'Icelandic',
    'ga': 'Irish', 'cy': 'Welsh', 'mt': 'Maltese', 'lb': 'Luxembourgish', 'ca': 'Catalan', 'gl': 'Galician',
    'eu': 'Basque', 'pl': 'Polish', 'cs': 'Czech', 'sk': 'Slovak', 'hu': 'Hungarian', 'ro': 'Romanian',
    'bg': 'Bulgarian', 'hr': 'Croatian', 'sr': 'Serbian', 'sl': 'Slovene', 'mk': 'Macedonian', 'sq': 'Albanian',
    'bs': 'Bosnian', 'et': 'Estonian', 'lv': 'Latvian', 'lt': 'Lithuanian', 'el': 'Greek', 'tr': 'Turkish',
    'ru': 'Russian', 'uk': 'Ukrainian', 'be': 'Belarusian'
}


class MatchScoreIn(BaseModel):
    # Minimal input: two radix JSONs in the compact structure produced by services.radix.compute_radix_json
    a_radix: Dict[str, Any]
    b_radix: Dict[str, Any]
    # Flags to adjust weights
    a_birth_time_known: Optional[bool] = True
    b_birth_time_known: Optional[bool] = True
    lang_primary_equal: Optional[bool] = False
    lang_secondary_equal: Optional[bool] = False


class MatchScoreOut(BaseModel):
    score: int
    breakdown: Dict[str, Any]


@router.post("/score", response_model=MatchScoreOut)
def match_score(inp: MatchScoreIn) -> MatchScoreOut:
    # If either birth time is unknown, halve moon-related weights
    moon_half = not (inp.a_birth_time_known and inp.b_birth_time_known)
    score, breakdown = score_pair(
        inp.a_radix,
        inp.b_radix,
        moon_half_weight=moon_half,
        lang_primary_equal=bool(inp.lang_primary_equal),
        lang_secondary_equal=bool(inp.lang_secondary_equal),
    )
    return MatchScoreOut(score=score, breakdown=breakdown)


class MatchFindIn(BaseModel):
    user_id: int
    limit: Optional[int] = 20
    offset: Optional[int] = 0
    min_score: Optional[int] = None
    lookahead_days: Optional[int] = 3
    max_overlaps: Optional[int] = 5


class MatchCandidateOut(BaseModel):
    user_id: int
    score: int
    breakdown: Dict[str, Any]
    overlaps: Optional[List[Dict[str, Any]]] = None
    comment: Optional[str] = None
    match_id: Optional[int] = None
    other_display_name: Optional[str] = None
    # New: language overlap metadata for UI
    shared_languages: Optional[List[str]] = None
    primary_equal: Optional[bool] = None


@router.post("/find", response_model=List[MatchCandidateOut])
def match_find(
    inp: MatchFindIn,
    session=Depends(get_session),
    user_id: int = Depends(get_current_user_id),
    response: Response = None,
) -> List[MatchCandidateOut]:
    try:
        # Ensure user exists
        user = session.get(User, inp.user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        # Require email verification
        if not user.email_verified_at:
            raise HTTPException(status_code=403, detail="Email not verified")

        # Load target radix and profile
        target_radix = session.get(Radix, inp.user_id)
        target_profile = session.get(Profile, inp.user_id)
        if target_radix is None:
            raise HTTPException(status_code=400, detail="Target user has no radix computed yet")

        # Iterate other users with radices
        results: List[MatchCandidateOut] = []
        # naive scan: fetch all radices and profiles via ORM
        from sqlmodel import select
        radices = session.exec(select(Radix)).all()
        # Build a map user_id -> profile
        profiles = {p.user_id: p for p in session.exec(select(Profile)).all()}
        # Build a map user_id -> user (for activity filtering)
        users = {u.id: u for u in session.exec(select(User)).all()}
        cutoff = datetime.utcnow() - timedelta(days=30)

        def extract_langs(p: Profile | None) -> set[str]:
            langs: set[str] = set()
            if not p:
                return langs
            if getattr(p, "languages", None):
                langs.update([s.strip().lower() for s in p.languages if isinstance(s, str)])
            if p.lang_primary:
                langs.add(p.lang_primary.strip().lower())
            if p.lang_secondary:
                langs.add(p.lang_secondary.strip().lower())
            return langs

        target_langs = extract_langs(target_profile)

        for row in radices:
            other_user_id = row.user_id
            if other_user_id == inp.user_id:
                continue
            other_profile = profiles.get(other_user_id)
            if other_profile is None:
                continue
            # Activity filter: include users unless they have a last_login_at older than cutoff.
            # Do NOT exclude users with no last_login_at to avoid asymmetry in discovery.
            ou = users.get(other_user_id)
            if not ou:
                continue
            try:
                if getattr(ou, 'last_login_at', None) is not None and ou.last_login_at < cutoff:
                    continue
            except Exception:
                pass
            # Language intersection enforcement
            other_langs = extract_langs(other_profile)
            if target_langs and other_langs and target_langs.isdisjoint(other_langs):
                # No shared language → skip this candidate
                continue
            # Compute shared languages list for UI (stable order)
            shared_list = sorted(list(target_langs.intersection(other_langs))) if (target_langs and other_langs) else []
            # Determine moon_half_weight
            a_known = bool(target_profile.birth_time_known) if target_profile else True
            b_known = bool(other_profile.birth_time_known)
            moon_half = not (a_known and b_known)
            # Language flags for scoring bonus (original behavior):
            # - Any language overlap counts as primary_equal for scoring
            # - No separate secondary bonus
            has_lang_overlap = bool(target_langs and other_langs and not target_langs.isdisjoint(other_langs))
            lp_equal_for_scoring = has_lang_overlap
            ls_equal_for_scoring = False
            # For UI metadata only: primary_equal means exact equality of primary languages
            lp_equal = bool(
                target_profile and other_profile and 
                getattr(target_profile, 'lang_primary', None) and getattr(other_profile, 'lang_primary', None) and 
                str(target_profile.lang_primary).strip().lower() == str(other_profile.lang_primary).strip().lower()
            )

            score, breakdown = score_pair(
                target_radix.json,
                row.json,
                moon_half_weight=moon_half,
                lang_primary_equal=bool(lp_equal_for_scoring),
                lang_secondary_equal=bool(ls_equal_for_scoring),
            )
            # Compute availability overlaps (prefer SQL tstzrange over Python for performance)
            lookahead_days = int(inp.lookahead_days) if inp.lookahead_days is not None else 3
            max_items = int(inp.max_overlaps) if inp.max_overlaps is not None else 5
            overlaps: List[Dict[str, Any]] = []
            try:
                # Horizon and SQL overlap on availability_once
                sql = text(
                    """
                    WITH horizon AS (
                        SELECT now() AT TIME ZONE 'UTC' AS t0,
                               (now() AT TIME ZONE 'UTC') + (:days || ' days')::interval AS t1
                    ),
                    ua AS (
                        SELECT window_utc FROM availability_once WHERE user_id = :user_a
                          AND window_utc && tstzrange((SELECT t0 FROM horizon), (SELECT t1 FROM horizon), '[)')
                    ),
                    ub AS (
                        SELECT window_utc FROM availability_once WHERE user_id = :user_b
                          AND window_utc && tstzrange((SELECT t0 FROM horizon), (SELECT t1 FROM horizon), '[)')
                    )
                    SELECT 
                        GREATEST(lower(a.window_utc), lower(b.window_utc)) AS start_dt_utc,
                        LEAST(upper(a.window_utc),  upper(b.window_utc))  AS end_dt_utc
                    FROM ua a
                    JOIN ub b ON a.window_utc && b.window_utc
                    WHERE GREATEST(lower(a.window_utc), lower(b.window_utc)) < LEAST(upper(a.window_utc), upper(b.window_utc))
                    ORDER BY 1
                    LIMIT :lim
                    """
                )
                rows = session.exec(sql, {"user_a": inp.user_id, "user_b": other_user_id, "days": lookahead_days, "lim": max_items}).all()
                for r in rows:
                    # r is a Row with start_dt_utc, end_dt_utc
                    overlaps.append({
                        "start_dt_utc": r.start_dt_utc,
                        "end_dt_utc": r.end_dt_utc,
                    })
            except Exception as _ex:
                # Fallback to Python implementation if availability_once is missing
                from sqlmodel import select as _select
                a_slots = session.exec(
                    _select(AvailabilitySlot).where(AvailabilitySlot.user_id == inp.user_id)
                ).all()
                b_slots = session.exec(
                    _select(AvailabilitySlot).where(AvailabilitySlot.user_id == other_user_id)
                ).all()
                a_pairs = [(s.start_dt_utc, s.end_dt_utc) for s in a_slots]
                b_pairs = [(s.start_dt_utc, s.end_dt_utc) for s in b_slots]
                overlaps = intersect_hourly_slots(
                    a_pairs,
                    b_pairs,
                    lookahead_days=lookahead_days,
                    max_items=max_items,
                )
            # Add localized views (live_tz) for both users when possible
            a_tz = getattr(target_profile, "live_tz", None)
            b_tz = getattr(other_profile, "live_tz", None)
            enhanced_overlaps: List[Dict[str, Any]] = []
            for ov in overlaps:
                item = dict(ov)
                if a_tz:
                    try:
                        z = ZoneInfo(a_tz)
                        item["a_local_start"] = ov["start_dt_utc"].astimezone(z)
                        item["a_local_end"] = ov["end_dt_utc"].astimezone(z)
                        item["a_tz"] = a_tz
                    except Exception:
                        pass
                if b_tz:
                    try:
                        z = ZoneInfo(b_tz)
                        item["b_local_start"] = ov["start_dt_utc"].astimezone(z)
                        item["b_local_end"] = ov["end_dt_utc"].astimezone(z)
                        item["b_tz"] = b_tz
                    except Exception:
                        pass
                enhanced_overlaps.append(item)

            # If a Match already exists between these users, include its comment
            from sqlmodel import select as _select
            existing_match = session.exec(
                _select(Match).where(
                    ((Match.a_user_id == inp.user_id) & (Match.b_user_id == other_user_id)) |
                    ((Match.a_user_id == other_user_id) & (Match.b_user_id == inp.user_id))
                )
            ).first()
            comment = existing_match.comment if existing_match else None
            mid = existing_match.id if existing_match else None

            results.append(MatchCandidateOut(
                user_id=other_user_id,
                score=score,
                breakdown=breakdown,
                overlaps=enhanced_overlaps,
                comment=comment,
                match_id=mid,
                other_display_name=getattr(other_profile, "display_name", None),
                shared_languages=shared_list,
                primary_equal=lp_equal,
            ))

        # Apply min_score if provided
        if inp.min_score is not None:
            results = [r for r in results if r.score >= inp.min_score]

        # Sort and paginate (offset + limit)
        results.sort(key=lambda x: x.score, reverse=True)
        total = len(results)
        lim = int(inp.limit) if inp.limit is not None else total
        off = int(inp.offset) if inp.offset is not None else 0
        off = max(0, off)
        start = off
        end = start + max(0, lim)
        page = results[start:end]

        # Set pagination headers for clients
        if response is not None:
            try:
                response.headers["X-Total-Count"] = str(total)
                response.headers["X-Limit"] = str(lim)
                response.headers["X-Offset"] = str(off)
                response.headers["X-Has-More"] = "true" if end < total else "false"
            except Exception:
                # headers are best-effort; ignore if response not available
                pass

        return page
    except HTTPException:
        raise
    except Exception as e:
        # Surface message in 500 to help debugging
        raise HTTPException(status_code=500, detail=f"match_find failed: {e}")


class MatchCreateIn(BaseModel):
    a_user_id: int
    b_user_id: int


class MatchCreateOut(BaseModel):
    match_id: int
    score: int


@router.post("/create", response_model=MatchCreateOut)
def match_create(inp: MatchCreateIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)) -> MatchCreateOut:
    # Ensure users exist and have radices
    ua = session.get(User, inp.a_user_id)
    ub = session.get(User, inp.b_user_id)
    if ua is None or ub is None:
        raise HTTPException(status_code=404, detail="One or both users not found")

    # Idempotency: return existing match if already present (A-B or B-A)
    from sqlmodel import select as _select
    existing = session.exec(
        _select(Match).where(
            ((Match.a_user_id == inp.a_user_id) & (Match.b_user_id == inp.b_user_id)) |
            ((Match.a_user_id == inp.b_user_id) & (Match.b_user_id == inp.a_user_id))
        )
    ).first()
    if existing:
        return MatchCreateOut(match_id=existing.id, score=existing.score_numeric)
    ra = session.get(Radix, inp.a_user_id)
    rb = session.get(Radix, inp.b_user_id)
    if ra is None or rb is None:
        raise HTTPException(status_code=400, detail="One or both users missing radix")
    pa = session.get(Profile, inp.a_user_id)
    pb = session.get(Profile, inp.b_user_id)
    # Determine flags
    a_known = bool(pa.birth_time_known) if pa else True
    b_known = bool(pb.birth_time_known) if pb else True
    moon_half = not (a_known and b_known)
    lp_equal = (pa and pb and (pa.lang_primary and pa.lang_primary == pb.lang_primary)) or False
    ls_equal = (pa and pb and (pa.lang_secondary and pa.lang_secondary == pb.lang_secondary)) or False
    # Compute score
    score, breakdown = score_pair(ra.json, rb.json, moon_half_weight=moon_half, lang_primary_equal=bool(lp_equal), lang_secondary_equal=bool(ls_equal))
    # Create match
    m = Match(a_user_id=inp.a_user_id, b_user_id=inp.b_user_id, score_numeric=score, score_json=breakdown, status="suggested")
    session.add(m)
    session.commit()
    session.refresh(m)
    return MatchCreateOut(match_id=m.id, score=score)


class MatchAnnotateIn(BaseModel):
    match_id: int
    lang: Optional[str] = None


class MatchAnnotateOut(BaseModel):
    match_id: int
    comment: str


@router.post("/annotate", response_model=MatchAnnotateOut)
def match_annotate(inp: MatchAnnotateIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)) -> MatchAnnotateOut:
    m = session.get(Match, inp.match_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Match not found")

    # Build a compact sequence; instruct model to use 'you' and the other's display_name
    pa = session.get(Profile, m.a_user_id)
    pb = session.get(Profile, m.b_user_id)
    other_id = m.b_user_id if user_id == m.a_user_id else m.a_user_id
    other_prof = pb if user_id == m.a_user_id else pa
    # Do not expose display_name to the AI prompt/output; use a generic label
    other_name = (other_prof.display_name if (other_prof and other_prof.display_name) else f"user {other_id}")
    public_other_label = "the other person"
    perspective = "A" if user_id == m.a_user_id else "B"
    # Determine viewer's preferred language for the AI response
    viewer_prof = pa if perspective == "A" else pb
    try:
        # Order: request lang -> profile.lang_primary -> 'en'
        raw = (inp.lang or getattr(viewer_prof, 'lang_primary', None) or 'en')
        raw = str(raw).strip().lower()
        base = raw.split('-')[0] if raw else 'en'
        resp_lang = base if base else 'en'
    except Exception:
        resp_lang = 'en'
    try:
        print("[match.annotate] target_lang=", resp_lang)
    except Exception:
        pass
    # Derive top positive contributors from breakdown to give the AI more context
    def top_positive_contributors(bd: dict, limit: int = 6) -> list[tuple[str,int]]:
        contrib: list[tuple[str,int]] = []
        try:
            if not isinstance(bd, dict):
                return contrib
            # core
            for k, v in (bd.get("core") or {}).items():
                if isinstance(v, (int, float)) and v > 0 and k != "moon_factor":
                    contrib.append((k, int(v)))
            # secondary
            for k, v in (bd.get("secondary") or {}).items():
                if isinstance(v, (int, float)) and v > 0:
                    contrib.append((k, int(v)))
            # NOTE: exclude language-related points from AI prompt to focus on radix-only interpretation
            # houses: collect bonus total and named items if any
            houses = bd.get("houses") or {}
            hb = houses.get("house_bonus_total")
            if isinstance(hb, (int, float)) and hb > 0:
                contrib.append(("houses", int(hb)))
            # angles
            for k, v in (bd.get("angles") or {}).items():
                if isinstance(v, (int, float)) and v > 0:
                    contrib.append((k, int(v)))
        except Exception:
            pass
        # sort by points desc and keep top
        contrib.sort(key=lambda x: x[1], reverse=True)
        return contrib[:limit]

    top_pos = top_positive_contributors(m.score_json or {})
    # We will not send points or a heading to the AI; keep for potential future use only
    pos_str = ""

    # Build a breakdown copy without language section for the AI
    bd_for_ai = dict(m.score_json or {})
    try:
        if isinstance(bd_for_ai, dict) and 'lang' in bd_for_ai:
            bd_for_ai = {k: v for k, v in bd_for_ai.items() if k != 'lang'}
    except Exception:
        pass

    lang_name = LANG_DISPLAY.get(resp_lang, resp_lang)
    seq = [
        f"RESPONSE LANGUAGE CODE: {resp_lang}",
        f"Please respond ONLY in {lang_name} ({resp_lang}). Do not use any other language.",
        f"Perspective: you are side {perspective}",
        # Provide only the raw breakdown data (without language) to ground the analysis
        f"Breakdown (languages removed): {json.dumps(bd_for_ai, ensure_ascii=False)}",
        "Write a friendly, helpful interpretation based only on chart/radix aspects (core, houses, angles). Do not discuss languages. Do not mention scores, points, or the word 'match'. Do not include section headings or bullet lists; write continuous prose. Address 'you' and refer to the other simply as 'the other person'. Do not refer to A or B.",
    ]

    # Call Node wrapper that uses dev/ollama.js to get a comment
    try:
        completed = subprocess.run(
            ["node", "dev/ollama_cli.mjs", json.dumps(seq)],
            capture_output=True,
            text=True,
            cwd=".",
            timeout=60,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run ollama client: {e}")

    if completed.returncode != 0:
        err = completed.stderr.strip() or completed.stdout.strip()
        raise HTTPException(status_code=502, detail=f"ollama client error: {err}")

    comment = (completed.stdout or "").strip()
    # Post-process to enforce 'you' and other_name instead of A/B
    def sanitize_comment(txt: str, perspective: str, other_name: str) -> str:
        t = txt
        # Replace common phrases first
        t = re.sub(r"\bA and B\b", f"you and {other_name}", t)
        t = re.sub(r"\bB and A\b", f"{other_name} and you", t)
        # Strip explicit match id or points if present
        t = re.sub(r"Match\s*#?\d+", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\b\d+\s*points\b", "", t, flags=re.IGNORECASE)
        # Token-level replacements by perspective
        if perspective == "A":
            t = re.sub(r"\bA\b", "you", t)
            t = re.sub(r"\bB\b", other_name, t)
        else:
            t = re.sub(r"\bB\b", "you", t)
            t = re.sub(r"\bA\b", other_name, t)
        return t
    comment = sanitize_comment(comment, perspective, public_other_label)
    # Store in DB
    m.comment = comment
    session.add(m)
    session.commit()

    return MatchAnnotateOut(match_id=m.id, comment=comment)


# Intentionally no manual comment editing endpoint; comments are generated by the AI via /api/match/annotate
