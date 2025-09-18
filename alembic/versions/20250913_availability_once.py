from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a20250913_availability_once'
down_revision = '8a7979edb259'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create availability_once table if not exists
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'availability_once'
                ) THEN
                    CREATE TABLE availability_once (
                        id BIGSERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                        window_utc tstzrange NOT NULL
                    );
                END IF;
            END
            $$;
            """
        )
    )

    # Create GiST index on window_utc
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS availability_once_gist ON availability_once USING gist(window_utc)"))

    # Backfill from existing AvailabilitySlot table if present
    op.execute(
        sa.text(
            """
            DO $$
            DECLARE
                src_table text := NULL;
            BEGIN
                -- Detect source table name for AvailabilitySlot (sqlmodel naming can vary)
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name = 'availabilityslot'
                ) THEN
                    src_table := 'availabilityslot';
                ELSIF EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_name = 'availability_slot'
                ) THEN
                    src_table := 'availability_slot';
                END IF;

                IF src_table IS NOT NULL THEN
                    EXECUTE format(
                        'INSERT INTO availability_once (user_id, window_utc)\n                         SELECT user_id, tstzrange(start_dt_utc, end_dt_utc, ''[)'')\n                         FROM %I src\n                         WHERE NOT EXISTS (\n                           SELECT 1 FROM availability_once ao\n                           WHERE ao.user_id = src.user_id\n                             AND ao.window_utc = tstzrange(src.start_dt_utc, src.end_dt_utc, ''[)'')\n                         )\n                         AND src.end_dt_utc > now()\n                        ',
                        src_table
                    );
                END IF;
            END
            $$;
            """
        )
    )


def downgrade() -> None:
    # Drop index and table (non-destructive to original slots)
    op.execute(sa.text("DROP INDEX IF EXISTS availability_once_gist"))
    op.execute(
        sa.text(
            """
            DROP TABLE IF EXISTS availability_once;
            """
        )
    )
