#!/bin/bash
# start_backend.sh — Run FastAPI backend in the venv
# Usage: ./start_backend.sh [port]
PORT=${1:-8001}
cd "$(dirname "$0")"
source venv/bin/activate
echo "✅ Starting St. Paul's ERP backend on http://0.0.0.0:$PORT"
echo "📖 API docs: http://localhost:$PORT/docs"
echo "📱 Android emulator: http://10.0.2.2:$PORT"
# --host 0.0.0.0 makes the server reachable from Android emulator (via 10.0.2.2)
uvicorn server:app --reload --host 0.0.0.0 --port "$PORT"
