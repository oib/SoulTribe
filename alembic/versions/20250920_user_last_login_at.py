"""
add last_login_at to user

Revision ID: 20250920_user_last_login_at
Revises: 
Create Date: 2025-09-20 20:44:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20250920_user_last_login_at'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add last_login_at (UTC naive) to user
    op.add_column('user', sa.Column('last_login_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('user', 'last_login_at')
