from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a250913_tz_availslot'
down_revision = 'a20250913_availability_once'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Convert AvailabilitySlot start/end to timestamptz assuming stored as UTC
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='availabilityslot' AND column_name='start_dt_utc' AND data_type = 'timestamp without time zone'
                ) THEN
                    ALTER TABLE availabilityslot 
                        ALTER COLUMN start_dt_utc TYPE timestamptz USING (start_dt_utc AT TIME ZONE 'UTC');
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='availabilityslot' AND column_name='end_dt_utc' AND data_type = 'timestamp without time zone'
                ) THEN
                    ALTER TABLE availabilityslot 
                        ALTER COLUMN end_dt_utc TYPE timestamptz USING (end_dt_utc AT TIME ZONE 'UTC');
                END IF;
            END
            $$;
            """
        )
    )

    # Also handle alternate table name availability_slot if present
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='availability_slot' AND column_name='start_dt_utc' AND data_type = 'timestamp without time zone'
                ) THEN
                    ALTER TABLE availability_slot 
                        ALTER COLUMN start_dt_utc TYPE timestamptz USING (start_dt_utc AT TIME ZONE 'UTC');
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='availability_slot' AND column_name='end_dt_utc' AND data_type = 'timestamp without time zone'
                ) THEN
                    ALTER TABLE availability_slot 
                        ALTER COLUMN end_dt_utc TYPE timestamptz USING (end_dt_utc AT TIME ZONE 'UTC');
                END IF;
            END
            $$;
            """
        )
    )


def downgrade() -> None:
    # Convert back to timestamp without time zone (drops tz info), keeping UTC clock time
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='availabilityslot' AND column_name='start_dt_utc' AND data_type = 'timestamp with time zone'
                ) THEN
                    ALTER TABLE availabilityslot 
                        ALTER COLUMN start_dt_utc TYPE timestamp WITHOUT time ZONE USING (start_dt_utc AT TIME ZONE 'UTC');
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='availabilityslot' AND column_name='end_dt_utc' AND data_type = 'timestamp with time zone'
                ) THEN
                    ALTER TABLE availabilityslot 
                        ALTER COLUMN end_dt_utc TYPE timestamp WITHOUT time ZONE USING (end_dt_utc AT TIME ZONE 'UTC');
                END IF;
            END
            $$;
            """
        )
    )

    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='availability_slot' AND column_name='start_dt_utc' AND data_type = 'timestamp with time zone'
                ) THEN
                    ALTER TABLE availability_slot 
                        ALTER COLUMN start_dt_utc TYPE timestamp WITHOUT time ZONE USING (start_dt_utc AT TIME ZONE 'UTC');
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='availability_slot' AND column_name='end_dt_utc' AND data_type = 'timestamp with time zone'
                ) THEN
                    ALTER TABLE availability_slot 
                        ALTER COLUMN end_dt_utc TYPE timestamp WITHOUT time ZONE USING (end_dt_utc AT TIME ZONE 'UTC');
                END IF;
            END
            $$;
            """
        )
    )
