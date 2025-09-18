from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from db import get_session
from models import Match, Meetup, Profile
from services.jitsi import make_room_url
from services.jwt_auth import get_current_user_id

router = APIRouter(prefix="/api/meetup", tags=["meetup"])


class ProposeIn(BaseModel):
    match_id: int
    proposed_dt_utc: Optional[datetime] = None


class ProposeOut(BaseModel):
    meetup_id: int
    status: str


@router.post("/propose", response_model=ProposeOut)
def propose(inp: ProposeIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    m = session.get(Match, inp.match_id)
    if m is None:
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
    return ProposeOut(meetup_id=mm.id, status=mm.status)


class ConfirmIn(BaseModel):
    meetup_id: int
    confirmed_dt_utc: datetime


class ConfirmOut(BaseModel):
    meetup_id: int
    jitsi_url: str
    status: str


@router.post("/confirm", response_model=ConfirmOut)
def confirm(inp: ConfirmIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    mm = session.get(Meetup, inp.meetup_id)
    if mm is None:
        raise HTTPException(status_code=404, detail="Meetup not found")
    # Prevent the proposer from confirming their own meetup
    if mm.proposer_user_id == user_id:
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


@router.get("/list", response_model=list[MeetupItem])
def list_meetups(
    session=Depends(get_session),
    user_id: int = Depends(get_current_user_id),
    limit: int = 50,
    offset: int = 0,
):
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
    return items


class SimpleMeetupIn(BaseModel):
    meetup_id: int


class SimpleMeetupOut(BaseModel):
    meetup_id: int
    status: str


@router.post("/unconfirm", response_model=SimpleMeetupOut)
def unconfirm(inp: SimpleMeetupIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    mm = session.get(Meetup, inp.meetup_id)
    if mm is None:
        raise HTTPException(status_code=404, detail="Meetup not found")
    # Only the confirmer may unconfirm
    if mm.confirmer_user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the confirmer can unconfirm the meetup")
    mm.status = "proposed"
    mm.confirmed_dt_utc = None
    mm.jitsi_room = None
    mm.confirmer_user_id = None
    session.add(mm)
    session.commit()
    return SimpleMeetupOut(meetup_id=mm.id, status=mm.status)


class DeleteOut(BaseModel):
    deleted: bool


@router.delete("/{meetup_id}", response_model=DeleteOut)
def delete_meetup(meetup_id: int, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    mm = session.get(Meetup, meetup_id)
    if mm is None:
        raise HTTPException(status_code=404, detail="Meetup not found")
    m = session.get(Match, mm.match_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Match not found")
    # Only participants of the match may delete the meetup
    if not (m.a_user_id == user_id or m.b_user_id == user_id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this meetup")
    session.delete(mm)
    session.commit()
    return DeleteOut(deleted=True)

@router.post("/cancel", response_model=SimpleMeetupOut)
def cancel(inp: SimpleMeetupIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    mm = session.get(Meetup, inp.meetup_id)
    if mm is None:
        raise HTTPException(status_code=404, detail="Meetup not found")
    mm.status = "canceled"
    mm.jitsi_room = None
    session.add(mm)
    session.commit()
    return SimpleMeetupOut(meetup_id=mm.id, status=mm.status)
