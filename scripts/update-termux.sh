#!/data/data/com.termux/files/usr/bin/bash
set -e
ROOT="$HOME/insan-stock-manager"
OLD_PID="${1:-}"
TARGET_COMMIT="${2:-}"
LOG="$HOME/insan-stock-manager-update.log"
exec >>"$LOG" 2>&1
sleep 2
cd "$ROOT"
echo "=== INSAN update $(date) ==="
if ! [[ "$TARGET_COMMIT" =~ ^[a-fA-F0-9]{40}$ ]]; then
  echo "Commit SHA tidak valid."
  exit 1
fi
git fetch origin main
if ! git cat-file -e "$TARGET_COMMIT^{commit}" 2>/dev/null; then
  echo "Commit target tidak ditemukan setelah fetch."
  exit 1
fi
if ! git merge-base --is-ancestor "$TARGET_COMMIT" origin/main; then
  echo "Commit target bukan bagian dari branch origin/main."
  exit 1
fi
if ! git merge-base --is-ancestor HEAD "$TARGET_COMMIT"; then
  echo "Update ditolak: commit target bukan fast-forward dari versi terpasang."
  exit 1
fi
git merge --ff-only "$TARGET_COMMIT"
cd "$ROOT/backend"
npm install --omit=dev
if [ -n "$OLD_PID" ]; then kill "$OLD_PID" 2>/dev/null || true; fi
sleep 2
termux-wake-lock 2>/dev/null || true
npm start
