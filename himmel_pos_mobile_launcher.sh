#!/usr/bin/env bash

echo "========================================================"
echo "  Himmel POS — Starting for Phone / LAN Access"
echo "========================================================"
echo ""

# 1. Ensure backend/.env
if [ ! -f "./backend/.env" ]; then
    cat <<EOT > ./backend/.env
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=*
EOT
fi

# 2. Start Backend
cd backend
if [ -d "venv" ]; then
    source venv/bin/activate
fi
python3 main.py &
BACKEND_PID=$!
cd ..

# 3. Start Frontend
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

sleep 3

# 4. Show IPs
echo ""
echo "========================================================"
echo "  📱 OPEN THIS URL ON YOUR PHONE (CHROME):"
echo "========================================================"
ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | while read -r ip ; do
    echo "   👉  http://${ip}:5173"
done
hostname -I 2>/dev/null | tr ' ' '\n' | grep -v '127.0.0.1' | while read -r ip ; do
    [ -n "$ip" ] && echo "   👉  http://${ip}:5173"
done
echo "========================================================"
echo ""

wait $FRONTEND_PID $BACKEND_PID
