"""add email verification tokens and user.email_verified_at

Revision ID: 20250914_email_verification_tokens
Revises: 20250913_timestamptz_availabilityslot
Create Date: 2025-09-14 20:23:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a20250914_email_verif'
down_revision = '20250101_create_initial_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tables and columns already created in initial migration
    pass


def downgrade() -> None:
    # Drop token table
    op.drop_index('ix_emailverificationtoken_token', table_name='emailverificationtoken')
    op.drop_index('ix_emailverificationtoken_user_id', table_name='emailverificationtoken')
    op.drop_table('emailverificationtoken')

    # Drop column if exists (PostgreSQL-safe)
    bind = op.get_bind()
    dialect_name = bind.dialect.name
    if dialect_name == 'postgresql':
        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='user' AND column_name='email_verified_at'
                    ) THEN
                        ALTER TABLE "user" DROP COLUMN email_verified_at;
                    END IF;
                END $$;
                """
            )
        )
    else:
        try:
            op.drop_column('user', 'email_verified_at')
        except Exception:
            pass
