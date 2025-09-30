"""merge heads (last_login_at)

Revision ID: 808d111b2c48
Revises: 65518767e3af, 20250920_user_last_login_at
Create Date: 2025-09-20 22:50:06.596994

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '808d111b2c48'
down_revision: Union[str, Sequence[str], None] = ('65518767e3af', '20250920_user_last_login_at')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
