from __future__ import annotations
import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

# Characters that must never appear in a display name: HTML-active chars
# (names are rendered into other users' dashboards) and control characters.
_DISPLAY_NAME_FORBIDDEN_RE = re.compile(r'[<>&"\'`/\\\x00-\x1f\x7f]')


class ProfileUpdateIn(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=40)

    @field_validator("display_name")
    @classmethod
    def _check_display_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if _DISPLAY_NAME_FORBIDDEN_RE.search(v):
            raise ValueError("display_name contains characters that are not allowed")
        return v
    birth_dt: Optional[datetime] = Field(default=None, description="If time unknown, still send a date (any time); we'll noon-fallback")
    birth_time_known: bool = True
    birth_place_name: Optional[str] = None
    birth_lat: Optional[float] = None
    birth_lon: Optional[float] = None
    birth_tz: Optional[str] = None
    live_place_name: Optional[str] = None
    live_lat: Optional[float] = None
    live_lon: Optional[float] = None
    live_tz: Optional[str] = None
    lang_primary: Optional[str] = None
    lang_secondary: Optional[str] = None
    languages: Optional[list[str]] = None
    house_system: Optional[str] = Field(default=None, description="House system code (e.g., 'P' Placidus, 'W' Whole Sign, 'K' Koch, 'E' Equal)")
    notify_email_meetups: Optional[bool] = Field(default=None, description="Receive meetup updates via email")
    notify_browser_meetups: Optional[bool] = Field(default=None, description="Receive meetup updates via browser notifications")

class ProfileOut(BaseModel):
    user_id: int
    display_name: Optional[str]
    birth_dt_utc: Optional[datetime]
    birth_dt_local: Optional[str]
    birth_time_known: bool
    birth_place_name: Optional[str]
    birth_lat: Optional[float]
    birth_lon: Optional[float]
    birth_tz: Optional[str]
    live_tz: Optional[str]
    lang_primary: Optional[str]
    lang_secondary: Optional[str]
    languages: Optional[list[str]]
    house_system: Optional[str]
    notify_email_meetups: bool = True
    notify_browser_meetups: bool = True
