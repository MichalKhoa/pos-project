#!/usr/bin/env bash
# VoltFlow POS — One-Click Project Installation (Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo "  VoltFlow POS — Project Installation"
echo "========================================================"
echo ""

# 1. Check prerequisites
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 not found. Please install Python 3.10+."
    exit 1
fi

if ! command -v npm &>/dev/null; then
    echo "[ERROR] npm not found. Please install Node.js (LTS)."
    exit 1
fi

# 2. Setup Python virtual environment
echo "[1/4] Setting up Python backend virtual environment..."
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    python3 -m venv "$SCRIPT_DIR/backend/venv"
fi
"$SCRIPT_DIR/backend/venv/bin/pip" install --upgrade pip >/dev/null 2>&1
"$SCRIPT_DIR/backend/venv/bin/pip" install -r "$SCRIPT_DIR/backend/requirements.txt"

# 3. Initialize DB schema
echo "[2/4] Applying database migrations..."
"$SCRIPT_DIR/backend/venv/bin/python" "$SCRIPT_DIR/backend/migrations.py"

# 4. Setup backend .env if missing
if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
    cat <<EOF > "$SCRIPT_DIR/backend/.env"
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=*
EOF
    echo "[INFO] Created backend/.env configuration."
fi

# 5. Setup frontend dependencies and build bundle
echo "[3/4] Installing Node.js dependencies..."
npm install

echo "[4/4] Building production UI bundle..."
npm run build

# Make scripts executable
chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
chmod +x "$SCRIPT_DIR"/scripts/build/*.sh 2>/dev/null || true
chmod +x "$SCRIPT_DIR"/scripts/tools/*.sh 2>/dev/null || true

echo ""
echo "========================================================"
echo "  Installation Complete!"
echo ""
echo "  Commands:"
echo "    ./debug.sh   -> Start in debug mode (Vite :5173 + FastAPI :8000)"
echo "    ./start.sh   -> Start in production mode (:8000)"
echo "========================================================"
echo ""
