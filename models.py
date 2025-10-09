from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column, JSON
from pydantic import ConfigDict

"""
Note: Avoid typing.Literal for SQLModel field types, it can cause type resolution
issues at runtime. Use plain str fields with defaults instead.
"""

class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    email_verified_at: datetime | None = None
    last_login_at: datetime | None = None


class EmailVerificationToken(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    token: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    used_at: datetime | None = None

class PasswordResetToken(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    token: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    used_at: datetime | None = None

class Profile(SQLModel, table=True):
    user_id: int = Field(primary_key=True, foreign_key="user.id", ondelete="CASCADE")
    display_name: str | None = None
    birth_dt_utc: datetime | None = None     # noon fallback upstream
    birth_time_known: bool = True
    birth_place_name: str | None = None
    birth_lat: float | None = None
    birth_lon: float | None = None
    birth_tz: str | None = None
    live_place_name: str | None = None
    live_lat: float | None = None
    live_lon: float | None = None
    live_tz: str | None = None  # user's current living timezone (IANA)
    lang_primary: str | None = None
    lang_secondary: str | None = None
    languages: list[str] | None = Field(default=None, sa_column=Column(JSON))
    house_system: str | None = None
    notify_email_meetups: bool = Field(default=True)
    notify_browser_meetups: bool = Field(default=True)

class Radix(SQLModel, table=True):
    # Allow population by alias, so we can use alias="json" for the DB/API while the Python attribute is different
    model_config = ConfigDict(populate_by_name=True)

    user_id: int = Field(primary_key=True, foreign_key="user.id", ondelete="CASCADE")
    ref_dt_utc: datetime
    method: str = "swisseph-noon-fallback"
    # Use a python-safe name, but keep DB column named "json" and API alias "json"
    data: dict = Field(sa_column=Column("json", JSON), alias="json")  # compact bodies-only JSON

    # Backward compatibility: expose .json as a property mapping to .data
    @property
    def json(self) -> dict:  # type: ignore[override]
        return self.data

    @json.setter
    def json(self, value: dict) -> None:  # type: ignore[override]
        self.data = value

class Match(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    a_user_id: int = Field(foreign_key="user.id", ondelete="CASCADE")
    b_user_id: int = Field(foreign_key="user.id", ondelete="CASCADE")
    score_numeric: int
    score_json: dict = Field(sa_column=Column(JSON))
    status: str = Field(default="suggested")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    comment: str | None = None
    comments_by_lang: dict[str, str] | None = Field(default=None, sa_column=Column(JSON))

class Meetup(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    match_id: int = Field(foreign_key="match.id", ondelete="CASCADE")
    proposed_dt_utc: datetime | None = None
    confirmed_dt_utc: datetime | None = None
    jitsi_room: str | None = None
    status: str = Field(default="proposed")
    proposer_user_id: int | None = None
    confirmer_user_id: int | None = None

class GeoCache(SQLModel, table=True):
    name: str = Field(primary_key=True)       # "City, Country"
    lat: float | None = None
    lon: float | None = None
    tz: str | None = None
    source: str | None = None


class AvailabilitySlot(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    start_dt_utc: datetime
    end_dt_utc: datetime
    start_dt_local: datetime | None = None  # User's local time when slot was created
    end_dt_local: datetime | None = None    # User's local time when slot was created
    timezone: str | None = None             # User's timezone (IANA) when slot was created
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RefreshToken(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", ondelete="CASCADE", index=True)
    token_hash: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    revoked_at: datetime | None = None
    client_ip: str | None = None
    user_agent: str | None = None
