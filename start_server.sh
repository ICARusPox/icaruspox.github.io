#!/usr/bin/env bash

# Default port (can be overridden by passing port as argument, e.g. ./start_server.sh 8081)
PORT="${1:-8080}"
PID_FILE=".server.pid"
LOG_FILE="server.log"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# Check if PID file exists and process is running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Web server is already running (PID $PID) at http://localhost:$PORT"
        exit 0
    else
        rm -f "$PID_FILE"
    fi
fi

# Check if port is already in use
if lsof -i :"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Error: Port $PORT is already in use."
    lsof -i :"$PORT" -sTCP:LISTEN
    exit 1
fi

echo "Starting web server on http://localhost:$PORT..."
nohup python3 -m http.server "$PORT" > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "$SERVER_PID" > "$PID_FILE"

# Pause briefly to ensure the server started cleanly
sleep 1

if kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Web server started successfully!"
    echo "  URL:      http://localhost:$PORT"
    echo "  PID:      $SERVER_PID"
    echo "  Logs:     $SCRIPT_DIR/$LOG_FILE"
    echo "  PID File: $SCRIPT_DIR/$PID_FILE"
else
    echo "Error: Failed to start web server. Check $LOG_FILE for details."
    rm -f "$PID_FILE"
    exit 1
fi
