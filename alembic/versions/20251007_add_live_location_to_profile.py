"""add live location fields to profile

Revision ID: 20251007_add_live_location_to_profile
Revises: 20251006_match_comment_localization
Create Date: 2025-10-07 03:02:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251007_add_live_location_to_profile"
down_revision: Union[str, Sequence[str], None] = "5ad967e64be5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PROFILE_TABLE = "profile"


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    # Add columns only if they do not exist (Postgres safe guard)
    if dialect_name == "postgresql":
        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'profile'
                          AND column_name = 'live_place_name'
                    ) THEN
                        ALTER TABLE profile ADD COLUMN live_place_name TEXT NULL;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'profile'
                          AND column_name = 'live_lat'
                    ) THEN
                        ALTER TABLE profile ADD COLUMN live_lat DOUBLE PRECISION NULL;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'profile'
                          AND column_name = 'live_lon'
                    ) THEN
                        ALTER TABLE profile ADD COLUMN live_lon DOUBLE PRECISION NULL;
                    END IF;
                END $$;
                """
            )
        )
    else:
        # Generic fallback for SQLite / other dialects
        try:
            op.add_column(PROFILE_TABLE, sa.Column("live_place_name", sa.Text(), nullable=True))
        except Exception:
            pass
        try:
            op.add_column(PROFILE_TABLE, sa.Column("live_lat", sa.Float(), nullable=True))
        except Exception:
            pass
        try:
            op.add_column(PROFILE_TABLE, sa.Column("live_lon", sa.Float(), nullable=True))
        except Exception:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    if dialect_name == "postgresql":
        op.execute(
            sa.text(
                """
                ALTER TABLE profile DROP COLUMN IF EXISTS live_place_name;
                ALTER TABLE profile DROP COLUMN IF EXISTS live_lat;
                ALTER TABLE profile DROP COLUMN IF EXISTS live_lon;
                """
            )
        )
    else:
        try:
            op.drop_column(PROFILE_TABLE, "live_lon")
        except Exception:
            pass
        try:
            op.drop_column(PROFILE_TABLE, "live_lat")
        except Exception:
            pass
        try:
            op.drop_column(PROFILE_TABLE, "live_place_name")
        except Exception:
            pass
