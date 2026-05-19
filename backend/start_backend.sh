#!/bin/bash
# start_backend.sh — Run FastAPI backend in the venv
# Usage: ./start_backend.sh [port]
PORT=${1:-8001}
cd "$(dirname "$0")"
source venv/bin/activate
echo "✅ Starting St. Paul's ERP backend on http://localhost:$PORT"
echo "📖 API docs: http://localhost:$PORT/docs"
uvicorn server:app --reload --port "$PORT"
