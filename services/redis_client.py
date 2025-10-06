from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Optional

try:
    from redis import Redis  # type: ignore
except ImportError as exc:  # pragma: no cover - redis is optional
    raise RuntimeError("`redis` package is required for caching support.") from exc
DEFAULT_REDIS_DB = os.getenv("REDIS_DB", "1")
DEFAULT_REDIS_URL = f"redis://127.0.0.1:6379/{DEFAULT_REDIS_DB}"

logger = logging.getLogger(__name__)
_redis_warning_emitted = False

def _build_client() -> Optional[Redis]:
    url = os.getenv("REDIS_URL", DEFAULT_REDIS_URL)
    if not url:
        return None
    client = Redis.from_url(url, decode_responses=False)
    try:
        client.ping()
    except Exception as exc:
        _log_unavailable("ping failed", exc)
        return None
    return client


def get_redis_client() -> Optional[Redis]:
    """Return a reusable Redis client or ``None`` when unavailable."""

    try:
        client = _build_client()
        if client is None:
            _log_unavailable("no client")
        return client
    except Exception as exc:
        _log_unavailable("client error", exc)
        return None


def cache_get(key: str) -> Optional[bytes]:
    client = get_redis_client()
    if not client:
        _log_unavailable("cache_get skipped")
        return None
    try:
        return client.get(key)
    except Exception as exc:
        _log_unavailable(f"cache_get error for {key}", exc)
        return None


def cache_set(key: str, value: bytes, ttl_seconds: int | None = None) -> bool:
    client = get_redis_client()
    if not client:
        _log_unavailable("cache_set skipped")
        return False
    try:
        if ttl_seconds is None:
            client.set(key, value)
        else:
            client.setex(key, ttl_seconds, value)
        return True
    except Exception as exc:
        _log_unavailable(f"cache_set error for {key}", exc)
        return False


def cache_delete(key: str) -> None:
    client = get_redis_client()
    if not client:
        _log_unavailable("cache_delete skipped")
        return
    try:
        client.delete(key)
    except Exception as exc:
        _log_unavailable(f"cache_delete error for {key}", exc)


def _log_unavailable(context: str, exc: Exception | None = None) -> None:
    global _redis_warning_emitted
    if _redis_warning_emitted:
        return
    _redis_warning_emitted = True
    if exc:
        logger.warning("Redis unavailable (%s): %s", context, exc)
    else:
        logger.warning("Redis unavailable (%s)", context)
