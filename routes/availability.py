from __future__ import annotations
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlmodel import select
from sqlalchemy import text

from db import get_session
from models import AvailabilitySlot
from services.jwt_auth import get_current_user_id

router = APIRouter(prefix="/api/availability", tags=["availability"])


class SlotIn(BaseModel):
    start_dt_utc: datetime
    end_dt_utc: datetime
    start_dt_local: datetime | None = None
    end_dt_local: datetime | None = None
    timezone: str | None = None

    # Validator for UTC fields only
    @field_validator('start_dt_utc', 'end_dt_utc', mode='before')
    @classmethod
    def parse_utc_datetime(cls, v):
        print(f"UTC validator received: {v} (type: {type(v)})")
        if isinstance(v, str):
            if v.endswith('Z'):
                dt_str = v[:-1]
                result = datetime.fromisoformat(dt_str).replace(tzinfo=timezone.utc)
                print(f"Parsed UTC Z '{v}' -> {result}")
                return result
            elif '+' in v or '-' in v[-6:]:
                result = datetime.fromisoformat(v)
                print(f"Parsed UTC with offset -> {result}")
                return result
            else:
                # naive string for UTC fields: attach UTC
                result = datetime.fromisoformat(v).replace(tzinfo=timezone.utc)
                print(f"Parsed UTC naive -> {result}")
                return result
        return v

    # Validator for LOCAL fields only (keep naive; DO NOT attach UTC)
    @field_validator('start_dt_local', 'end_dt_local', mode='before')
    @classmethod
    def parse_local_datetime(cls, v):
        print(f"Local validator received: {v} (type: {type(v)})")
        if isinstance(v, str):
            # Strip trailing 'Z' if any and parse to naive
            s = v[:-1] if v.endswith('Z') else v
            try:
                dt = datetime.fromisoformat(s)
                # Ensure naive (no tzinfo)
                if dt.tzinfo is not None:
                    dt = dt.replace(tzinfo=None)
                print(f"Parsed LOCAL naive -> {dt}")
                return dt
            except Exception as ex:
                print(f"Local parse failed for '{v}': {ex}")
        return v


class SlotOut(BaseModel):
    id: int
    start_dt_utc: datetime
    end_dt_utc: datetime
    start_dt_local: datetime | None = None
    end_dt_local: datetime | None = None
    timezone: str | None = None


@router.get("", response_model=List[SlotOut])
def list_slots(session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    # Purge expired slots (no one can meet in the past)
    now = datetime.now(timezone.utc)
    expired = session.exec(
        select(AvailabilitySlot).where(
            (AvailabilitySlot.user_id == user_id) & (AvailabilitySlot.end_dt_utc <= now)
        )
    ).all()
    if expired:
        for r in expired:
            session.delete(r)
        session.commit()

    rows = session.exec(
        select(AvailabilitySlot)
        .where(AvailabilitySlot.user_id == user_id)
        .order_by(AvailabilitySlot.start_dt_utc)
    ).all()
    # Ensure timezone info is preserved in response
    result = []
    for r in rows:
        start_utc = r.start_dt_utc
        end_utc = r.end_dt_utc
        # Normalize to UTC in all cases for consistent JSON serialization
        if start_utc.tzinfo is None:
            start_utc = start_utc.replace(tzinfo=timezone.utc)
        else:
            start_utc = start_utc.astimezone(timezone.utc)
        if end_utc.tzinfo is None:
            end_utc = end_utc.replace(tzinfo=timezone.utc)
        else:
            end_utc = end_utc.astimezone(timezone.utc)
        result.append(SlotOut(
            id=r.id, 
            start_dt_utc=start_utc, 
            end_dt_utc=end_utc,
            start_dt_local=r.start_dt_local,
            end_dt_local=r.end_dt_local,
            timezone=r.timezone
        ))
    return result


@router.post("", response_model=SlotOut)
def create_slot(payload: SlotIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    # Normalize to UTC-aware
    s = payload.start_dt_utc
    e = payload.end_dt_utc
    # Datetimes should already be UTC from the validator
    print(f"Backend received: start={s} (tz={s.tzinfo}), end={e} (tz={e.tzinfo})")
    print(f"Raw payload: start_dt_utc={payload.start_dt_utc}, end_dt_utc={payload.end_dt_utc}")

    # 1) If the incoming payload fields are still strings with 'Z', force-parse them to aware UTC
    #    This must happen BEFORE any recomputation below.
    if isinstance(payload.start_dt_utc, str) and payload.start_dt_utc.endswith('Z'):
        s = datetime.fromisoformat(payload.start_dt_utc[:-1]).replace(tzinfo=timezone.utc)
        print(f"Force parsed start: {s}")
    if isinstance(payload.end_dt_utc, str) and payload.end_dt_utc.endswith('Z'):
        e = datetime.fromisoformat(payload.end_dt_utc[:-1]).replace(tzinfo=timezone.utc)
        print(f"Force parsed end: {e}")

    # 2) If client also sent local times and timezone, ALWAYS recompute UTC on the server
    try:
        if payload.timezone and payload.start_dt_local and payload.end_dt_local:
            tzname = str(payload.timezone).strip()
            tzinfo = ZoneInfo(tzname)
            s_local = payload.start_dt_local
            e_local = payload.end_dt_local
            # Attach tz to naive locals (treat as wall time in tz)
            if s_local.tzinfo is None:
                s_local = s_local.replace(tzinfo=tzinfo)
            else:
                s_local = s_local.astimezone(tzinfo)
            if e_local.tzinfo is None:
                e_local = e_local.replace(tzinfo=tzinfo)
            else:
                e_local = e_local.astimezone(tzinfo)

            recomputed_s = s_local.astimezone(timezone.utc)
            recomputed_e = e_local.astimezone(timezone.utc)
            print(f"Recomputed from local: start={recomputed_s}, end={recomputed_e}")
            s, e = recomputed_s, recomputed_e
    except Exception as ex:
        print(f"Warning: failed to recompute UTC from local/timezone: {ex}")
    if e <= s:
        raise HTTPException(status_code=400, detail="end_dt_utc must be after start_dt_utc")
    # Disallow past slots
    now = datetime.now(timezone.utc)
    if e <= now:
        raise HTTPException(status_code=400, detail="Cannot create availability in the past")

    # Enforce hour-step alignment (minutes/seconds/micros must be zero)
    if not (
        s.minute == 0 and s.second == 0 and s.microsecond == 0 and
        e.minute == 0 and e.second == 0 and e.microsecond == 0
    ):
        raise HTTPException(status_code=400, detail="start_dt_utc and end_dt_utc must be aligned to full hours (HH:00:00)")

    # Enforce minimum duration 1 hour and whole-hour steps
    duration_secs = (e - s).total_seconds()
    if duration_secs < 3600 or (duration_secs % 3600) != 0:
        raise HTTPException(status_code=400, detail="Minimum window is 1 hour, in whole-hour steps")

    # Get local times and timezone from payload
    s_local = payload.start_dt_local
    e_local = payload.end_dt_local
    tz = payload.timezone
    
    print(f"Backend storing: start={s} (tz={s.tzinfo}), end={e} (tz={e.tzinfo})")
    print(f"Local times: start_local={s_local}, end_local={e_local}, timezone={tz}")
    
    slot = AvailabilitySlot(
        user_id=user_id, 
        start_dt_utc=s, 
        end_dt_utc=e,
        start_dt_local=s_local,
        end_dt_local=e_local,
        timezone=tz
    )
    session.add(slot)
    session.commit()
    session.refresh(slot)
    print(f"Backend returning: start={slot.start_dt_utc} (tz={getattr(slot.start_dt_utc, 'tzinfo', None)})")
    # Best-effort dual write into availability_once tstzrange table (Postgres)
    try:
        stmt = text(
            """
            INSERT INTO availability_once (user_id, window_utc)
            VALUES (:uid, tstzrange(:s, :e, '[)'))
            ON CONFLICT DO NOTHING
            """
        ).bindparams(uid=user_id, s=s, e=e)
        session.exec(stmt)
        session.commit()
    except Exception as ex:
        # Do not fail request if the auxiliary table is missing
        print(f"availability_once dual-write skipped: {ex}")
    # Ensure timezone info is preserved in response
    start_out = slot.start_dt_utc
    end_out = slot.end_dt_utc
    if start_out.tzinfo is None:
        start_out = start_out.replace(tzinfo=timezone.utc)
    else:
        start_out = start_out.astimezone(timezone.utc)
    if end_out.tzinfo is None:
        end_out = end_out.replace(tzinfo=timezone.utc)
    else:
        end_out = end_out.astimezone(timezone.utc)
    # Compute local outputs from stored UTC using provided timezone, if available
    out_start_local = slot.start_dt_local
    out_end_local = slot.end_dt_local
    if slot.timezone:
        try:
            tzinfo = ZoneInfo(slot.timezone)
            out_start_local = start_out.astimezone(tzinfo)
            out_end_local = end_out.astimezone(tzinfo)
        except Exception:
            pass
    return SlotOut(
        id=slot.id,
        start_dt_utc=start_out,
        end_dt_utc=end_out,
        start_dt_local=out_start_local,
        end_dt_local=out_end_local,
        timezone=slot.timezone,
    )


class SlotUpdateIn(BaseModel):
    start_dt_utc: datetime
    end_dt_utc: datetime
    start_dt_local: datetime | None = None
    end_dt_local: datetime | None = None
    timezone: str | None = None

    # Reuse validators to handle Z-suffix and naive handling for UTC fields
    @field_validator('start_dt_utc', 'end_dt_utc', mode='before')
    @classmethod
    def parse_utc_datetime_update(cls, v):
        if isinstance(v, str):
            if v.endswith('Z'):
                return datetime.fromisoformat(v[:-1]).replace(tzinfo=timezone.utc)
            elif '+' in v or '-' in v[-6:]:
                return datetime.fromisoformat(v)
            else:
                return datetime.fromisoformat(v).replace(tzinfo=timezone.utc)
        return v

    @field_validator('start_dt_local', 'end_dt_local', mode='before')
    @classmethod
    def parse_local_datetime_update(cls, v):
        if isinstance(v, str):
            s = v[:-1] if v.endswith('Z') else v
            try:
                dt = datetime.fromisoformat(s)
                if dt.tzinfo is not None:
                    dt = dt.replace(tzinfo=None)
                return dt
            except Exception:
                return v
        return v


@router.patch("/{slot_id}", response_model=SlotOut)
def update_slot(slot_id: int, payload: SlotUpdateIn, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    slot = session.get(AvailabilitySlot, slot_id)
    if not slot or slot.user_id != user_id:
        raise HTTPException(status_code=404, detail="Slot not found")

    # Normalize to UTC-aware
    s = payload.start_dt_utc
    e = payload.end_dt_utc
    if s.tzinfo is None:
        s = s.replace(tzinfo=timezone.utc)
    else:
        s = s.astimezone(timezone.utc)
    if e.tzinfo is None:
        e = e.replace(tzinfo=timezone.utc)
    else:
        e = e.astimezone(timezone.utc)

    # If client provided local times + timezone, recompute UTC from those and update stored locals/timezone
    try:
        if payload.timezone and payload.start_dt_local and payload.end_dt_local:
            tzname = str(payload.timezone).strip()
            tzinfo = ZoneInfo(tzname)
            s_local = payload.start_dt_local
            e_local = payload.end_dt_local
            if s_local.tzinfo is None:
                s_local = s_local.replace(tzinfo=tzinfo)
            else:
                s_local = s_local.astimezone(tzinfo)
            if e_local.tzinfo is None:
                e_local = e_local.replace(tzinfo=tzinfo)
            else:
                e_local = e_local.astimezone(tzinfo)
            s = s_local.astimezone(timezone.utc)
            e = e_local.astimezone(timezone.utc)
            # Persist updated local fields and timezone on the slot
            slot.timezone = tzname
            # store naive versions of locals
            slot.start_dt_local = s_local.replace(tzinfo=None)
            slot.end_dt_local = e_local.replace(tzinfo=None)
    except Exception as ex:
        print(f"update_slot: failed to recompute from local/timezone: {ex}")
    if e <= s:
        raise HTTPException(status_code=400, detail="end_dt_utc must be after start_dt_utc")

    # Disallow past windows
    now = datetime.now(timezone.utc)
    if e <= now:
        raise HTTPException(status_code=400, detail="Cannot set availability in the past")

    # Enforce hour-step alignment
    if not (
        s.minute == 0 and s.second == 0 and s.microsecond == 0 and
        e.minute == 0 and e.second == 0 and e.microsecond == 0
    ):
        raise HTTPException(status_code=400, detail="start_dt_utc and end_dt_utc must be aligned to full hours (HH:00:00)")

    # Enforce minimum duration 1 hour and whole-hour steps
    duration_secs = (e - s).total_seconds()
    if duration_secs < 3600 or (duration_secs % 3600) != 0:
        raise HTTPException(status_code=400, detail="Minimum window is 1 hour, in whole-hour steps")

    # Update UTC fields
    slot.start_dt_utc = s
    slot.end_dt_utc = e

    # Recompute local fields from stored timezone (if any) for consistent UI rendering
    out_start_local = None
    out_end_local = None
    if getattr(slot, "timezone", None):
        try:
            tzinfo = ZoneInfo(slot.timezone)
            out_start_local = s.astimezone(tzinfo)
            out_end_local = e.astimezone(tzinfo)
            slot.start_dt_local = out_start_local.replace(tzinfo=None) if out_start_local.tzinfo else out_start_local
            slot.end_dt_local = out_end_local.replace(tzinfo=None) if out_end_local.tzinfo else out_end_local
        except Exception:
            # If timezone invalid, null out locals to force client fallback rendering
            slot.start_dt_local = None
            slot.end_dt_local = None

    session.add(slot)
    session.commit()
    session.refresh(slot)
    # Best-effort: maintain availability_once range index
    try:
        stmt2 = text(
            """
            INSERT INTO availability_once (user_id, window_utc)
            VALUES (:uid, tstzrange(:s, :e, '[)'))
            """
        ).bindparams(uid=user_id, s=slot.start_dt_utc, e=slot.end_dt_utc)
        session.exec(stmt2)
        session.commit()
    except Exception as ex:
        print(f"availability_once update skipped: {ex}")

    # Normalize UTC for response
    start_out = slot.start_dt_utc if slot.start_dt_utc.tzinfo else slot.start_dt_utc.replace(tzinfo=timezone.utc)
    end_out = slot.end_dt_utc if slot.end_dt_utc.tzinfo else slot.end_dt_utc.replace(tzinfo=timezone.utc)
    start_out = start_out.astimezone(timezone.utc)
    end_out = end_out.astimezone(timezone.utc)

    # Return full SlotOut so client can re-render immediately
    return SlotOut(
        id=slot.id,
        start_dt_utc=start_out,
        end_dt_utc=end_out,
        start_dt_local=slot.start_dt_local,
        end_dt_local=slot.end_dt_local,
        timezone=slot.timezone,
    )


@router.delete("/{slot_id}")
def delete_slot(slot_id: int, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    slot = session.get(AvailabilitySlot, slot_id)
    if not slot or slot.user_id != user_id:
        raise HTTPException(status_code=404, detail="Slot not found")
    session.delete(slot)
    session.commit()
    return {"ok": True}
