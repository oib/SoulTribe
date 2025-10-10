"""add profile notification preferences

Revision ID: 20251009_add_profile_notification_prefs
Revises: 20250913_profile_house_system
Create Date: 2025-10-09 07:25:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20251009_add_profile_notification_prefs"
down_revision = "20251007_add_live_location_to_profile"
branch_labels = None
depends_on = None

def upgrade() -> None:
    with op.batch_alter_table("profile", schema=None) as batch:
        batch.add_column(sa.Column("notify_email_meetups", sa.Boolean(), nullable=True))
        batch.add_column(sa.Column("notify_browser_meetups", sa.Boolean(), nullable=True))
    op.execute(
        """
        UPDATE profile
        SET notify_email_meetups = TRUE
        WHERE notify_email_meetups IS NULL;
        """
    )
    op.execute(
        """
        UPDATE profile
        SET notify_browser_meetups = TRUE
        WHERE notify_browser_meetups IS NULL;
        """
    )
    with op.batch_alter_table("profile", schema=None) as batch:
        batch.alter_column("notify_email_meetups", nullable=False, server_default=sa.text("true"))
        batch.alter_column("notify_browser_meetups", nullable=False, server_default=sa.text("true"))


def downgrade() -> None:
    with op.batch_alter_table("profile", schema=None) as batch:
        batch.drop_column("notify_browser_meetups")
        batch.drop_column("notify_email_meetups")
