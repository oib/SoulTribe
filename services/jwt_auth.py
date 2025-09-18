from __future__ import annotations
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import jwt, JWTError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days default


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")


_bearer = HTTPBearer(auto_error=True)


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> int:
    if credentials is None or not credentials.scheme.lower() == "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        payload = verify_token(credentials.credentials)
        sub = payload.get("sub")
        if sub is None:
            raise ValueError("sub missing")
        return int(sub)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
