from __future__ import annotations
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
import os
from sqlmodel import select, func
from sqlalchemy import delete

from db import get_session
from sqlmodel import Session
from models import User, Profile, Radix, AvailabilitySlot, Meetup, Match, EmailVerificationToken, PasswordResetToken
from services.jwt_auth import get_current_user_id

router = APIRouter(prefix="/api/admin", tags=["admin"]) 


def _is_admin_user(user_id: int) -> bool:
    allow = os.getenv("ADMIN_USER_IDS", "").strip()
    if not allow:
        return False
    try:
        ids = {int(x.strip()) for x in allow.split(',') if x.strip()}
        return user_id in ids
    except Exception:
        return False


def _client_ip(request: Request) -> str:
    # If behind a trusted proxy, prefer X-Forwarded-For (first IP)
    if os.getenv("TRUST_PROXY", "0") == "1":
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(',')[0].strip()
    return request.client.host if request.client else ""


def _is_admin(request: Request, user_id: int | None = None) -> bool:
    # 1) localhost origin is always admin
    host = _client_ip(request)
    if host in {"127.0.0.1", "::1", "localhost"}:
        return True
    # 2) fallback to explicit allowlist by user_id if provided
    if user_id is not None and _is_admin_user(user_id):
        return True
    return False


@router.get("/stats")
def get_stats(
    request: Request,
    session: Session = Depends(get_session),
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not _is_admin(request, user_id):
        raise HTTPException(status_code=403, detail="Admin only")
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Core counts
    users = session.exec(select(func.count()).select_from(User)).one()
    users_verified = session.exec(
        select(func.count()).select_from(User).where(User.email_verified_at.is_not(None))
    ).one()
    users_active_30d = session.exec(
        select(func.count()).select_from(User).where(User.last_login_at.is_not(None), User.last_login_at >= month_ago)
    ).one()

    # We consider a "full radix" to be present when a Radix row exists for the user
    full_radix = session.exec(select(func.count()).select_from(Radix)).one()

    slots = session.exec(select(func.count()).select_from(AvailabilitySlot)).one()
    meetups = session.exec(select(func.count()).select_from(Meetup)).one()
    matches = session.exec(select(func.count()).select_from(Match)).one()

    # AI-related counts – best effort using available models
    # Use Match.comment as a proxy for generated comments (if used that way)
    ai_comments = session.exec(
        select(func.count()).select_from(Match).where(Match.comment.is_not(None))
    ).one()
    interpretations = 0  # No dedicated table available in current schema

    # Recent activity (latest 10 across various tables)
    recent: list[dict[str, Any]] = []

    latest_users = session.exec(select(User).order_by(User.created_at.desc()).limit(5)).all()
    for u in latest_users:
        recent.append({
            "ts": (u.created_at or now).isoformat() + "Z",
            "type": "user",
            "info": f"user_id={u.id}"
        })

    latest_slots = session.exec(select(AvailabilitySlot).order_by(AvailabilitySlot.created_at.desc()).limit(5)).all()
    for s in latest_slots:
        recent.append({
            "ts": (s.created_at or now).isoformat() + "Z",
            "type": "slot",
            "info": f"user_id={s.user_id} {s.start_dt_utc.isoformat()}→{s.end_dt_utc.isoformat()}"
        })

    latest_matches = session.exec(select(Match).order_by(Match.created_at.desc()).limit(5)).all()
    for m in latest_matches:
        recent.append({
            "ts": (m.created_at or now).isoformat() + "Z",
            "type": "match",
            "info": f"id={m.id} a={m.a_user_id} b={m.b_user_id} score={m.score_numeric}"
        })

    latest_meetups = session.exec(select(Meetup).order_by(Meetup.id.desc()).limit(5)).all()
    for me in latest_meetups:
        t = me.confirmed_dt_utc or me.proposed_dt_utc
        recent.append({
            "ts": (t or now).isoformat() + "Z",
            "type": "meetup",
            "info": f"id={me.id} match_id={me.match_id} status={me.status}"
        })

    # Simple breakdown metrics
    users_last_24h = session.exec(
        select(func.count()).select_from(User).where(User.created_at >= day_ago)
    ).one()
    slots_last_7d = session.exec(
        select(func.count()).select_from(AvailabilitySlot).where(AvailabilitySlot.created_at >= week_ago)
    ).one()

    breakdown = {
        "users.last_24h": users_last_24h,
        "slots.last_7d": slots_last_7d,
        "users.active_30d": users_active_30d,
    }

    return {
        "users": users,
        "users_verified": users_verified,
        "profiles_with_full_radix": full_radix,
        "slots": slots,
        "meetups": meetups,
        "matches": matches,
        "users_active_30d": users_active_30d,
        "ai_comments": ai_comments,
        "interpretations": interpretations,
        "recent": sorted(recent, key=lambda r: r.get("ts",""), reverse=True)[:50],
        "breakdown": breakdown,
        "generated_at": now.isoformat() + "Z",
    }


@router.get("/ping")
def admin_ping(request: Request, user_id: int = Depends(get_current_user_id)) -> dict[str, Any]:
    """Small endpoint for UIs to check if current user is admin."""
    if not _is_admin(request, user_id):
        raise HTTPException(status_code=403, detail="Admin only")
    return {"ok": True}


# Cleanup unverified users older than a threshold (default 24 hours)
@router.get("/cleanup-unverified/preview")
def cleanup_unverified_preview(
    request: Request,
    hours: int = 24,
    limit: int = 100,
    session: Session = Depends(get_session),
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not _is_admin(request, user_id):
        raise HTTPException(status_code=403, detail="Admin only")
    if hours <= 0:
        raise HTTPException(status_code=400, detail="hours must be > 0")
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    q = select(User).where(User.email_verified_at.is_(None), User.created_at < cutoff)
    users = session.exec(q).all()
    ids = [u.id for u in users if u.id is not None]
    return {
        "ok": True,
        "cutoff": cutoff.isoformat() + "Z",
        "count": len(ids),
        "ids_preview": ids[:max(0, min(limit, 200))],
    }


class CleanupRunOut(dict):
    ok: bool


@router.post("/cleanup-unverified/run")
def cleanup_unverified_run(
    request: Request,
    hours: int = 24,
    dry_run: bool = False,
    limit_report: int = 100,
    session: Session = Depends(get_session),
    user_id: int = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not _is_admin(request, user_id):
        raise HTTPException(status_code=403, detail="Admin only")
    if hours <= 0:
        raise HTTPException(status_code=400, detail="hours must be > 0")

    cutoff = datetime.utcnow() - timedelta(hours=hours)
    users = session.exec(
        select(User).where(User.email_verified_at.is_(None), User.created_at < cutoff)
    ).all()
    ids = [u.id for u in users if u.id is not None]

    if dry_run or not ids:
        return {
            "ok": True,
            "dry_run": True,
            "cutoff": cutoff.isoformat() + "Z",
            "to_delete": len(ids),
            "ids_preview": ids[:max(0, min(limit_report, 200))],
        }

    # Delete dependent tokens explicitly, then users (ON DELETE CASCADE covers others)
    session.exec(delete(EmailVerificationToken).where(EmailVerificationToken.user_id.in_(ids)))
    session.exec(delete(PasswordResetToken).where(PasswordResetToken.user_id.in_(ids)))
    res = session.exec(delete(User).where(User.id.in_(ids)))
    session.commit()

    deleted = res.rowcount if getattr(res, "rowcount", -1) not in (-1, None) else len(ids)
    return {
        "ok": True,
        "dry_run": False,
        "cutoff": cutoff.isoformat() + "Z",
        "deleted": deleted,
        "ids_preview": ids[:max(0, min(limit_report, 200))],
    }
