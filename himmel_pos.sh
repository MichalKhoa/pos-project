#!/usr/bin/env bash
# Himmel POS — Cashier & Customer Display Mode (Linux)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "========================================================"
echo "  Starting Himmel POS (Cashier & Customer Display)..."
echo "========================================================"
echo ""

# 1. Ensure backend/.env exists with LAN configuration (0.0.0.0)
ENV_FILE="$SCRIPT_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    cat <<EOF > "$ENV_FILE"
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=*
EOF
    echo "[OK] Created backend/.env with HOST=0.0.0.0 and ALLOWED_ORIGINS=*"
fi

# 2. Check Python & virtual environment setup
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    echo "[INFO] Creating Python virtual environment..."
    python3 -m venv "$SCRIPT_DIR/backend/venv" || { echo "[ERROR] Failed to create venv."; exit 1; }
    "$SCRIPT_DIR/backend/venv/bin/pip" install --upgrade pip >/dev/null 2>&1
    "$SCRIPT_DIR/backend/venv/bin/pip" install -r "$SCRIPT_DIR/backend/requirements.txt"
fi

if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "[INFO] Installing Node.js frontend dependencies..."
    npm install
fi

# 3. Build UI bundle for fresh startup
echo "[INFO] Building latest touchscreen UI bundle..."
npm run build

# 4. Stop any existing background POS processes to avoid port conflicts
echo "[INFO] Checking for previous instances..."
pkill -f "main.py" 2>/dev/null
pkill -f "litestream" 2>/dev/null

cleanup() {
    echo ""
    echo "[INFO] Shutting down Himmel POS processes..."
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$LITESTREAM_PID" ] && kill "$LITESTREAM_PID" 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 5. Start Python FastAPI backend (LAN & Customer Display Ready) in production mode
echo "[1/3] Starting Backend Service..."
cd "$SCRIPT_DIR/backend" || exit 1
source venv/bin/activate
ENV=production python3 main.py &
BACKEND_PID=$!

# 6. Start Litestream if present
if [ -x "$SCRIPT_DIR/backend/litestream" ] || command -v litestream &>/dev/null; then
    echo "[INFO] Starting Database Replication..."
    LITESTREAM_BIN="$SCRIPT_DIR/backend/litestream"
    command -v litestream &>/dev/null && LITESTREAM_BIN="litestream"
    "$LITESTREAM_BIN" replicate -config "$SCRIPT_DIR/backend/litestream.yml" &
    LITESTREAM_PID=$!
fi

# 7. Wait for backend startup
echo "[2/3] Waiting for backend to initialize..."
sleep 3

# 8. Display Local Network IP & Phone Customer Screen URLs
echo ""
echo "========================================================"
echo "  📱 PHONE CUSTOMER DISPLAY URL (Open on your phone):"
echo "========================================================"
IP_LIST=$(hostname -I 2>/dev/null)
for ip in $IP_LIST; do
    case "$ip" in
        127.*|169.254.*) ;;
        *) echo "   👉 Phone Customer Screen: http://$ip:8000/#/customer-display" ;;
    esac
done
echo "========================================================"
echo ""

# 9. Launch Cashier Display in Browser (Chrome/Chromium app mode or xdg-open)
echo "[3/3] Opening Cashier Application..."
if command -v google-chrome &>/dev/null; then
    google-chrome --app=http://localhost:8000 --start-maximized &>/dev/null &
elif command -v chromium-browser &>/dev/null; then
    chromium-browser --app=http://localhost:8000 --start-maximized &>/dev/null &
elif command -v chromium &>/dev/null; then
    chromium --app=http://localhost:8000 --start-maximized &>/dev/null &
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:8000 &>/dev/null &
fi

echo ""
echo "========================================================"
echo "  ✅ Himmel POS is running!"
echo "  To stop all services, run: ./himmel_pos_stop.sh"
echo "========================================================"
echo ""

wait $BACKEND_PID
