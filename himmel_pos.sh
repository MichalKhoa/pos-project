#!/usr/bin/env bash
# Himmel POS — Linux Kiosk Launcher Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "========================================================"
echo "  Starting Himmel POS on Linux..."
echo "========================================================"
echo ""

# 1. Check Python & virtual environment
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    echo "[INFO] Creating Python virtual environment..."
    python3 -m venv "$SCRIPT_DIR/backend/venv" || { echo "[ERROR] Failed to create venv. Run: sudo apt install python3-venv"; exit 1; }
    echo "[INFO] Installing Python backend dependencies..."
    "$SCRIPT_DIR/backend/venv/bin/pip" install --upgrade pip >/dev/null 2>&1
    "$SCRIPT_DIR/backend/venv/bin/pip" install -r "$SCRIPT_DIR/backend/requirements.txt"
fi

# 2. Check Node modules
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "[INFO] Installing Node.js frontend dependencies..."
    npm install
fi

# Cleanup handler on exit
cleanup() {
    echo ""
    echo "[INFO] Shutting down Himmel POS processes..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 3. Launch Python FastAPI Backend
echo "[1/3] Starting Python Backend Service..."
cd "$SCRIPT_DIR/backend" || exit 1
source venv/bin/activate
HOST="${HOST:-0.0.0.0}" PORT="${PORT:-8000}" python3 main.py &
BACKEND_PID=$!

# 4. Launch Vite Frontend Server
echo "[2/3] Starting Cashier Web Interface..."
cd "$SCRIPT_DIR" || exit 1
npm run dev &
FRONTEND_PID=$!

# 5. Wait for servers to initialize
echo "[3/3] Waiting for servers to initialize..."
sleep 3

# Detect local IP for convenience display
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo "========================================================"
echo "  ✅ Himmel POS is running!"
echo "  - Local POS URL: http://localhost:5173"
if [ -n "$LOCAL_IP" ]; then
    echo "  - Mobile / Remote LAN URL: http://$LOCAL_IP:5173"
fi
echo "  Press Ctrl+C in this terminal to stop all services."
echo "========================================================"
echo ""

# 6. Launch browser (Chrome/Chromium app mode or default xdg-open)
if command -v google-chrome &>/dev/null; then
    google-chrome --app=http://localhost:5173 --start-maximized &>/dev/null &
elif command -v chromium-browser &>/dev/null; then
    chromium-browser --app=http://localhost:5173 --start-maximized &>/dev/null &
elif command -v chromium &>/dev/null; then
    chromium --app=http://localhost:5173 --start-maximized &>/dev/null &
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:5173 &>/dev/null &
fi

wait $BACKEND_PID $FRONTEND_PID
