#!/bin/bash

# Exit on error
set -e

# Determine project root (two levels up from this script)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Source the virtual environment
source "$PROJECT_ROOT/.venv/bin/activate"

# Set environment variables
export PYTHONPATH="$PYTHONPATH:$PROJECT_ROOT"

# Change to the project directory
cd "$PROJECT_ROOT"

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
    --config "$PROJECT_ROOT/dev/config/gunicorn_config.py" \
    --log-level=info \
    --access-logfile - \
    --error-logfile - \
    --worker-tmp-dir /dev/shm \
    --reuse-port \
    --chdir "$PROJECT_ROOT" \
    src.backend.main:app
