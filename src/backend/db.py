from __future__ import annotations
import os
from contextlib import contextmanager
from sqlmodel import SQLModel, Session, create_engine
from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://soultribe:pass@localhost:5432/soultribe")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

def init_db() -> None:
    # ensure models are imported so tables are registered
    import src.backend.models  # noqa: F401
    SQLModel.metadata.create_all(engine)

def get_session():
    """FastAPI dependency that yields a Session for the duration of the request."""
    with Session(engine) as session:
        yield session

@contextmanager
def session_scope():
    """Context manager for scripts/tests to get a Session."""
    with Session(engine) as session:
        yield session
