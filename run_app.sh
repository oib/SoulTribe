#!/bin/bash

# Log the start of the script
echo "[$(date)] Starting SoulTribe application" >> /home/oib/windsurf/soultribe.chat/soultribe.log

# Kill any process using port 8001
echo "[$(date)] Checking for processes on port 8001..." >> /home/oib/windsurf/soultribe.chat/soultribe.log
fuser -k 8001/tcp 2>&1 | tee -a /home/oib/windsurf/soultribe.chat/soultribe.log || true

# Change to project directory
cd /home/oib/windsurf/soultribe.chat

# Load service-wide environment variables if .env exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Ensure Redis DB separation for match cache
export REDIS_DB="1"

# Activate virtual environment
source .venv/bin/activate

# Log environment
echo "[$(date)] Environment:" >> /home/oib/windsurf/soultribe.chat/soultribe.log
env | sort >> /home/oib/windsurf/soultribe.chat/soultribe.log

# Run the application with output to log file
echo "[$(date)] Starting Gunicorn..." >> /home/oib/windsurf/soultribe.chat/soultribe.log
exec gunicorn -k uvicorn.workers.UvicornWorker --bind 127.0.0.1:8001 \
  --log-level debug \
  --log-file /home/oib/windsurf/soultribe.chat/gunicorn.log \
  main:app >> /home/oib/windsurf/soultribe.chat/soultribe.log 2>&1
