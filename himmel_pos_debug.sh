#!/usr/bin/env bash
# Himmel POS — Debug Mode (Linux)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "========================================================"
echo "  Starting Himmel POS (DEBUG MODE - All Output Visible)"
echo "========================================================"
echo ""

# 1. Stop existing instances to avoid port conflicts
echo "Stopping existing processes..."
pkill -f "main.py" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "litestream" 2>/dev/null

cleanup() {
    echo ""
    echo "[INFO] Shutting down Himmel POS debug processes..."
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    [ -n "$LITESTREAM_PID" ] && kill "$LITESTREAM_PID" 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 2. Check Python & venv setup
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    python3 -m venv "$SCRIPT_DIR/backend/venv"
    "$SCRIPT_DIR/backend/venv/bin/pip" install -r "$SCRIPT_DIR/backend/requirements.txt"
fi

if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    npm install
fi

# 3. Launch Python Backend
echo "[1/3] Launching Python FastAPI Backend terminal..."
cd "$SCRIPT_DIR/backend" || exit 1
source venv/bin/activate
python3 main.py &
BACKEND_PID=$!

# 4. Launch Vite Web Dev server
echo "[2/3] Launching Vite Web Server terminal..."
cd "$SCRIPT_DIR" || exit 1
npm run dev &
FRONTEND_PID=$!

# 5. Launch Litestream terminal if present
if [ -x "$SCRIPT_DIR/backend/litestream" ] || command -v litestream &>/dev/null; then
    echo "[3/3] Launching Litestream Replication..."
    LITESTREAM_BIN="$SCRIPT_DIR/backend/litestream"
    command -v litestream &>/dev/null && LITESTREAM_BIN="litestream"
    "$LITESTREAM_BIN" replicate -config "$SCRIPT_DIR/backend/litestream.yml" &
    LITESTREAM_PID=$!
fi

# 6. Wait for servers to spin up
echo ""
echo "Waiting for servers to initialize..."
sleep 3

# 7. Launch Browser
echo "Opening browser at http://localhost:5173 ..."
if command -v google-chrome &>/dev/null; then
    google-chrome --app=http://localhost:5173 --start-maximized &>/dev/null &
elif command -v chromium-browser &>/dev/null; then
    chromium-browser --app=http://localhost:5173 --start-maximized &>/dev/null &
elif command -v chromium &>/dev/null; then
    chromium --app=http://localhost:5173 --start-maximized &>/dev/null &
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:5173 &>/dev/null &
fi

echo ""
echo "========================================================"
echo "  Debug mode active!"
echo "  - Backend live on http://localhost:8000"
echo "  - Frontend dev server on http://localhost:5173"
echo "  - Terminal logs visible"
echo "========================================================"
echo ""

wait $BACKEND_PID $FRONTEND_PID
