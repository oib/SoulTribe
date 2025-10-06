from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import select
from sqlalchemy import delete
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
from services.rate_limit import rate_limit
from services.auth_tokens import (
    mint_refresh_token,
    get_refresh_token_record,
    revoke_refresh_token,
    purge_old_refresh_tokens,
    is_refresh_token_active,
)
from services.bot_slot_scheduler import schedule_random_bot_slot

router = APIRouter(prefix="/api/auth", tags=["auth"])
ph = PasswordHasher()

RESEND_VERIFICATION_COOLDOWN = timedelta(minutes=10)
VERIFICATION_TOKEN_TTL = timedelta(hours=24)

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


def _client_ip(request: Request | None) -> str | None:
    if not request:
        return None
    client = getattr(request, "client", None)
    if client and client.host:
        return client.host
    return None


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
    refresh_token: str
    # Dev convenience: include verification URL so email provider is optional in MVP
    verification_url: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class LoginOut(BaseModel):
    ok: bool
    access_token: str
    token_type: str = "bearer"
    refresh_token: str


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


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=1)


class RefreshOut(LoginOut):
    pass


@router.post("/register", response_model=RegisterOut)
def register(payload: RegisterIn, request: Request, session=Depends(get_session)):
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

    # Create email verification token (24h expiry)
    now = _utcnow_naive()
    raw = secrets.token_urlsafe(32)
    ver = EmailVerificationToken(
        user_id=user.id,
        token=raw,
        created_at=now,
        expires_at=now + timedelta(hours=24),
    )
    session.add(ver)
    session.commit()

    # Return an access token for immediate use and a verification URL (MVP)
    token = create_access_token({"sub": str(user.id), "email": user.email})
    verification_url = f"/api/auth/verify-email?token={raw}"

    # Always use production URL for email verification links
    base_url = "https://soultribe.chat"
    absolute_link = base_url.rstrip('/') + verification_url
    subj = "Verify your email — SoulTribe.chat"
    text = f"Welcome to SoulTribe.chat!\n\nClick to verify: {absolute_link}\n\nThis link expires in 24 hours."
    html = f"""
      <p>Welcome to <strong>SoulTribe.chat</strong>!</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href=\"{absolute_link}\">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
    """
    try:
        send_email(user.email, subj, html, text)
    except Exception:
        # Do not block registration if email fails in dev
        pass

    refresh_raw, refresh_rec = mint_refresh_token(
        user.id,
        client_ip=_client_ip(request),
        user_agent=request.headers.get("user-agent") if request else None,
    )
    session.add(refresh_rec)
    session.flush()
    purge_old_refresh_tokens(session, user)
    session.commit()

    return RegisterOut(
        ok=True,
        user_id=user.id,
        access_token=token,
        token_type="bearer",
        refresh_token=refresh_raw,
        verification_url=verification_url,
    )


@router.post("/login", response_model=LoginOut, dependencies=[Depends(rate_limit("auth:login", limit=5, window_seconds=60))])
def login(payload: LoginIn, request: Request, session=Depends(get_session)):
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    try:
        ph.verify(user.password_hash, payload.password)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if email is verified; allow localhost bypass for local dev
    if not user.email_verified_at:
        try:
            host = request.client.host if request and request.client else ''
        except Exception:
            host = ''
        if host not in {"127.0.0.1", "::1", "localhost"}:
            raise HTTPException(status_code=401, detail="Email not verified")
    
    # Record last login timestamp (UTC naive)
    now = _utcnow_naive()
    try:
        user.last_login_at = now
        session.add(user)
    except Exception:
        pass

    refresh_raw, refresh_rec = mint_refresh_token(
        user.id,
        client_ip=_client_ip(request),
        user_agent=request.headers.get("user-agent") if request else None,
    )
    session.add(refresh_rec)
    session.flush()
    purge_old_refresh_tokens(session, user)
    session.commit()

    # Trigger: schedule one random bot availability slot on each successful login
    try:
        schedule_random_bot_slot(session)
    except Exception:
        # Never block login if the scheduler fails
        pass

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return LoginOut(ok=True, access_token=token, token_type="bearer", refresh_token=refresh_raw)


@router.post("/reset-request", response_model=ResetRequestOut, dependencies=[Depends(rate_limit("auth:reset-request", limit=5, window_seconds=300))])
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

        base_url = os.getenv("BASE_URL", "https://soultribe.chat")
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


@router.post("/resend-verification", response_model=ResetRequestOut, dependencies=[Depends(rate_limit("auth:resend-verification", limit=3, window_seconds=600))])
def resend_verification(payload: ResetRequestIn, session=Depends(get_session)):
    """Resend the verification email for a user.

    This will resend the verification email if the user exists and is not already verified.
    For security, always returns success even if the email doesn't exist.
    """
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if user and not user.email_verified_at:
        now = _utcnow_naive()
        latest_token = session.exec(
            select(EmailVerificationToken)
            .where(EmailVerificationToken.user_id == user.id)
            .order_by(EmailVerificationToken.created_at.desc())
        ).first()

        token_to_send: EmailVerificationToken
        if latest_token and latest_token.used_at is None:
            token_created = _to_naive_utc(latest_token.created_at)
            token_expires = _to_naive_utc(latest_token.expires_at)
            if token_expires >= now:
                if now - token_created < RESEND_VERIFICATION_COOLDOWN:
                    # Cooldown active; reuse existing token without sending email again.
                    return ResetRequestOut(
                        ok=True,
                        message="A verification email was sent recently. Please check your inbox in a few minutes."
                    )
                # Reuse token, refresh timestamps to extend validity window
                latest_token.created_at = now
                latest_token.expires_at = now + VERIFICATION_TOKEN_TTL
                token_to_send = latest_token
            else:
                # Expired token: remove it and issue a new one
                session.delete(latest_token)
                session.commit()
                new_token = EmailVerificationToken(
                    user_id=user.id,
                    token=secrets.token_urlsafe(32),
                    created_at=now,
                    expires_at=now + VERIFICATION_TOKEN_TTL,
                )
                token_to_send = new_token
        else:
            new_token = EmailVerificationToken(
                user_id=user.id,
                token=secrets.token_urlsafe(32),
                created_at=now,
                expires_at=now + VERIFICATION_TOKEN_TTL,
            )
            token_to_send = new_token

        session.add(token_to_send)
        session.commit()

        # Send verification email
        base_url = os.getenv("BASE_URL", "https://soultribe.chat").rstrip('/')
        verification_url = f"{base_url}/api/auth/verify-email?token={token_to_send.token}"
        subj = "Verify your email — SoulTribe.chat"
        text = (
            "Welcome to SoulTribe.chat!\n\n"
            f"Click to verify your email: {verification_url}\n\n"
            "This link expires in 24 hours."
        )
        html = (
            "<h1>Welcome to <strong>SoulTribe.chat</strong>!</h1>"
            "<p>Click the button below to verify your email address:</p>"
            f"<p><a href=\"{verification_url}\" style=\"background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;\">Verify Email</a></p>"
            "<p>Or copy and paste this link in your browser:</p>"
            f"<p><code>{verification_url}</code></p>"
            "<p>This link expires in 24 hours.</p>"
        )
        try:
            send_email(user.email, subj, html, text)
        except Exception:
            pass

    # Always return success for security
    return ResetRequestOut(
        ok=True, 
        message="If an account exists and is not verified, a verification email has been sent."
    )

@router.post("/reset", response_model=ResetPerformOut, dependencies=[Depends(rate_limit("auth:reset", limit=5, window_seconds=300))])
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


@router.post(
    "/refresh",
    response_model=RefreshOut,
    dependencies=[Depends(rate_limit("auth:refresh", limit=10, window_seconds=300))],
)
def refresh_access_token(payload: RefreshIn, session=Depends(get_session), request: Request = None):
    record = get_refresh_token_record(session, payload.refresh_token)
    if not record or not is_refresh_token_active(record):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = session.get(User, record.user_id)
    if not user:
        revoke_refresh_token(session, record)
        session.commit()
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Refresh flows should count as activity; record last login timestamp
    try:
        user.last_login_at = _utcnow_naive()
        session.add(user)
    except Exception:
        pass

    revoke_refresh_token(session, record)

    new_refresh_raw, new_refresh_rec = mint_refresh_token(
        user.id,
        client_ip=_client_ip(request),
        user_agent=request.headers.get("user-agent") if request else None,
    )

    session.add(record)
    session.add(new_refresh_rec)
    session.flush()
    purge_old_refresh_tokens(session, user)
    session.commit()

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return RefreshOut(ok=True, access_token=token, token_type="bearer", refresh_token=new_refresh_raw)


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


from fastapi.responses import RedirectResponse
from fastapi import Request

@router.get("/verify-email")
async def verify_email_link(token: str, request: Request, session=Depends(get_session)):
    """Verify an email using a one-time token sent via email.
    This is a production endpoint used in verification emails.
    Security is enforced through token uniqueness, expiry, and one-time use.
    
    After successful verification, redirects to the verification success page."""
    # Get the base URL from the request
    base_url = "https://soultribe.chat"  # Always use production URL for redirects
    
    try:
        # Verify the token
        rec = session.exec(select(EmailVerificationToken).where(EmailVerificationToken.token == token)).first()
        if not rec:
            return RedirectResponse(url=f"{base_url}/verify-email.html?error=invalid_token")
            
        now = _utcnow_naive()
        if rec.used_at is not None:
            return RedirectResponse(url=f"{base_url}/verify-email.html?error=token_used")
            
        exp = _to_naive_utc(rec.expires_at)
        if exp < now:
            return RedirectResponse(url=f"{base_url}/verify-email.html?error=token_expired")
            
        # Get the user
        user = session.get(User, rec.user_id)
        if not user:
            return RedirectResponse(url=f"{base_url}/verify-email.html?error=user_not_found")
            
        # Update user and token
        user.email_verified_at = now
        rec.used_at = now
        session.add(user)
        session.add(rec)
        session.commit()
        
        # Redirect to success page
        return RedirectResponse(url=f"{base_url}/verify-email.html?verified=true")
        
    except Exception as e:
        # Log the error for debugging
        print(f"Error verifying email: {str(e)}")
        return RedirectResponse(url=f"{base_url}/verify-email.html?error=server_error")

    # This line is unreachable due to the return in the try block
    pass
