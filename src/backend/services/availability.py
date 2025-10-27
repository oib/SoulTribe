from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Tuple, Dict, Any

# Slot is (start_dt_utc, end_dt_utc) both timezone-aware UTC datetimes
Slot = Tuple[datetime, datetime]


def _normalize_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _align_to_hour(dt: datetime, *, up: bool) -> datetime:
    dt = _normalize_utc(dt)
    if up:
        if dt.minute or dt.second or dt.microsecond:
            dt = dt.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        else:
            dt = dt.replace(minute=0, second=0, microsecond=0)
    else:
        dt = dt.replace(minute=0, second=0, microsecond=0)
    return dt


def intersect_hourly_slots(
    slots_a: Iterable[Slot],
    slots_b: Iterable[Slot],
    *,
    lookahead_days: int = 3,
    max_items: int = 5,
) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=lookahead_days)

    # Normalize and clip to [now, horizon]
    def norm_clip(slots: Iterable[Slot]) -> List[Slot]:
        out: List[Slot] = []
        for s, e in slots:
            s = _normalize_utc(s)
            e = _normalize_utc(e)
            if e <= s:
                continue
            # clip to [now, horizon]
            if e <= now or s >= horizon:
                continue
            s = max(s, now)
            e = min(e, horizon)
            out.append((s, e))
        return sorted(out, key=lambda x: x[0])

    A = norm_clip(slots_a)
    B = norm_clip(slots_b)

    i = j = 0
    results: List[Dict[str, Any]] = []
    one_hour = timedelta(hours=1)

    while i < len(A) and j < len(B) and len(results) < max_items:
        a_s, a_e = A[i]
        b_s, b_e = B[j]
        start = max(a_s, b_s)
        end = min(a_e, b_e)
        if end > start:
            # Align to whole-hour boundaries and enforce >= 1 hour
            start_aligned = _align_to_hour(start, up=True)
            end_aligned = _align_to_hour(end, up=False)
            if end_aligned - start_aligned >= one_hour:
                # If duration is more than 1h but not exact multiple, trim end to multiple of 1h
                duration = end_aligned - start_aligned
                hours = int(duration.total_seconds() // 3600)
                trimmed_end = start_aligned + timedelta(hours=hours)
                results.append({
                    "start_dt_utc": start_aligned,
                    "end_dt_utc": trimmed_end,
                })
        # Advance the pointer with the earlier end
        if a_e <= b_e:
            i += 1
        else:
            j += 1

    return results
