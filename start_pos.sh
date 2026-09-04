#!/usr/bin/env bash
# VoltFlow POS — Production Starter Script (Linux)
# Prioritizes standalone PyInstaller binary, falls back to Python venv.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo "  Starting VoltFlow POS..."
echo "========================================================"
echo ""

# 1. Ensure frontend UI is built
if [ ! -f "$SCRIPT_DIR/dist/index.html" ]; then
    echo "[INFO] Frontend build missing. Building UI bundle..."
    if command -v npm >/dev/null 2>&1; then
        npm run build
    else
        echo "[ERROR] npm is required to build the frontend."
        exit 1
    fi
fi

# 2. Check if port 8000 is already active
if curl -s http://127.0.0.1:8000/api/v1/status >/dev/null 2>&1; then
    echo "[INFO] Backend already running on port 8000."
else
    STANDALONE_BIN="$SCRIPT_DIR/backend/dist_standalone/pos-backend/pos-backend"
    VENV_PYTHON="$SCRIPT_DIR/backend/venv/bin/python"

    if [ -x "$STANDALONE_BIN" ]; then
        echo "[INFO] Starting standalone backend binary..."
        "$STANDALONE_BIN" >/dev/null 2>&1 &
        BACKEND_PID=$!
    elif [ -x "$VENV_PYTHON" ]; then
        echo "[INFO] Starting backend via virtual environment..."
        cd "$SCRIPT_DIR/backend"
        "$VENV_PYTHON" migrations.py >/dev/null 2>&1 || true
        "$VENV_PYTHON" main.py >/dev/null 2>&1 &
        BACKEND_PID=$!
        cd "$SCRIPT_DIR"
    elif command -v python3 >/dev/null 2>&1; then
        echo "[INFO] Starting backend via system python3..."
        cd "$SCRIPT_DIR/backend"
        python3 migrations.py >/dev/null 2>&1 || true
        python3 main.py >/dev/null 2>&1 &
        BACKEND_PID=$!
        cd "$SCRIPT_DIR"
    else
        echo "[ERROR] Neither standalone binary nor python3 found."
        exit 1
    fi

    # Wait for backend on port 8000 (up to 15s)
    echo -n "[INFO] Waiting for backend"
    READY=0
    for _ in $(seq 1 30); do
        if curl -s http://127.0.0.1:8000/api/v1/status >/dev/null 2>&1; then
            READY=1
            break
        fi
        echo -n "."
        sleep 0.5
    done
    echo ""

    if [ "$READY" -ne 1 ]; then
        echo "[ERROR] Backend failed to start within 15 seconds."
        exit 1
    fi
    echo "[OK] Backend online at http://localhost:8000"
fi

# 3. Network and Customer Display Information
LOCAL_IP="localhost"
if command -v hostname >/dev/null 2>&1; then
    PRIMARY_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -n "$PRIMARY_IP" ] && LOCAL_IP="$PRIMARY_IP"
fi

echo ""
echo "--------------------------------------------------------"
echo " Register URL:        http://localhost:8000"
echo " Customer Screen:     http://${LOCAL_IP}:8000/#/customer-display"
echo " API Docs:            http://localhost:8000/docs"
echo "--------------------------------------------------------"
echo ""

# Render ASCII QR code in terminal if available
if command -v qrencode >/dev/null 2>&1; then
    echo "Scan with phone for customer display screen:"
    qrencode -t ANSI256 "http://${LOCAL_IP}:8000/#/customer-display" || true
    echo ""
fi

# 4. Launch browser UI
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    URL="http://localhost:8000"
    if command -v google-chrome >/dev/null 2>&1; then
        google-chrome --app="$URL" >/dev/null 2>&1 &
    elif command -v chromium >/dev/null 2>&1; then
        chromium --app="$URL" >/dev/null 2>&1 &
    elif command -v chromium-browser >/dev/null 2>&1; then
        chromium-browser --app="$URL" >/dev/null 2>&1 &
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$URL" >/dev/null 2>&1 &
    fi
fi

echo "[SUCCESS] VoltFlow POS running. To stop: ./scripts/tools/himmel_pos_stop.sh"
