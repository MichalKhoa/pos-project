#!/usr/bin/env bash
# VoltFlow POS — Production Starter Alias
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/start_pos.sh" "$@"
