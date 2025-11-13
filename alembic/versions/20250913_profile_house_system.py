"""
add house_system to profile

Revision ID: 20250913_profile_house_system
Revises: a250913_tz_availslot
Create Date: 2025-09-13
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250913_profile_house_system'
down_revision = '20250101_create_initial_tables'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add nullable house_system column to profile
    op.add_column('profile', sa.Column('house_system', sa.String(), nullable=True))


def downgrade() -> None:
    # Drop house_system column
    with op.batch_alter_table('profile') as batch_op:
        batch_op.drop_column('house_system')
