#!/usr/bin/env bash
# Himmel POS — Automated App Updater (Linux)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "========================================================"
echo "  Updating Himmel POS to Latest Version from GitHub"
echo "========================================================"
echo ""

# 1. Safely stop running POS backend services and browser windows
echo "[1/5] Stopping active POS services and app instances..."
"$SCRIPT_DIR/himmel_pos_stop.sh" >/dev/null 2>&1

# 2. Pull latest release changes from GitHub repository
echo ""
echo "[2/5] Fetching latest release from GitHub (git pull origin master)..."
git pull origin master
if [ $? -ne 0 ]; then
    echo "[WARNING] Git pull failed or offline. Proceeding with local build..."
fi

# 3. Update Python virtual environment & database schema
echo ""
echo "[3/5] Updating Python packages & auto-migrating database..."
cd "$SCRIPT_DIR/backend" || exit 1
if [ -d "venv" ]; then
    source venv/bin/activate
fi
pip install -r requirements.txt --quiet
python3 -c "from database import engine, Base; Base.metadata.create_all(bind=engine); print('Database schema OK')"

# 4. Install npm packages & compile React frontend
echo ""
echo "[4/5] Building latest React touchscreen UI bundle..."
cd "$SCRIPT_DIR" || exit 1
npm install --no-audit --no-fund
npm run build

# 5. Restart Register Application
echo ""
echo "[5/5] Restarting Himmel POS..."
echo ""
echo "========================================================"
echo "  ✅ HIMMEL POS UPDATE COMPLETED SUCCESSFULLY!"
echo "========================================================"
echo ""

exec "$SCRIPT_DIR/himmel_pos.sh"
