from __future__ import annotations
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from src.backend.db import init_db
from src.backend.routes import profile as profile_routes
from src.backend.routes import match as match_routes
from src.backend.routes import auth as auth_routes
from src.backend.routes import meetup as meetup_routes
from src.backend.routes import availability as availability_routes
from src.backend.routes import timezone as timezone_routes
from src.backend.routes import admin as admin_routes


class ProxyHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Check for X-Forwarded-Proto header
        forwarded_proto = request.headers.get("X-Forwarded-Proto")
        if forwarded_proto:
            request.scope["scheme"] = forwarded_proto
        
        # Check for X-Forwarded-Host header  
        forwarded_host = request.headers.get("X-Forwarded-Host")
        if forwarded_host:
            request.scope["server"] = (forwarded_host, 80)
            
        response = await call_next(request)
        return response


def create_app() -> FastAPI:
    app = FastAPI(title="SoulTribe.chat API")
    
    # Add ProxyHeadersMiddleware to handle forwarded headers from Nginx
    app.add_middleware(ProxyHeadersMiddleware)
    
    init_db()
    app.include_router(auth_routes.router)
    app.include_router(profile_routes.router)
    app.include_router(match_routes.router)
    app.include_router(meetup_routes.router)
    app.include_router(availability_routes.router)
    app.include_router(timezone_routes.router)
    app.include_router(admin_routes.router)

    @app.get("/api/health")
    def health():
        return {"ok": True}

    return app


app = create_app()

# Mount the built/static frontend bundle
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "public"
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="web")
