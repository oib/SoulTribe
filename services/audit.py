from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from models import Match, Meetup

logger = logging.getLogger("audit")


def _utc_iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    try:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc).isoformat()
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return dt.isoformat()


def _match_payload(match: Optional[Match]) -> Dict[str, Any]:
    if match is None:
        return {
            "match_id": None,
            "a_user_id": None,
            "b_user_id": None,
            "status": None,
            "comment_length": None,
        }
    return {
        "match_id": match.id,
        "a_user_id": match.a_user_id,
        "b_user_id": match.b_user_id,
        "status": match.status,
        "comment_length": len(match.comment or ""),
    }


def _meetup_payload(meetup: Optional[Meetup]) -> Dict[str, Any]:
    if meetup is None:
        return {
            "meetup_id": None,
            "match_id": None,
            "proposer_user_id": None,
            "confirmer_user_id": None,
            "status": None,
            "proposed_dt_utc": None,
            "confirmed_dt_utc": None,
        }
    return {
        "meetup_id": meetup.id,
        "match_id": meetup.match_id,
        "proposer_user_id": meetup.proposer_user_id,
        "confirmer_user_id": meetup.confirmer_user_id,
        "status": meetup.status,
        "proposed_dt_utc": _utc_iso(meetup.proposed_dt_utc),
        "confirmed_dt_utc": _utc_iso(meetup.confirmed_dt_utc),
    }


def log_match_annotation(
    *,
    match: Optional[Match],
    actor_user_id: Optional[int],
    success: bool,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    payload: Dict[str, Any] = {
        "event": "match.annotate",
        "actor_user_id": actor_user_id,
        "success": success,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "metadata": metadata or {},
    }
    payload.update(_match_payload(match))
    logger.info(json.dumps(payload, sort_keys=True))


def log_meetup_event(
    *,
    meetup: Optional[Meetup],
    actor_user_id: Optional[int],
    action: str,
    success: bool,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    payload: Dict[str, Any] = {
        "event": f"meetup.{action}",
        "actor_user_id": actor_user_id,
        "success": success,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "metadata": metadata or {},
    }
    payload.update(_meetup_payload(meetup))
    logger.info(json.dumps(payload, sort_keys=True))
