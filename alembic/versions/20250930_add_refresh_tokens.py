"""add refresh token table

Revision ID: 20250930_add_refresh_tokens
Revises: 8a7979edb259_add_nullable_local_time_and_timezone_to_
Create Date: 2025-09-30 17:30:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250930_add_refresh_tokens"
down_revision = "8a7979edb259_add_nullable_local_time_and_timezone_to_"
branch_labels = None
depends_on = None


TABLE_NAME = "refreshtoken"


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    if dialect_name == "postgresql":
        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_name = 'refreshtoken'
                    ) THEN
                        CREATE TABLE refreshtoken (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                            token_hash VARCHAR(128) NOT NULL,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            expires_at TIMESTAMPTZ NOT NULL,
                            revoked_at TIMESTAMPTZ NULL,
                            client_ip VARCHAR(64) NULL,
                            user_agent VARCHAR(512) NULL
                        );
                        CREATE INDEX IF NOT EXISTS ix_refreshtoken_user_id ON refreshtoken (user_id);
                        CREATE INDEX IF NOT EXISTS ix_refreshtoken_token_hash ON refreshtoken (token_hash);
                    END IF;
                END $$;
                """
            )
        )
    else:
        try:
            op.create_table(
                TABLE_NAME,
                sa.Column("id", sa.Integer(), primary_key=True),
                sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True),
                sa.Column("token_hash", sa.String(length=128), nullable=False, index=True),
                sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
                sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
                sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
                sa.Column("client_ip", sa.String(length=64), nullable=True),
                sa.Column("user_agent", sa.String(length=512), nullable=True),
            )
        except Exception:
            pass
        try:
            op.create_index("ix_refreshtoken_user_id", TABLE_NAME, ["user_id"])
        except Exception:
            pass
        try:
            op.create_index("ix_refreshtoken_token_hash", TABLE_NAME, ["token_hash"])
        except Exception:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    if dialect_name == "postgresql":
        op.execute(
            sa.text(
                """
                DROP TABLE IF EXISTS refreshtoken;
                """
            )
        )
    else:
        try:
            op.drop_index("ix_refreshtoken_token_hash", table_name=TABLE_NAME)
        except Exception:
            pass
        try:
            op.drop_index("ix_refreshtoken_user_id", table_name=TABLE_NAME)
        except Exception:
            pass
        try:
            op.drop_table(TABLE_NAME)
        except Exception:
            pass
