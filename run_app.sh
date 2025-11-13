#!/bin/bash

# Log the start of the script
LOG_DIR=/var/www/soultribe/dev/logs
mkdir -p "$LOG_DIR"
APP_LOG="$LOG_DIR/soultribe.log"
GUNICORN_LOG="$LOG_DIR/gunicorn.log"

echo "[$(date)] Starting SoulTribe application" >> "$APP_LOG"

# Kill any process using port 8001
echo "[$(date)] Checking for processes on port 8001..." >> "$APP_LOG"
fuser -k 8001/tcp 2>&1 | tee -a "$APP_LOG" || true

# Change to project directory
cd /var/www/soultribe

# Load service-wide environment variables if .env exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Ensure Redis DB separation for match cache
export REDIS_DB="1"

# Activate virtual environment
source .venv/bin/activate

# Log environment
echo "[$(date)] Environment:" >> "$APP_LOG"
env | sort >> "$APP_LOG"

# Run the application with output to log file
echo "[$(date)] Starting Gunicorn..." >> "$APP_LOG"
exec gunicorn -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001 \
  --log-level debug \
  --log-file "$GUNICORN_LOG" \
  src.backend.main:app >> "$APP_LOG" 2>&1
