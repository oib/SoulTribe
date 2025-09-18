from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a20250910_meetup_cols'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add columns if they do not exist (Postgres-safe)
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='meetup' AND column_name='proposer_user_id'
                ) THEN
                    ALTER TABLE meetup ADD COLUMN proposer_user_id INTEGER NULL;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='meetup' AND column_name='confirmer_user_id'
                ) THEN
                    ALTER TABLE meetup ADD COLUMN confirmer_user_id INTEGER NULL;
                END IF;
            END
            $$;
            """
        )
    )
    # Optional indexes
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_meetup_proposer_user_id ON meetup (proposer_user_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_meetup_confirmer_user_id ON meetup (confirmer_user_id)"))


def downgrade() -> None:
    # Drop indexes if exist
    op.execute(sa.text("DROP INDEX IF EXISTS idx_meetup_proposer_user_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS idx_meetup_confirmer_user_id"))
    # Drop columns if they exist
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='meetup' AND column_name='proposer_user_id'
                ) THEN
                    ALTER TABLE meetup DROP COLUMN proposer_user_id;
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='meetup' AND column_name='confirmer_user_id'
                ) THEN
                    ALTER TABLE meetup DROP COLUMN confirmer_user_id;
                END IF;
            END
            $$;
            """
        )
    )
