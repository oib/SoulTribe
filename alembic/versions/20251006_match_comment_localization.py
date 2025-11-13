"""add comments_by_lang column for match comments localization

Revision ID: 20251006_match_comment_localization
Revises: 20250930_add_refresh_tokens
Create Date: 2025-10-06 09:05:00
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251006_match_comment_localization"
down_revision: Union[str, Sequence[str], None] = "20250101_create_initial_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MATCH_TABLE = "match"


def upgrade() -> None:
    op.add_column(MATCH_TABLE, sa.Column("comments_by_lang", sa.JSON(), nullable=True))

    bind = op.get_bind()
    metadata = sa.MetaData()
    match_table = sa.Table(
        MATCH_TABLE,
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("comment", sa.Text),
        sa.Column("comments_by_lang", sa.JSON),
    )

    stmt = sa.select(match_table.c.id, match_table.c.comment)
    rows = list(bind.execute(stmt))
    for row in rows:
        comment = (row.comment or "").strip()
        if not comment:
            continue
        normalized = {"und": comment}
        bind.execute(
            match_table.update()
            .where(match_table.c.id == row.id)
            .values(comments_by_lang=normalized)
        )


def downgrade() -> None:
    op.drop_column(MATCH_TABLE, "comments_by_lang")
