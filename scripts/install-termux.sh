#!/data/data/com.termux/files/usr/bin/bash
set -e
pkg update -y
pkg install -y nodejs-lts git openssl
cd "$HOME"
if [ ! -d insan-stock-manager ]; then
  git clone https://github.com/katsucodeid/insan-stock-manager.git
fi
cd insan-stock-manager/backend
npm install
if [ ! -f .env ]; then
  ADMIN_PASS="$(openssl rand -hex 10)"
  JWT="$(openssl rand -hex 32)"
  cat > .env <<EOF
PORT=8787
JWT_SECRET=$JWT
ADMIN_USERNAME=insanadmin
ADMIN_PASSWORD=$ADMIN_PASS
EOF
  chmod 600 .env
  echo
  echo "SIMPAN KREDENSIAL INI SEKARANG:"
  echo "Username: insanadmin"
  echo "Password: $ADMIN_PASS"
  echo "Password hanya ditampilkan saat instalasi pertama."
fi
echo
echo "Instalasi selesai. Jalankan: cd ~/insan-stock-manager && bash scripts/start-termux.sh"
