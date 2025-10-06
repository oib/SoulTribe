"""merge branches

Revision ID: 5ad967e64be5
Revises: 20251006_match_comment_localization, 808d111b2c48
Create Date: 2025-10-06 14:32:06.191620

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5ad967e64be5'
down_revision: Union[str, Sequence[str], None] = ('20251006_match_comment_localization', '808d111b2c48')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
