from __future__ import annotations
import os
import hashlib
import base64
from datetime import datetime, timezone


def _to_utc_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat()


def make_room_token(match_id: int, confirmed_dt_utc: datetime, *, secret: str | None = None) -> str:
    # Read secret at call time to pick up env changes
    s = secret or os.getenv("SECRET_KEY", "dev_secret_key")
    payload = f"{match_id}|{_to_utc_iso(confirmed_dt_utc)}|{s}".encode("utf-8")
    h = hashlib.sha256(payload).digest()
    token = base64.b32encode(h).decode("ascii").rstrip("=").lower()[:16]
    return f"soultribe_{token}"


def make_room_url(match_id: int, confirmed_dt_utc: datetime, *, base: str | None = None, secret: str | None = None) -> str:
    # Read base at call time to pick up env changes
    b = base or os.getenv("JITSI_BASE", "https://jitsi.soultribe.chat")
    token = make_room_token(match_id, confirmed_dt_utc, secret=secret)
    return f"{b.rstrip('/')}/{token}"
