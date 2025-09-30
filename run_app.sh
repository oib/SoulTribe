#!/bin/bash

# Log the start of the script
echo "[$(date)] Starting SoulTribe application" >> /home/oib/soultribe.log

# Kill any process using port 8001
echo "[$(date)] Checking for processes on port 8001..." >> /home/oib/soultribe.log
fuser -k 8001/tcp 2>&1 | tee -a /home/oib/soultribe.log || true

# Change to project directory
cd /home/oib/windsurf/soultribe.chat

# Activate virtual environment
source .venv/bin/activate

# Log environment
echo "[$(date)] Environment:" >> /home/oib/soultribe.log
env | sort >> /home/oib/soultribe.log

# Run the application with output to log file
echo "[$(date)] Starting Gunicorn..." >> /home/oib/soultribe.log
exec gunicorn -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001 --log-level debug --log-file /home/oib/gunicorn.log main:app 2>&1 | tee -a /home/oib/soultribe.log
