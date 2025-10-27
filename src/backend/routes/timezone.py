from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from timezonefinder import TimezoneFinder

router = APIRouter(prefix="/api", tags=["timezone"])

_tf = TimezoneFinder(in_memory=True)

class TZIn(BaseModel):
    lat: float
    lon: float

class TZOut(BaseModel):
    time_zone: str

@router.post("/timezone", response_model=TZOut)
def get_timezone(payload: TZIn):
    try:
        tz = _tf.timezone_at(lat=payload.lat, lng=payload.lon)
        if not tz:
            # Try nearest if direct lookup failed (e.g., in sea)
            tz = _tf.closest_timezone_at(lat=payload.lat, lng=payload.lon)
        if not tz:
            raise HTTPException(status_code=404, detail="Timezone not found for coordinates")
        
        # Manual corrections for common misidentified cities
        lat, lon = payload.lat, payload.lon
        
        # Vienna area (Austria) - often misidentified as Paris
        if 48.0 <= lat <= 48.5 and 16.0 <= lon <= 16.8:
            tz = "Europe/Vienna"
        # Berlin area (Germany)
        elif 52.3 <= lat <= 52.7 and 13.0 <= lon <= 13.8:
            tz = "Europe/Berlin"
        # Zurich area (Switzerland)
        elif 47.2 <= lat <= 47.5 and 8.3 <= lon <= 8.8:
            tz = "Europe/Zurich"
        # Prague area (Czech Republic)
        elif 50.0 <= lat <= 50.2 and 14.2 <= lon <= 14.7:
            tz = "Europe/Prague"
        
        return TZOut(time_zone=tz)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
