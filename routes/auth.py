from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import select
import secrets
from argon2 import PasswordHasher
import os

from db import get_session
from models import User, Profile, Radix, EmailVerificationToken, PasswordResetToken
from services.radix import compute_radix_json
from services.jwt_auth import create_access_token
from services.jwt_auth import get_current_user_id
from services.email import send_email
from fastapi import Request
from routes import admin as admin_routes

router = APIRouter(prefix="/api/auth", tags=["auth"])
ph = PasswordHasher()

# Datetime helpers: use naive UTC consistently for storage and comparisons
def _utcnow_naive() -> datetime:
    return datetime.utcnow()

def _to_naive_utc(dt: datetime) -> datetime:
    try:
        if dt.tzinfo is None:
            return dt
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    except Exception:
        return dt


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    display_name: str = Field(min_length=1)
    # Optional MVP fields; full profile can be updated later via /api/profile
    birth_dt: Optional[datetime] = None  # if unknown time, send any time; we'll noon-fallback
    birth_time_known: Optional[bool] = True
    birth_lat: Optional[float] = None
    birth_lon: Optional[float] = None
    lang_primary: Optional[str] = None
    lang_secondary: Optional[str] = None


class RegisterOut(BaseModel):
    ok: bool
    user_id: int
    access_token: str
    token_type: str = "bearer"
    # Dev convenience: include verification URL so email provider is optional in MVP
    verification_url: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class LoginOut(BaseModel):
    ok: bool
    access_token: str
    token_type: str = "bearer"


class ResetRequestIn(BaseModel):
    email: EmailStr


class ResetRequestOut(BaseModel):
    ok: bool
    message: str


class ResetPerformIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class ResetPerformOut(BaseModel):
    ok: bool
    message: str


@router.post("/register", response_model=RegisterOut)
def register(payload: RegisterIn, session=Depends(get_session)):
    # check for duplicate email
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # create user
    user = User(email=payload.email, password_hash=ph.hash(payload.password))
    session.add(user)
    session.commit()
    session.refresh(user)

    # create initial profile with required display_name; optional fields can follow
    prof = Profile(user_id=user.id, display_name=payload.display_name)
    session.add(prof)

    birth_dt_utc = None
    if payload.birth_dt is not None:
        dt = payload.birth_dt
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt_utc = dt.astimezone(timezone.utc)
        if not payload.birth_time_known:
            dt_utc = dt_utc.replace(hour=12, minute=0, second=0, microsecond=0)
        birth_dt_utc = dt_utc

    if birth_dt_utc is not None:
        prof.birth_dt_utc = birth_dt_utc
        prof.birth_time_known = bool(payload.birth_time_known)
    if payload.birth_lat is not None:
        prof.birth_lat = payload.birth_lat
    if payload.birth_lon is not None:
        prof.birth_lon = payload.birth_lon
    if payload.lang_primary is not None:
        prof.lang_primary = payload.lang_primary
    if payload.lang_secondary is not None:
        prof.lang_secondary = payload.lang_secondary

    session.commit()

    # compute radix snapshot if we have birth_dt_utc
    if prof.birth_dt_utc is not None:
        rjson = compute_radix_json(
            birth_dt_utc=prof.birth_dt_utc,
            birth_time_known=prof.birth_time_known,
            lat=prof.birth_lat,
            lon=prof.birth_lon,
        )
        radix = Radix(user_id=user.id, ref_dt_utc=prof.birth_dt_utc, json=rjson)
        session.add(radix)
        session.commit()

    # Create email verification token (48h expiry)
    now = _utcnow_naive()
    raw = secrets.token_urlsafe(32)
    ver = EmailVerificationToken(
        user_id=user.id,
        token=raw,
        created_at=now,
        expires_at=now + timedelta(hours=48),
    )
    session.add(ver)
    session.commit()

    # Return an access token for immediate use and a verification URL (MVP)
    token = create_access_token({"sub": str(user.id), "email": user.email})
    verification_url = f"/api/auth/verify-email?token={raw}"

    # Send email (dev prints to stdout). Use BASE_URL to build absolute link.
    base_url = os.getenv("BASE_URL", "https://soultribe.chat")
    absolute_link = base_url.rstrip('/') + verification_url
    subj = "Verify your email — SoulTribe.chat"
    text = f"Welcome to SoulTribe.chat!\n\nClick to verify: {absolute_link}\n\nThis link expires in 48 hours."
    html = f"""
      <p>Welcome to <strong>SoulTribe.chat</strong>!</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href=\"{absolute_link}\">Verify Email</a></p>
      <p>This link expires in 48 hours.</p>
    """
    try:
        send_email(user.email, subj, html, text)
    except Exception:
        # Do not block registration if email fails in dev
        pass

    return RegisterOut(ok=True, user_id=user.id, access_token=token, verification_url=verification_url)


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, session=Depends(get_session)):
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    try:
        ph.verify(user.password_hash, payload.password)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return LoginOut(ok=True, access_token=token)


@router.post("/reset-request", response_model=ResetRequestOut)
def reset_request(payload: ResetRequestIn, session=Depends(get_session)):
    user = session.exec(select(User).where(User.email == payload.email)).first()
    # Always return ok for privacy; only create token if user exists
    if user:
        now = _utcnow_naive()
        raw = secrets.token_urlsafe(32)
        rec = PasswordResetToken(
            user_id=user.id,
            token=raw,
            created_at=now,
            expires_at=now + timedelta(hours=2),
        )
        session.add(rec)
        session.commit()

        base_url = os.getenv("BASE_URL", "http://127.0.0.1:8001")
        link = base_url.rstrip('/') + f"/reset-password.html?token={raw}"
        subj = "Reset your password — SoulTribe.chat"
        text = f"We received a request to reset your password.\n\nClick: {link}\n\nIf you didn't request this, ignore this email."
        html = f"""
          <p>We received a request to reset your password.</p>
          <p><a href=\"{link}\">Reset Password</a></p>
          <p>If you didn't request this, please ignore this email.</p>
        """
        try:
            send_email(user.email, subj, html, text)
        except Exception:
            pass
    return ResetRequestOut(ok=True, message="If an account exists, a reset email has been sent.")


@router.post("/reset", response_model=ResetPerformOut)
def reset_password(payload: ResetPerformIn, session=Depends(get_session)):
    rec = session.exec(select(PasswordResetToken).where(PasswordResetToken.token == payload.token)).first()
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or used token")
    now = _utcnow_naive()
    if rec.used_at is not None:
        raise HTTPException(status_code=400, detail="Token already used")
    exp = _to_naive_utc(rec.expires_at)
    if exp < now:
        raise HTTPException(status_code=400, detail="Token expired")
    user = session.get(User, rec.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Set new password
    user.password_hash = ph.hash(payload.new_password)
    rec.used_at = now
    session.add(user)
    session.add(rec)
    session.commit()
    return ResetPerformOut(ok=True, message="Password has been reset. You can now log in.")


class VerifyIn(BaseModel):
    user_id: int


class VerifyOut(BaseModel):
    ok: bool
    user_id: int
    verified_at: datetime


@router.post("/verify", response_model=VerifyOut)
def verify_email(payload: VerifyIn, request: Request, session=Depends(get_session), user_id: int = Depends(get_current_user_id)):
    # Restrict to admins/localhost for safety
    if not admin_routes._is_admin(request, user_id):
        raise HTTPException(status_code=403, detail="Admin only")
    user = session.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    now = _utcnow_naive()
    user.email_verified_at = now
    session.add(user)
    session.commit()
    return VerifyOut(ok=True, user_id=user.id, verified_at=now)


class VerifyEmailLinkOut(BaseModel):
    ok: bool
    user_id: int
    verified_at: datetime


@router.get("/verify-email", response_model=VerifyEmailLinkOut)
def verify_email_link(token: str, session=Depends(get_session)):
    """Verify an email using a one-time token sent via email.
    This is a production endpoint used in verification emails.
    Security is enforced through token uniqueness, expiry, and one-time use."""
    rec = session.exec(select(EmailVerificationToken).where(EmailVerificationToken.token == token)).first()
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or used token")
    now = _utcnow_naive()
    if rec.used_at is not None:
        raise HTTPException(status_code=400, detail="Token already used")
    exp = _to_naive_utc(rec.expires_at)
    if exp < now:
        raise HTTPException(status_code=400, detail="Token expired")

    user = session.get(User, rec.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.email_verified_at = now
    rec.used_at = now
    session.add(user)
    session.add(rec)
    session.commit()

    return VerifyEmailLinkOut(ok=True, user_id=user.id, verified_at=now)
