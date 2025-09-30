#!/bin/bash

# Exit on error
set -e

# Source the virtual environment
source /home/oib/windsurf/soultribe.chat/.venv/bin/activate

# Set environment variables
export PYTHONPATH=$PYTHONPATH:/home/oib/windsurf/soultribe.chat

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the project directory
cd "$SCRIPT_DIR"

# Function to handle cleanup
cleanup() {
    echo "Shutting down Gunicorn..."
    pkill -f "gunicorn.*soultribe" || true
}

# Set up trap to catch signals
trap cleanup EXIT

# Start Gunicorn
echo "Starting Gunicorn..."
exec gunicorn \
    --config gunicorn_config.py \
    --log-level=info \
    --access-logfile - \
    --error-logfile - \
    --worker-tmp-dir /dev/shm \
    --reuse-port \
    --chdir /home/oib/windsurf/soultribe.chat \
    app:app
