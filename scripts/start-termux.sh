#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$HOME/insan-stock-manager/backend"
if [ ! -f .env ]; then echo "File .env belum ada. Jalankan scripts/install-termux.sh"; exit 1; fi
termux-wake-lock 2>/dev/null || true
npm start
