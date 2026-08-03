#!/usr/bin/env bash
# Himmel POS — Linux LAN & Firewall Setup Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "========================================================"
echo "  Himmel POS — Linux Remote Mobile / LAN Setup"
echo "========================================================"
echo ""

# 1. Update backend/.env
echo "[1/3] Updating backend/.env configuration..."
ENV_FILE="$SCRIPT_DIR/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    cat <<EOF > "$ENV_FILE"
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=*
EOF
    echo "[OK] Created backend/.env with HOST=0.0.0.0 and ALLOWED_ORIGINS=*"
else
    grep -q "^HOST=" "$ENV_FILE" || echo "HOST=0.0.0.0" >> "$ENV_FILE"
    grep -q "^ALLOWED_ORIGINS=" "$ENV_FILE" || echo "ALLOWED_ORIGINS=*" >> "$ENV_FILE"
    echo "[OK] Updated backend/.env settings."
fi

# 2. Configure UFW Firewall if installed
echo ""
echo "[2/3] Checking firewall (UFW)..."
if command -v ufw &>/dev/null; then
    if sudo ufw status | grep -q "active"; then
        echo "[INFO] Opening ports 5173 and 8000 in ufw..."
        sudo ufw allow 5173/tcp comment "Himmel POS Frontend" >/dev/null
        sudo ufw allow 8000/tcp comment "Himmel POS Backend" >/dev/null
        echo "[OK] Ports 5173 and 8000 allowed in UFW."
    else
        echo "[INFO] UFW is inactive. Ports 5173 & 8000 are accessible."
    fi
else
    echo "[INFO] UFW not installed. Ensure ports 5173 & 8000 are open in your system firewall."
fi

# 3. Print Local IPv4 Addresses
echo ""
echo "[3/3] Detecting Local Network IP Address..."
echo "--------------------------------------------------------"
IP_LIST=$(hostname -I 2>/dev/null)
for ip in $IP_LIST; do
    case "$ip" in
        127.*|169.254.*) ;;
        *) echo "  -> Phone Web URL: http://$ip:5173" ;;
    esac
done
echo "--------------------------------------------------------"

echo ""
echo "========================================================"
echo "  ✅ LINUX LAN & MOBILE ACCESS CONFIGURED!"
echo "  1. Ensure phone is on the SAME Wi-Fi / LAN network."
echo "  2. Open one of the URLs above on your phone browser."
echo "  3. Start POS using: ./himmel_pos.sh"
echo "========================================================"
echo ""
