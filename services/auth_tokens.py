from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlmodel import Session, select

from models import RefreshToken, User

REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "14"))
REFRESH_TOKEN_BYTES = int(os.getenv("REFRESH_TOKEN_BYTES", "48"))
MAX_REFRESH_TOKENS_PER_USER = int(os.getenv("MAX_REFRESH_TOKENS_PER_USER", "20"))


def _utcnow_naive() -> datetime:
    return datetime.utcnow()


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def mint_refresh_token(
    user_id: int,
    *,
    client_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Tuple[str, RefreshToken]:
    """Create a new refresh token (plain string + DB record)."""
    raw = secrets.token_urlsafe(REFRESH_TOKEN_BYTES)
    now = _utcnow_naive()
    rec = RefreshToken(
        user_id=user_id,
        token_hash=_hash_token(raw),
        created_at=now,
        expires_at=now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return raw, rec


def get_refresh_token_record(session: Session, raw_token: str) -> RefreshToken | None:
    token_hash = _hash_token(raw_token)
    return session.exec(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).first()


def revoke_refresh_token(session: Session, record: RefreshToken) -> None:
    if record.revoked_at is None:
        record.revoked_at = _utcnow_naive()
        session.add(record)


def purge_old_refresh_tokens(session: Session, user: User) -> None:
    tokens = session.exec(
        select(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .order_by(RefreshToken.created_at.desc())
    ).all()
    if len(tokens) <= MAX_REFRESH_TOKENS_PER_USER:
        return
    # Revoke any excess tokens beyond the most recent MAX entries
    for record in tokens[MAX_REFRESH_TOKENS_PER_USER:]:
        revoke_refresh_token(session, record)


def is_refresh_token_active(record: RefreshToken) -> bool:
    now = _utcnow_naive()
    if record.revoked_at is not None:
        return False
    if record.expires_at < now:
        return False
    return True
