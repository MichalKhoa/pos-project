#!/usr/bin/env bash
# Himmel POS — Mobile & LAN Launcher (Linux)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "========================================================"
echo "  Himmel POS — Starting for Phone / LAN Access"
echo "========================================================"
echo ""

# 1. Ensure backend/.env exists with LAN configuration
ENV_FILE="$SCRIPT_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    cat <<EOF > "$ENV_FILE"
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=*
EOF
fi

cleanup() {
    echo ""
    echo "[INFO] Shutting down Himmel POS processes..."
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 2. Launch Python FastAPI Backend
echo "[1/2] Starting Python Backend Service..."
cd "$SCRIPT_DIR/backend" || exit 1
if [ -d "venv" ]; then
    source venv/bin/activate
fi
echo "[INFO] Checking database migrations & schema changes..."
python3 migrations.py
python3 main.py &
BACKEND_PID=$!

# 3. Launch Vite Frontend Server on 0.0.0.0
echo "[2/2] Starting Vite Frontend Server..."
cd "$SCRIPT_DIR" || exit 1
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

# 4. Wait for services to bind
sleep 3

# 5. Detect and display local network IP addresses & Customer Display URLs
echo ""
echo "========================================================"
echo "  📱 OPEN THESE URLS ON YOUR PHONE / TABLET:"
echo "========================================================"
IP_LIST=$(hostname -I 2>/dev/null)
for ip in $IP_LIST; do
    case "$ip" in
        127.*|169.254.*) ;;
        *)
            echo "   👉 Phone Customer Screen: http://$ip:8000/#/customer-display"
            echo "   👉 Cashier Register URL:  http://$ip:8000"
            echo "   👉 Customer Screen (Dev): http://$ip:5173/#/customer-display"
            ;;
    esac
done
echo "========================================================"
echo ""
echo "Notes:"
echo " 1. Ensure your phone is connected to the SAME Wi-Fi network."
echo " 2. Open the Phone Customer Screen URL on your secondary phone/tablet."
echo " 3. Keep this terminal open while using Himmel POS."
echo ""

wait $FRONTEND_PID $BACKEND_PID
