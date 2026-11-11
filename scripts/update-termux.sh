#!/data/data/com.termux/files/usr/bin/bash
set -e
ROOT="$HOME/insan-stock-manager"
OLD_PID="${1:-}"
LOG="$HOME/insan-stock-manager-update.log"
exec >>"$LOG" 2>&1
sleep 2
cd "$ROOT"
echo "=== INSAN update $(date) ==="
git pull --ff-only origin main
cd "$ROOT/backend"
npm install --omit=dev
if [ -n "$OLD_PID" ]; then kill "$OLD_PID" 2>/dev/null || true; fi
sleep 2
termux-wake-lock 2>/dev/null || true
npm start
