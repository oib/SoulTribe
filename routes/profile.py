from __future__ import annotations
from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException
import traceback
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import subprocess, json
from sqlmodel import select

from db import get_session
from models import User, Profile, Radix
from schemas import ProfileUpdateIn, ProfileOut
from services.radix import compute_radix_json
from services.jwt_auth import get_current_user_id

router = APIRouter(prefix="/api/profile", tags=["profile"])

@router.get("/me")
def get_me(user_id: int = Depends(get_current_user_id), session = Depends(get_session)):
    """Lightweight auth check and basic profile snapshot for the current user.
    Returns minimal info and avoids 404 to keep UIs simple.
    """
    user = session.get(User, user_id)
    # It's possible to have a valid token for a deleted user; handle gracefully
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    prof = session.get(Profile, user_id)
    return {
        "user_id": user_id,
        "email": user.email,
        "email_verified": bool(user.email_verified_at),
        "display_name": getattr(prof, "display_name", None),
        "live_tz": getattr(prof, "live_tz", None),
    }

@router.get("", response_model=ProfileOut)
def get_profile(user_id: int = Depends(get_current_user_id), session = Depends(get_session)):
    # Ensure user exists
    if session.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")
    prof = session.get(Profile, user_id)
    if prof is None:
        prof = Profile(user_id=user_id)
        session.add(prof)
        session.commit()
    return ProfileOut(
        user_id=user_id,
        display_name=prof.display_name,
        birth_dt_utc=prof.birth_dt_utc,
        birth_time_known=prof.birth_time_known,
        birth_place_name=prof.birth_place_name,
        birth_lat=prof.birth_lat,
        birth_lon=prof.birth_lon,
        birth_tz=prof.birth_tz,
        live_tz=prof.live_tz,
        lang_primary=prof.lang_primary,
        lang_secondary=prof.lang_secondary,
        languages=prof.languages,
        house_system=prof.house_system,
    )


# --- AI Interpretation Endpoint ---
class InterpretIn(BaseModel):
    message: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None


class InterpretOut(BaseModel):
    reply: str


@router.post("/interpret", response_model=InterpretOut)
def interpret_profile(payload: InterpretIn, user_id: int = Depends(get_current_user_id), session = Depends(get_session)):
    # Ensure radix exists
    r = session.get(Radix, user_id)
    p = session.get(Profile, user_id)
    if r is None:
        raise HTTPException(status_code=404, detail="Radix not available")

    display_name = p.display_name if (p and p.display_name) else f"user {user_id}"
    intro = [
        "You are an insightful but concise astrologer. Provide a short, friendly reading in plain language (2-4 sentences).",
        f"User: {display_name}",
        f"Radix: {json.dumps(r.json, ensure_ascii=False)}",
    ]
    seq: List[str] = []
    seq.extend(intro)
    # Include prior turns if provided
    if payload and payload.history:
        try:
            for turn in payload.history:
                role = str(turn.get("role", "user")).lower()
                content = str(turn.get("content", "")).strip()
                if not content:
                    continue
                prefix = "You:" if role == "assistant" else "User:"
                seq.append(f"{prefix} {content}")
        except Exception:
            pass
    if payload and payload.message:
        seq.append(f"User: {payload.message}")
    else:
        seq.append("User: Please give me a brief, friendly interpretation of my natal chart.")

    try:
        completed = subprocess.run(
            ["node", "dev/ollama_cli.mjs", json.dumps(seq)],
            capture_output=True,
            text=True,
            cwd=".",
            timeout=60,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run ollama client: {e}")

    if completed.returncode != 0:
        err = (completed.stderr or completed.stdout or "").strip()
        raise HTTPException(status_code=502, detail=f"ollama client error: {err}")

    reply = (completed.stdout or "").strip()
    return InterpretOut(reply=reply)

@router.get("/radix")
def get_radix(user_id: int = Depends(get_current_user_id), session = Depends(get_session)):
    """Return the stored radix JSON for the current user.
    404 if not available yet (e.g., profile missing birth data).
    """
    r = session.get(Radix, user_id)
    if r is None:
        raise HTTPException(status_code=404, detail="Radix not available")
    # `Radix.json` property maps to underlying `data` field and DB column "json"
    return r.json

@router.put("", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdateIn,
    user_id: int = Depends(get_current_user_id),
    session = Depends(get_session),
):
    # 1) Ensure user exists
    if session.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")

    # 2) Upsert profile
    try:
        print("[profile.update] user_id=", user_id)
        try:
            # Avoid printing secrets; payload has no secrets
            print("[profile.update] payload:", {
                k: getattr(payload, k)
                for k in [
                    'display_name','birth_dt','birth_time_known','birth_place_name','birth_lat','birth_lon','birth_tz','live_tz','lang_primary','lang_secondary','languages','house_system'
                ]
            })
        except Exception:
            pass
    except Exception:
        pass
    prof = session.get(Profile, user_id)
    if prof is None:
        prof = Profile(user_id=user_id)
        session.add(prof)

    # Normalize birth_dt_utc with noon fallback when unknown
    birth_dt_utc = None
    if payload.birth_dt is not None:
        dt = payload.birth_dt
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt_utc = dt.astimezone(timezone.utc)
        if not payload.birth_time_known:
            dt_utc = dt_utc.replace(hour=12, minute=0, second=0, microsecond=0)
        birth_dt_utc = dt_utc

    # Apply fields
    if payload.display_name is not None: prof.display_name = payload.display_name
    if birth_dt_utc is not None:        prof.birth_dt_utc = birth_dt_utc
    prof.birth_time_known = payload.birth_time_known if payload.birth_time_known is not None else prof.birth_time_known
    if payload.birth_place_name is not None: prof.birth_place_name = payload.birth_place_name
    if payload.birth_lat is not None:       prof.birth_lat = payload.birth_lat
    if payload.birth_lon is not None:       prof.birth_lon = payload.birth_lon
    if payload.birth_tz is not None:        prof.birth_tz = payload.birth_tz
    if payload.live_tz is not None:         prof.live_tz = payload.live_tz
    if payload.lang_primary is not None:    prof.lang_primary = payload.lang_primary
    if payload.lang_secondary is not None:  prof.lang_secondary = payload.lang_secondary
    if payload.languages is not None:       prof.languages = payload.languages
    if payload.house_system is not None:    prof.house_system = payload.house_system

    session.commit()

    # 3) Recompute radix if we have enough data (birth_dt_utc exists)
    if prof.birth_dt_utc is not None:
        try:
            print("[profile.update] recomputing radix…", {
                "birth_dt_utc": str(prof.birth_dt_utc),
                "birth_time_known": prof.birth_time_known,
                "lat": prof.birth_lat,
                "lon": prof.birth_lon,
                "house_system": prof.house_system,
            })
            rjson = compute_radix_json(
                birth_dt_utc=prof.birth_dt_utc,
                birth_time_known=prof.birth_time_known,
                lat=prof.birth_lat,
                lon=prof.birth_lon,
                house_system=prof.house_system,
            )
            radix = session.get(Radix, user_id)
            if radix is None:
                radix = Radix(user_id=user_id, ref_dt_utc=prof.birth_dt_utc, json=rjson)
                session.add(radix)
            else:
                radix.ref_dt_utc = prof.birth_dt_utc
                radix.json = rjson
            session.commit()
        except Exception as e:
            print("[profile.update] radix recompute FAILED:", e)
            traceback.print_exc()
            # Keep profile update successful even if radix fails; return profile fields

    return ProfileOut(
        user_id=user_id,
        display_name=prof.display_name,
        birth_dt_utc=prof.birth_dt_utc,
        birth_time_known=prof.birth_time_known,
        birth_place_name=prof.birth_place_name,
        birth_lat=prof.birth_lat,
        birth_lon=prof.birth_lon,
        birth_tz=prof.birth_tz,
        live_tz=prof.live_tz,
        lang_primary=prof.lang_primary,
        lang_secondary=prof.lang_secondary,
        languages=prof.languages,
        house_system=prof.house_system,
    )
