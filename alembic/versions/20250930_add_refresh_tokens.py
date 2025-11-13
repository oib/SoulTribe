"""add refresh token table

Revision ID: 20250930_add_refresh_tokens
Revises: 8a7979edb259
Create Date: 2025-09-30 17:30:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250930_add_refresh_tokens"
down_revision = "20250101_create_initial_tables"
branch_labels = None
depends_on = None


TABLE_NAME = "refreshtoken"


def upgrade() -> None:
    # Table already created in initial migration
    pass


def downgrade() -> None:
    # Table will be dropped by initial migration downgrade
    pass
