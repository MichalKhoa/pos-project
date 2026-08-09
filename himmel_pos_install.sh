#!/usr/bin/env bash
# Himmel POS — Automated 1-Click Installation Script (Linux)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "========================================================"
echo "  Himmel POS Automated 1-Click Installation Script"
echo "========================================================"
echo ""

# 1. Verify Python & Node.js
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python 3 not found. Please install python3 and python3-venv."
    exit 1
fi

if ! command -v npm &>/dev/null; then
    echo "[ERROR] Node.js / npm not found. Please install Node.js LTS."
    exit 1
fi

# 2. Setup Python Virtual Environment
echo "[1/4] Setting up Python virtual environment..."
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    python3 -m venv "$SCRIPT_DIR/backend/venv" || { echo "[ERROR] Failed to create venv."; exit 1; }
fi
"$SCRIPT_DIR/backend/venv/bin/pip" install --upgrade pip >/dev/null 2>&1
"$SCRIPT_DIR/backend/venv/bin/pip" install -r "$SCRIPT_DIR/backend/requirements.txt"

# 3. Setup Frontend Dependencies
echo ""
echo "[2/4] Installing Node.js frontend dependencies..."
cd "$SCRIPT_DIR" || exit 1
npm install

# 4. Streamlined Interactive .env Generator (Optional)
echo ""
echo "[3/4] Checking environment configuration..."
ENV_FILE="$SCRIPT_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    cat <<EOF > "$ENV_FILE"
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=*
EOF
    echo "[OK] backend/.env was automatically created."
else
    echo "[OK] backend/.env configuration already exists."
fi

chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null

# 5. Create Desktop Shortcut Automatically
echo ""
echo "[4/4] Creating Desktop Shortcut..."
DESKTOP_DIR="$HOME/Desktop"
if [ -d "$DESKTOP_DIR" ]; then
    SHORTCUT="$DESKTOP_DIR/Himmel POS.desktop"
    cat <<EOF > "$SHORTCUT"
[Desktop Entry]
Version=1.0
Type=Application
Name=Himmel POS
Comment=Himmel POS Cashier & Customer Display
Exec=$SCRIPT_DIR/himmel_pos.sh
Icon=utilities-terminal
Terminal=true
Categories=Office;Finance;
EOF
    chmod +x "$SHORTCUT" 2>/dev/null
    echo "[OK] Desktop shortcut created at $SHORTCUT."
fi

echo ""
echo "========================================================"
echo "  ✅ INSTALLATION COMPLETED!"
echo "  Start Himmel POS using: ./himmel_pos.sh"
echo "========================================================"
echo ""
