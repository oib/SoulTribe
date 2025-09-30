from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class ProfileUpdateIn(BaseModel):
    display_name: Optional[str] = None
    birth_dt: Optional[datetime] = Field(default=None, description="If time unknown, still send a date (any time); we'll noon-fallback")
    birth_time_known: bool = True
    birth_place_name: Optional[str] = None
    birth_lat: Optional[float] = None
    birth_lon: Optional[float] = None
    birth_tz: Optional[str] = None
    live_tz: Optional[str] = None
    lang_primary: Optional[str] = None
    lang_secondary: Optional[str] = None
    languages: Optional[list[str]] = None
    house_system: Optional[str] = Field(default=None, description="House system code (e.g., 'P' Placidus, 'W' Whole Sign, 'K' Koch, 'E' Equal)")

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
