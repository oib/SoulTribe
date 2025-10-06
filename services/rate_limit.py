from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from fastapi import HTTPException, Request


class RateLimiter:
    """In-memory sliding window rate limiter keyed by (scope, identifier)."""

    def __init__(self) -> None:
        self._hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, scope: str, identifier: str, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        key = (scope, identifier)
        with self._lock:
            bucket = self._hits[key]
            cutoff = now - window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(0.0, bucket[0] + window_seconds - now)
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again later.",
                    headers={"Retry-After": str(int(retry_after) + 1)},
                )
            bucket.append(now)

            # Trim empty bucket to avoid unbounded growth when cleanup removed all entries
            if not bucket:
                self._hits.pop(key, None)


_rate_limiter = RateLimiter()


def rate_limit(scope: str, limit: int, window_seconds: int):
    """FastAPI dependency factory enforcing a per-identifier rate limit."""

    def dependency(request: Request) -> None:
        identifier = "unknown"
        client = getattr(request, "client", None)
        if client and client.host:
            identifier = client.host
        _rate_limiter.hit(scope, identifier, limit, window_seconds)

    return dependency
