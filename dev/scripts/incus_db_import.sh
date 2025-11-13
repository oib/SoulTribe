#!/bin/bash

# SoulTribe.chat - Database Backup and Import to Incus Container
# This script creates a backup of the current database and imports it into the Incus container

set -e

BACKUP_FILE="soultribe_db_backup.sql"
CONTAINER_NAME="soultribe-dev"
CONTAINER_DB_PATH="/tmp/soultribe_db_backup.sql"

echo "=== SoulTribe Database Migration to Incus ==="

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Creating database backup..."
    PGPASSWORD=a6b65c20e2ff4994 pg_dump -h 127.0.0.1 -U soultribe -d soultribe > "$BACKUP_FILE"
    echo "✓ Backup created: $BACKUP_FILE"
else
    echo "✓ Using existing backup: $BACKUP_FILE"
fi

# Show backup size
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "Backup size: $BACKUP_SIZE"

# Check if container is running
if ! incus list | grep -q "$CONTAINER_NAME.*RUNNING"; then
    echo "Error: Container '$CONTAINER_NAME' is not running"
    echo "Start it with: incus start $CONTAINER_NAME"
    exit 1
fi

echo "Transferring backup to container..."
incus file push "$BACKUP_FILE" "$CONTAINER_NAME$CONTAINER_DB_PATH"
echo "✓ Backup transferred to container"

echo "Importing database in container..."
incus exec "$CONTAINER_NAME" -- bash -c "
    # Stop any running services that might use the database
    sudo systemctl stop soultribe-gunicorn 2>/dev/null || true
    
    # Drop and recreate database
    sudo -u postgres psql -c 'DROP DATABASE IF EXISTS soultribe;'
    sudo -u postgres psql -c 'CREATE DATABASE soultribe;'
    sudo -u postgres psql -c 'GRANT ALL PRIVILEGES ON DATABASE soultribe TO soultribe;'
    
    # Import the backup
    PGPASSWORD=a6b65c20e2ff4994 psql -h 127.0.0.1 -U soultribe -d soultribe < '$CONTAINER_DB_PATH'
    
    echo '✓ Database imported successfully'
"

echo "Cleaning up temporary files..."
incus exec "$CONTAINER_NAME" -- rm "$CONTAINER_DB_PATH"

echo "=== Migration Complete ==="
echo "Database has been imported to Incus container '$CONTAINER_NAME'"
echo ""
echo "Next steps:"
echo "1. Enter container: incus exec $CONTAINER_NAME -- sudo -u soultribe -i bash"
echo "2. Run migrations: cd /var/www/soultribe && source .venv/bin/activate && alembic upgrade head"
echo "3. Start services: sudo systemctl start soultribe-gunicorn"
