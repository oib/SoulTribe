from __future__ import annotations
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from db import init_db
from routes import profile as profile_routes
from routes import match as match_routes
from routes import auth as auth_routes
from routes import meetup as meetup_routes
from routes import availability as availability_routes
from routes import timezone as timezone_routes
from routes import admin as admin_routes


def create_app() -> FastAPI:
    app = FastAPI(title="SoulTribe.chat API")
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

# Mount only the public web frontend. The docs/ directory is not publicly served.
app.mount("/", StaticFiles(directory="web", html=True), name="web")
