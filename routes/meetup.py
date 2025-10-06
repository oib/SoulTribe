from __future__ import annotations
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional
from types import SimpleNamespace

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from pydantic import BaseModel
from sqlmodel import select

from db import get_session
from models import Match, Meetup, Profile, User
from services.jitsi import make_room_url
from services.jwt_auth import get_current_user_id
from services.rate_limit import rate_limit
from services.audit import log_meetup_event
from services.email import send_email

router = APIRouter(prefix="/api/meetup", tags=["meetup"])
logger = logging.getLogger("soultribe.meetup")

_LEGACY_MATCH_DETECTED = False


def _row_get(row, key: str, idx: int | None = None):
    if hasattr(row, key):
        return getattr(row, key)
    try:
        return row[key]
    except (KeyError, TypeError):
        if idx is not None:
            try:
                return row[idx]
            except (IndexError, TypeError):
                return None
    return None


def _mark_legacy_mode() -> None:
    global _LEGACY_MATCH_DETECTED
    if not _LEGACY_MATCH_DETECTED:
        logger.warning("match.comments_by_lang column missing; enabling legacy match fallbacks")
        _LEGACY_MATCH_DETECTED = True


def _load_match_with_fallback(session, match_id: int):
    try:
        return session.get(Match, match_id)
    except Exception as exc:
        if "comments_by_lang" not in str(exc):
            raise
        _mark_legacy_mode()
        try:
            session.rollback()
        except Exception:
            pass
        raw = session.exec(
            text(
                """
                SELECT id, a_user_id, b_user_id, score_numeric, score_json, status, created_at, comment
                FROM match
                WHERE id = :match_id
                LIMIT 1
                """
            ),
            params={"match_id": match_id},
        ).first()
        if not raw:
            return None
        return SimpleNamespace(
            id=_row_get(raw, "id", 0),
            a_user_id=_row_get(raw, "a_user_id", 1),
            b_user_id=_row_get(raw, "b_user_id", 2),
            score_numeric=_row_get(raw, "score_numeric", 3),
            score_json=_row_get(raw, "score_json", 4),
            status=_row_get(raw, "status", 5),
            created_at=_row_get(raw, "created_at", 6),
            comment=_row_get(raw, "comment", 7),
        )


class ProposeIn(BaseModel):
    match_id: int
    proposed_dt_utc: Optional[datetime] = None


class ProposeOut(BaseModel):
    meetup_id: int
    status: str


@router.post("/propose", response_model=ProposeOut, dependencies=[Depends(rate_limit("meetup:propose", limit=5, window_seconds=60))])
def propose(inp: ProposeIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    m = _load_match_with_fallback(session, inp.match_id)
    if m is None:
        log_meetup_event(meetup=None, actor_user_id=user_id, action="propose", success=False, metadata={"reason": "match_not_found", "match_id": inp.match_id})
        raise HTTPException(status_code=404, detail="Match not found")

    dt = inp.proposed_dt_utc or datetime.utcnow().replace(tzinfo=timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    mm = Meetup(match_id=m.id, proposed_dt_utc=dt, status="proposed", proposer_user_id=user_id)
    session.add(mm)
    session.commit()
    session.refresh(mm)

    # Notify the other participant via email if possible
    other_user_id = m.b_user_id if m.a_user_id == user_id else m.a_user_id
    proposer_user = session.get(User, user_id)
    other_user = session.get(User, other_user_id) if other_user_id else None
    proposer_profile = session.get(Profile, user_id)
    other_profile = session.get(Profile, other_user_id) if other_user_id else None

    proposer_name = (proposer_profile.display_name if proposer_profile and proposer_profile.display_name else proposer_user.email if proposer_user else "Someone")
    other_name = other_profile.display_name if other_profile and other_profile.display_name else (other_user.email if other_user else "there")

    if other_user and other_user.email_verified_at:
        proposed_time = "(time pending)"
        proposed_local = None
        if mm.proposed_dt_utc:
            proposed_dt_utc = mm.proposed_dt_utc.astimezone(timezone.utc)
            proposed_time = proposed_dt_utc.strftime("%Y-%m-%d %H:%M UTC")
            other_tz = other_profile.live_tz if other_profile and other_profile.live_tz else None
            if other_tz:
                try:
                    proposed_local = proposed_dt_utc.astimezone(ZoneInfo(other_tz)).strftime("%Y-%m-%d %H:%M %Z")
                except Exception:
                    proposed_local = None
        dashboard_url = "https://soultribe.chat/login.html"
        subject = f"SoulTribe meetup proposed by {proposer_name}"
        html_parts = [
            f"<p>Hi {other_name},</p>",
            f"<p>{proposer_name} proposed a new SoulTribe meetup.</p>",
            f"<p><strong>Proposed time (UTC):</strong> {proposed_time}</p>",
        ]
        text_parts = [
            f"Hi {other_name},\n\n",
            f"{proposer_name} proposed a new SoulTribe meetup.\n",
            f"Proposed time (UTC): {proposed_time}\n",
        ]
        if proposed_local:
            html_parts.append(f"<p><strong>Your time ({other_profile.live_tz}):</strong> {proposed_local}</p>")
            text_parts.append(f"Your time ({other_profile.live_tz}): {proposed_local}\n")
        html_parts.append(f"<p><a href=\"{dashboard_url}\">Open your SoulTribe dashboard</a> to confirm or suggest a different time.</p>")
        text_parts.append(f"Visit your dashboard to confirm or suggest a different time: {dashboard_url}")
        html = ''.join(html_parts)
        text = ''.join(text_parts)
        try:
            send_email(other_user.email, subject, html, text)
        except Exception as exc:  # pragma: no cover - best effort
            log_meetup_event(meetup=mm, actor_user_id=user_id, action="email_propose", success=False, metadata={"error": str(exc)})

    log_meetup_event(meetup=mm, actor_user_id=user_id, action="propose", success=True, metadata={})
    return ProposeOut(meetup_id=mm.id, status=mm.status)


class ConfirmIn(BaseModel):
    meetup_id: int
    confirmed_dt_utc: datetime


class ConfirmOut(BaseModel):
    meetup_id: int
    jitsi_url: str
    status: str


@router.post("/confirm", response_model=ConfirmOut, dependencies=[Depends(rate_limit("meetup:confirm", limit=5, window_seconds=60))])
def confirm(inp: ConfirmIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    mm = session.get(Meetup, inp.meetup_id)
    if mm is None:
        log_meetup_event(meetup=None, actor_user_id=user_id, action="confirm", success=False, metadata={"reason": "meetup_not_found", "meetup_id": inp.meetup_id})
        raise HTTPException(status_code=404, detail="Meetup not found")
    # Prevent the proposer from confirming their own meetup
    if mm.proposer_user_id == user_id:
        log_meetup_event(meetup=mm, actor_user_id=user_id, action="confirm", success=False, metadata={"reason": "proposer_cannot_confirm"})
        raise HTTPException(status_code=403, detail="Proposer cannot confirm their own meetup")

    dt = inp.confirmed_dt_utc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    # Generate Jitsi URL based on match and confirmation time
    url = make_room_url(mm.match_id, dt)

    mm.confirmed_dt_utc = dt
    mm.jitsi_room = url
    mm.status = "confirmed"
    mm.confirmer_user_id = user_id
    session.add(mm)
    session.commit()

    # Email both proposer and confirmer with the confirmed details, when available
    proposer_user = session.get(User, mm.proposer_user_id) if mm.proposer_user_id else None
    confirmer_user = session.get(User, user_id)
    proposer_profile = session.get(Profile, mm.proposer_user_id) if mm.proposer_user_id else None
    confirmer_profile = session.get(Profile, user_id)

    confirmed_time = dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    proposer_name = proposer_profile.display_name if proposer_profile and proposer_profile.display_name else (proposer_user.email if proposer_user else "")
    confirmer_name = confirmer_profile.display_name if confirmer_profile and confirmer_profile.display_name else (confirmer_user.email if confirmer_user else "")

    html_body = (
        f"<p>Your SoulTribe meetup is confirmed for <strong>{confirmed_time}</strong>.</p>"
        f"<p>Join link: <a href=\"{url}\">{url}</a></p>"
        "<p>You can manage the meetup from your dashboard if plans change.</p>"
    )
    text_body = (
        f"Your SoulTribe meetup is confirmed for {confirmed_time}.\n"
        f"Join link: {url}\n\n"
        "You can manage the meetup from your dashboard if plans change."
    )

    for recipient, name, label in (
        (proposer_user, proposer_name or "there", "proposer"),
        (confirmer_user, confirmer_name or "there", "confirmer"),
    ):
        if recipient and recipient.email_verified_at:
            subject = "SoulTribe meetup confirmed"
            personalized_html = f"<p>Hi {name},</p>" + html_body
            personalized_text = f"Hi {name},\n\n" + text_body
            try:
                send_email(recipient.email, subject, personalized_html, personalized_text)
            except Exception as exc:  # pragma: no cover - best effort
                log_meetup_event(meetup=mm, actor_user_id=user_id, action="email_confirm", success=False, metadata={"recipient": label, "error": str(exc)})

    log_meetup_event(meetup=mm, actor_user_id=user_id, action="confirm", success=True, metadata={})

    return ConfirmOut(meetup_id=mm.id, jitsi_url=url, status=mm.status)


class MeetupItem(BaseModel):
    meetup_id: int
    match_id: int
    other_user_id: int
    other_display_name: str | None = None
    proposer_user_id: int | None = None
    confirmer_user_id: int | None = None
    proposer_display_name: str | None = None
    confirmer_display_name: str | None = None
    status: str
    proposed_dt_utc: datetime | None
    confirmed_dt_utc: datetime | None
    jitsi_url: str | None


@router.get("/list", response_model=list[MeetupItem], dependencies=[Depends(rate_limit("meetup:list", limit=20, window_seconds=60))])
def list_meetups(
    session=Depends(get_session),
    user_id: int = Depends(get_current_user_id),
    limit: int = 50,
    offset: int = 0,
):
    logger.info(
        "meetup.list: start user=%s limit=%s offset=%s",
        user_id,
        limit,
        offset,
    )
    try:
        # Fetch meetups where the user is either a_user_id or b_user_id in the related match
        from sqlmodel import select
        q = (
            select(Meetup, Match)
            .join(Match, Match.id == Meetup.match_id)
            .where((Match.a_user_id == user_id) | (Match.b_user_id == user_id))
            .order_by(Meetup.id.desc())
            .limit(max(1, min(200, limit)))
            .offset(max(0, offset))
        )
        try:
            rows = session.exec(q).all()
        except Exception as exc:
            if "comments_by_lang" not in str(exc):
                raise
            _mark_legacy_mode()
            try:
                session.rollback()
            except Exception:
                pass
            raw_rows = session.exec(
                text(
                    """
                    SELECT
                        meetup.id                 AS meetup_id,
                        meetup.match_id           AS match_id,
                        meetup.proposed_dt_utc    AS proposed_dt_utc,
                        meetup.confirmed_dt_utc   AS confirmed_dt_utc,
                        meetup.jitsi_room         AS jitsi_room,
                        meetup.status             AS meetup_status,
                        meetup.proposer_user_id   AS proposer_user_id,
                        meetup.confirmer_user_id  AS confirmer_user_id,
                        match.a_user_id           AS match_a_user_id,
                        match.b_user_id           AS match_b_user_id
                    FROM meetup
                    JOIN match ON match.id = meetup.match_id
                    WHERE (match.a_user_id = :user_id OR match.b_user_id = :user_id)
                    ORDER BY meetup.id DESC
                    LIMIT :lim OFFSET :off
                    """
                ),
                params={
                    "user_id": user_id,
                    "lim": max(1, min(200, limit)),
                    "off": max(0, offset),
                },
            ).all()

            def _legacy_rows():
                for raw in raw_rows:
                    mm = SimpleNamespace(
                        id=_row_get(raw, "meetup_id", 0),
                        match_id=_row_get(raw, "match_id", 1),
                        proposed_dt_utc=_row_get(raw, "proposed_dt_utc", 2),
                        confirmed_dt_utc=_row_get(raw, "confirmed_dt_utc", 3),
                        jitsi_room=_row_get(raw, "jitsi_room", 4),
                        status=_row_get(raw, "meetup_status", 5),
                        proposer_user_id=_row_get(raw, "proposer_user_id", 6),
                        confirmer_user_id=_row_get(raw, "confirmer_user_id", 7),
                    )
                    match_obj = SimpleNamespace(
                        id=_row_get(raw, "match_id", 1),
                        a_user_id=_row_get(raw, "match_a_user_id", 8),
                        b_user_id=_row_get(raw, "match_b_user_id", 9),
                    )
                    yield mm, match_obj

            rows = list(_legacy_rows())

        items: list[MeetupItem] = []
        for mm, m in rows:
            other = m.b_user_id if m.a_user_id == user_id else m.a_user_id
            prof = session.get(Profile, other)
            proposer_prof = session.get(Profile, mm.proposer_user_id) if mm.proposer_user_id else None
            confirmer_prof = session.get(Profile, mm.confirmer_user_id) if mm.confirmer_user_id else None
            items.append(
                MeetupItem(
                    meetup_id=mm.id,
                    match_id=mm.match_id,
                    other_user_id=other,
                    other_display_name=(prof.display_name if prof else None),
                    proposer_user_id=mm.proposer_user_id,
                    confirmer_user_id=mm.confirmer_user_id,
                    proposer_display_name=(proposer_prof.display_name if proposer_prof else None),
                    confirmer_display_name=(confirmer_prof.display_name if confirmer_prof else None),
                    status=mm.status,
                    proposed_dt_utc=mm.proposed_dt_utc,
                    confirmed_dt_utc=mm.confirmed_dt_utc,
                    jitsi_url=mm.jitsi_room,
                )
            )
        logger.info(
            "meetup.list: success user=%s count=%s",
            user_id,
            len(items),
        )
        return items
    except Exception as exc:
        try:
            session.rollback()
        except Exception:
            pass
        logger.exception(
            "meetup.list: failed user=%s limit=%s offset=%s",
            user_id,
            limit,
            offset,
        )
        log_meetup_event(meetup=None, actor_user_id=user_id, action="list", success=False, metadata={"error": str(exc)})
        raise HTTPException(status_code=500, detail="Failed to list meetups") from exc


class SimpleMeetupIn(BaseModel):
    meetup_id: int


class SimpleMeetupOut(BaseModel):
    meetup_id: int
    status: str


@router.post("/unconfirm", response_model=SimpleMeetupOut, dependencies=[Depends(rate_limit("meetup:unconfirm", limit=5, window_seconds=60))])
def unconfirm(inp: SimpleMeetupIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    mm = session.get(Meetup, inp.meetup_id)
    if mm is None:
        log_meetup_event(meetup=None, actor_user_id=user_id, action="unconfirm", success=False, metadata={"reason": "meetup_not_found", "meetup_id": inp.meetup_id})
        raise HTTPException(status_code=404, detail="Meetup not found")
    # Only the confirmer may unconfirm
    if mm.confirmer_user_id != user_id:
        log_meetup_event(meetup=mm, actor_user_id=user_id, action="unconfirm", success=False, metadata={"reason": "not_confirmer"})
        raise HTTPException(status_code=403, detail="Only the confirmer can unconfirm the meetup")
    mm.status = "proposed"
    mm.confirmed_dt_utc = None
    mm.jitsi_room = None
    mm.confirmer_user_id = None
    session.add(mm)
    session.commit()
    log_meetup_event(meetup=mm, actor_user_id=user_id, action="unconfirm", success=True, metadata={})
    return SimpleMeetupOut(meetup_id=mm.id, status=mm.status)


class DeleteOut(BaseModel):
    deleted: bool


@router.delete("/{meetup_id}", response_model=DeleteOut, dependencies=[Depends(rate_limit("meetup:delete", limit=5, window_seconds=60))])
def delete_meetup(meetup_id: int, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    mm = session.get(Meetup, meetup_id)
    if mm is None:
        log_meetup_event(meetup=None, actor_user_id=user_id, action="delete", success=False, metadata={"reason": "meetup_not_found", "meetup_id": meetup_id})
        raise HTTPException(status_code=404, detail="Meetup not found")
    m = _load_match_with_fallback(session, mm.match_id)
    if m is None:
        log_meetup_event(meetup=mm, actor_user_id=user_id, action="delete", success=False, metadata={"reason": "match_not_found", "match_id": mm.match_id})
        raise HTTPException(status_code=404, detail="Match not found")
    # Only participants of the match may delete the meetup
    if not (m.a_user_id == user_id or m.b_user_id == user_id):
        log_meetup_event(meetup=mm, actor_user_id=user_id, action="delete", success=False, metadata={"reason": "not_participant"})
        raise HTTPException(status_code=403, detail="Not authorized to delete this meetup")
    session.delete(mm)
    session.commit()
    log_meetup_event(meetup=mm, actor_user_id=user_id, action="delete", success=True, metadata={})
    return DeleteOut(deleted=True)

@router.post("/cancel", response_model=SimpleMeetupOut, dependencies=[Depends(rate_limit("meetup:cancel", limit=5, window_seconds=60))])
def cancel(inp: SimpleMeetupIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    mm = session.get(Meetup, inp.meetup_id)
    if mm is None:
        log_meetup_event(meetup=None, actor_user_id=user_id, action="cancel", success=False, metadata={"reason": "meetup_not_found", "meetup_id": inp.meetup_id})
        raise HTTPException(status_code=404, detail="Meetup not found")
    mm.status = "canceled"
    mm.jitsi_room = None
    session.add(mm)
    session.commit()
    log_meetup_event(meetup=mm, actor_user_id=user_id, action="cancel", success=True, metadata={})
    return SimpleMeetupOut(meetup_id=mm.id, status=mm.status)
