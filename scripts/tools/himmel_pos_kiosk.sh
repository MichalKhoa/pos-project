#!/usr/bin/env bash
# Himmel POS — Dedicated Touch Kiosk Mode (Linux)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "========================================================"
echo "  Starting Himmel POS in Dedicated Touch Kiosk Mode..."
echo "========================================================"

# 1. Ensure backend/.env exists with LAN configuration (0.0.0.0)
ENV_FILE="$SCRIPT_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    cat <<EOF > "$ENV_FILE"
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=*
EOF
fi

# 2. Check if production build exists; if not, build it
if [ ! -f "$SCRIPT_DIR/dist/index.html" ]; then
    echo "Building production UI bundle..."
    npm run build >/dev/null 2>&1
fi

# 3. Stop previous backend instance if running
pkill -f "main.py" 2>/dev/null

cleanup() {
    echo ""
    echo "[INFO] Shutting down Himmel POS Kiosk..."
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 4. Launch Python FastAPI Backend in background (with venv & production mode)
cd "$SCRIPT_DIR/backend" || exit 1
if [ -d "venv" ]; then
    source venv/bin/activate
fi
echo "[INFO] Checking database migrations & schema changes..."
python3 migrations.py
ENV=production python3 main.py &
BACKEND_PID=$!

# 5. Wait 3 seconds for backend to initialize
sleep 3

# 6. Open Browser in Full-Screen Kiosk Mode
echo "Launching fullscreen kiosk mode..."
if command -v google-chrome &>/dev/null; then
    google-chrome --kiosk http://localhost:8000 --noerrdialogs --disable-infobars &>/dev/null &
elif command -v chromium-browser &>/dev/null; then
    chromium-browser --kiosk http://localhost:8000 --noerrdialogs --disable-infobars &>/dev/null &
elif command -v chromium &>/dev/null; then
    chromium --kiosk http://localhost:8000 --noerrdialogs --disable-infobars &>/dev/null &
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:8000 &>/dev/null &
fi

wait $BACKEND_PID
