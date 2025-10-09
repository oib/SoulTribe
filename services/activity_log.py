from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from typing import Any, Mapping, MutableMapping

LOG_DIR = os.getenv("SOULTRIBE_LOG_DIR", "/home/oib/windsurf/soultribe.chat/log")
LOG_FILE = os.path.join(LOG_DIR, "activity.log")

_logger = logging.getLogger("activity")


def _ensure_logger() -> logging.Logger:
    if _logger.handlers:
        return _logger

    os.makedirs(LOG_DIR, exist_ok=True)
    handler = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=5)
    handler.setFormatter(logging.Formatter("%(message)s"))

    _logger.addHandler(handler)
    _logger.setLevel(logging.INFO)
    _logger.propagate = False
    return _logger


def _json_safe(metadata: Mapping[str, Any] | None) -> MutableMapping[str, Any]:
    if metadata is None:
        return {}
    try:
        json.dumps(metadata)
        return dict(metadata)
    except TypeError:
        safe: MutableMapping[str, Any] = {}
        for key, value in metadata.items():
            try:
                json.dumps({key: value})
                safe[key] = value
            except TypeError:
                safe[key] = repr(value)
        return safe


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_event(event: str, *, actor_user_id: int | None, metadata: Mapping[str, Any] | None = None) -> None:
    logger = _ensure_logger()
    payload: MutableMapping[str, Any] = {
        "event": event,
        "actor_user_id": actor_user_id,
        "timestamp": _utc_timestamp(),
        "metadata": _json_safe(metadata),
    }
    try:
        logger.info(json.dumps(payload, sort_keys=True))
    except Exception as exc:  # pragma: no cover - best effort
        logger.error("{\"event\": \"activity_log.failure\", \"error\": %s, \"payload\": %s}", repr(exc), payload)
