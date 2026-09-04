#!/usr/bin/env bash
# Himmel POS — Linux Shutdown Script

echo "========================================================"
echo "  Stopping all Himmel POS Services & Terminals..."
echo "========================================================"
echo ""

echo "Terminating Python backend processes..."
pkill -f "main.py" 2>/dev/null
pkill -f "pos-backend" 2>/dev/null


echo "Terminating Node.js frontend processes..."
pkill -f "vite" 2>/dev/null

echo "Terminating Litestream replication processes..."
pkill -f "litestream" 2>/dev/null

echo ""
echo "========================================================"
echo "  All Himmel POS services and processes have stopped."
echo "========================================================"
