#!/data/data/com.termux/files/usr/bin/bash
set -e
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared belum terpasang atau tidak tersedia untuk arsitektur Android/Termux ini."
  echo "Pasang build cloudflared yang kompatibel terlebih dahulu. Lihat docs/TERMUX_OFFLINE.md."
  exit 1
fi
echo "Pastikan server INSAN sudah berjalan pada port 8787."
if [ -n "${TUNNEL_EMAIL:-}" ]; then
  cloudflared tunnel --url http://127.0.0.1:8787 --allowed-mail "$TUNNEL_EMAIL"
else
  cloudflared tunnel --url http://127.0.0.1:8787
fi
