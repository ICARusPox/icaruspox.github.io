#!/usr/bin/env bash

# Default port (can be overridden by passing port as argument, e.g. ./stop_server.sh 8081)
PORT="${1:-8080}"
PID_FILE=".server.pid"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

STOPPED=0

# Stop process from PID file if running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Stopping web server process (PID $PID)..."
        kill "$PID" 2>/dev/null
        for i in {1..5}; do
            if ! kill -0 "$PID" 2>/dev/null; then
                break
            fi
            sleep 0.5
        done
        if kill -0 "$PID" 2>/dev/null; then
            echo "Force killing process $PID..."
            kill -9 "$PID" 2>/dev/null
        fi
        STOPPED=1
    fi
    rm -f "$PID_FILE"
fi

# Fallback: check any remaining process on the target port
PIDS=$(lsof -ti :"$PORT" 2>/dev/null)
if [ -n "$PIDS" ]; then
    echo "Stopping active process(es) on port $PORT (PID: $PIDS)..."
    kill $PIDS 2>/dev/null
    sleep 1
    PIDS_REMAINING=$(lsof -ti :"$PORT" 2>/dev/null)
    if [ -n "$PIDS_REMAINING" ]; then
        kill -9 $PIDS_REMAINING 2>/dev/null
    fi
    STOPPED=1
fi

if [ $STOPPED -eq 1 ]; then
    echo "Web server on port $PORT stopped successfully."
else
    echo "No running web server found on port $PORT."
fi
