#!/usr/bin/env bash
# VoltFlow POS — Simple Debug Mode
# Runs FastAPI backend (:8000) and Vite frontend (:5173) with hot reload.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo "  Starting VoltFlow POS (Debug Mode)"
echo "========================================================"
echo ""

# 1. Stop conflicting processes on 8000 and 5173
echo "[INFO] Clearing any existing instances on ports 8000 / 5173..."
pkill -f "main.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

cleanup() {
    echo ""
    echo "[INFO] Stopping debug servers..."
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 2. Check Python venv
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    echo "[INFO] Creating Python virtual environment..."
    python3 -m venv "$SCRIPT_DIR/backend/venv"
    "$SCRIPT_DIR/backend/venv/bin/pip" install --upgrade pip >/dev/null 2>&1
    "$SCRIPT_DIR/backend/venv/bin/pip" install -r "$SCRIPT_DIR/backend/requirements.txt"
fi

# 3. Check Node modules
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "[INFO] Installing Node.js dependencies..."
    npm install
fi

# 4. Launch FastAPI Backend
echo "[1/2] Launching Backend on http://localhost:8000..."
cd "$SCRIPT_DIR/backend"
PYTHON_BIN="$SCRIPT_DIR/backend/venv/bin/python"
[ ! -x "$PYTHON_BIN" ] && PYTHON_BIN="python3"

"$PYTHON_BIN" migrations.py >/dev/null 2>&1 || true
ENV=development "$PYTHON_BIN" main.py &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# 5. Launch Vite Dev Server
echo "[2/2] Launching Frontend on http://localhost:5173..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================================"
echo "  Debug Servers Online:"
echo "  - Frontend (Vite):    http://localhost:5173"
echo "  - Backend API:        http://localhost:8000"
echo "  - Swagger Docs:       http://localhost:8000/docs"
echo "  Press Ctrl+C to stop all servers."
echo "========================================================"
echo ""

# Optional browser open
sleep 2
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5173" >/dev/null 2>&1 &
elif command -v google-chrome >/dev/null 2>&1; then
    google-chrome "http://localhost:5173" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
    chromium "http://localhost:5173" >/dev/null 2>&1 &
fi

wait $FRONTEND_PID $BACKEND_PID
