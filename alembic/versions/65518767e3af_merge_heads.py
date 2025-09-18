"""merge heads

Revision ID: 65518767e3af
Revises: 20250913_profile_house_system, a20250914_email_verif
Create Date: 2025-09-14 20:28:42.124517

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '65518767e3af'
down_revision: Union[str, Sequence[str], None] = ('20250913_profile_house_system', 'a20250914_email_verif')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
