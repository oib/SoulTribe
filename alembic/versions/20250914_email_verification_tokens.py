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
down_revision = 'a250913_tz_availslot'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    # Add email_verified_at to user table if it does not exist (PostgreSQL-safe)
    if dialect_name == 'postgresql':
        op.execute(
            sa.text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='user' AND column_name='email_verified_at'
                    ) THEN
                        ALTER TABLE "user" ADD COLUMN email_verified_at TIMESTAMPTZ NULL;
                    END IF;
                END $$;
                """
            )
        )
    else:
        # Best-effort for other dialects: try add column (may fail if exists)
        try:
            op.add_column('user', sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True))
        except Exception:
            pass

    # Create email_verification_token table
    try:
        op.create_table(
            'emailverificationtoken',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('token', sa.String(length=255), nullable=False, unique=True, index=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        )
    except Exception:
        pass
    # Additional explicit indexes (some dialects ignore index=True in create_table)
    # Wrap in IF NOT EXISTS to avoid conflicts if db already created them
    if dialect_name == 'postgresql':
        op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_emailverificationtoken_user_id ON emailverificationtoken (user_id)"))
        op.execute(sa.text("CREATE UNIQUE INDEX IF NOT EXISTS ix_emailverificationtoken_token ON emailverificationtoken (token)"))
    else:
        try:
            op.create_index('ix_emailverificationtoken_user_id', 'emailverificationtoken', ['user_id'])
        except Exception:
            pass
        try:
            op.create_index('ix_emailverificationtoken_token', 'emailverificationtoken', ['token'], unique=True)
        except Exception:
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
