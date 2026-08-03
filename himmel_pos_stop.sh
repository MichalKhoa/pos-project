#!/usr/bin/env bash
# Himmel POS — Linux Shutdown Script

echo "========================================================"
echo "  Stopping Himmel POS Services on Linux..."
echo "========================================================"

pkill -f "main.py" 2>/dev/null
pkill -f "vite" 2>/dev/null

echo "✅ Himmel POS processes stopped."
