from __future__ import annotations
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from db import get_session
from models import Match, Meetup, Profile, User
from services.jitsi import make_room_url
from services.jwt_auth import get_current_user_id
from services.rate_limit import rate_limit
from services.audit import log_meetup_event
from services.email import send_email
from services.email_templates import (
    SUPPORTED_EMAIL_LANGS,
    get_confirm_copy,
    get_propose_copy,
)

router = APIRouter(prefix="/api/meetup", tags=["meetup"])
logger = logging.getLogger("soultribe.meetup")


def _normalize_lang(code: str | None) -> str | None:
    if not code:
        return None
    primary = code.split("-", 1)[0].lower()
    return primary if primary in SUPPORTED_EMAIL_LANGS else None


def _resolve_email_lang(profile: Profile | None) -> str:
    if profile:
        for cand in (profile.lang_primary, profile.lang_secondary):
            lang = _normalize_lang(cand)
            if lang:
                return lang
    return "en"


class ProposeIn(BaseModel):
    match_id: int
    proposed_dt_utc: Optional[datetime] = None


class ProposeOut(BaseModel):
    meetup_id: int
    status: str


@router.post("/propose", response_model=ProposeOut, dependencies=[Depends(rate_limit("meetup:propose", limit=5, window_seconds=60))])
def propose(inp: ProposeIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    m = session.get(Match, inp.match_id)
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
        lang = _resolve_email_lang(other_profile)
        copy = get_propose_copy(lang)
        proposed_time = "(time pending)"
        proposed_local = None
        other_tz_label = None
        if mm.proposed_dt_utc:
            proposed_dt_utc = mm.proposed_dt_utc.astimezone(timezone.utc)
            proposed_time = proposed_dt_utc.strftime("%Y-%m-%d %H:%M UTC")
            other_tz = other_profile.live_tz if other_profile and other_profile.live_tz else None
            if other_tz:
                try:
                    proposed_local = proposed_dt_utc.astimezone(ZoneInfo(other_tz)).strftime("%Y-%m-%d %H:%M %Z")
                    other_tz_label = other_tz
                except Exception:
                    proposed_local = None
        dashboard_url = "https://soultribe.chat/login.html"
        subject = copy["subject"].format(proposer=proposer_name)
        html_parts = [
            f"<p>{copy['intro'].format(recipient=other_name)}</p>",
            f"<p>{copy['body'].format(proposer=proposer_name)}</p>",
            f"<p><strong>{copy['proposed_time_utc']}:</strong> {proposed_time}</p>",
        ]
        text_parts = [
            f"{copy['intro'].format(recipient=other_name)}\n\n",
            f"{copy['body'].format(proposer=proposer_name)}\n",
            f"{copy['proposed_time_utc']}: {proposed_time}\n",
        ]
        if proposed_local and other_tz_label:
            html_parts.append(f"<p><strong>{copy['proposed_time_local'].format(tz=other_tz_label)}:</strong> {proposed_local}</p>")
            text_parts.append(f"{copy['proposed_time_local'].format(tz=other_tz_label)}: {proposed_local}\n")
        html_parts.append(f"<p><a href=\"{dashboard_url}\">{copy['cta_html']}</a>.</p>")
        text_parts.append(f"{copy['cta_text']}: {dashboard_url}")
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
        f"<p>{{confirm_html}}</p>"
        f"<p>{{join_label}}: <a href=\"{url}\">{url}</a></p>"
        f"<p>{{manage_hint}}</p>"
    )
    text_body = (
        f"{{confirm_text}}\n"
        f"{{join_label}}: {url}\n\n"
        "{{manage_hint}}"
    )

    for recipient, name, label in (
        (proposer_user, proposer_name or "there", "proposer"),
        (confirmer_user, confirmer_name or "there", "confirmer"),
    ):
        if recipient and recipient.email_verified_at:
            profile = proposer_profile if label == "proposer" else confirmer_profile
            lang = _resolve_email_lang(profile)
            copy = get_confirm_copy(lang)
            subject = copy["subject"]
            personalized_html = (
                f"<p>{copy['intro_html'].format(recipient=name)}</p>"
                + html_body.format(
                    confirm_html=copy["meetup_confirmed_html"].format(time=confirmed_time),
                    join_label=copy["join_label"],
                    manage_hint=copy["manage_hint_html"],
                    url=url,
                )
            )
            personalized_text = (
                f"{copy['intro_text'].format(recipient=name)}\n\n"
                + text_body.format(
                    confirm_text=copy["meetup_confirmed_text"].format(time=confirmed_time),
                    join_label=copy["join_label"],
                    manage_hint=copy["manage_hint_text"],
                )
            )
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
        rows = session.exec(q).all()

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
    m = session.get(Match, mm.match_id)
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
