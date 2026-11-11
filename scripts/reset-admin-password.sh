#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$HOME/insan-stock-manager"
cd "$ROOT/backend"

if [ ! -f .env ]; then
  echo "File backend/.env tidak ditemukan. Jangan membuat database baru; periksa instalasi terlebih dahulu."
  exit 1
fi

ADMIN_USERNAME="$(node -e 'require("dotenv").config(); process.stdout.write(process.env.ADMIN_USERNAME || "")')"
if [ -z "$ADMIN_USERNAME" ]; then
  read -r -p "Username admin yang ingin dipulihkan: " ADMIN_USERNAME
fi
if [ -z "$ADMIN_USERNAME" ]; then
  echo "Username tidak boleh kosong."
  exit 1
fi

printf "Password admin baru (minimal 10 karakter): "
read -r -s RESET_PASSWORD
printf "\n"
if [ "${#RESET_PASSWORD}" -lt 10 ]; then
  echo "Password minimal 10 karakter."
  unset RESET_PASSWORD
  exit 1
fi
printf "Ulangi password baru: "
read -r -s RESET_PASSWORD_CONFIRM
printf "\n"
if [ "$RESET_PASSWORD" != "$RESET_PASSWORD_CONFIRM" ]; then
  echo "Password tidak sama."
  unset RESET_PASSWORD RESET_PASSWORD_CONFIRM
  exit 1
fi
export RESET_ADMIN_USERNAME="$ADMIN_USERNAME" RESET_ADMIN_PASSWORD="$RESET_PASSWORD"
unset RESET_PASSWORD RESET_PASSWORD_CONFIRM

node <<'NODE'
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

(async () => {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const dataFile = path.join(dataDir, "data.json");
  if (!fs.existsSync(dataFile)) {
    throw new Error("Database tidak ditemukan. Proses dibatalkan agar tidak membuat database kosong.");
  }
  const db = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  if (!db || !Array.isArray(db.users) || !Array.isArray(db.transactions) || !db.stock) {
    throw new Error("Struktur database tidak valid. Tidak ada data yang diubah.");
  }

  const username = process.env.RESET_ADMIN_USERNAME;
  const password = process.env.RESET_ADMIN_PASSWORD;
  if (!username || !password || password.length < 10) {
    throw new Error("Kredensial tidak valid.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = db.users.find(user => user.username === username);
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = "admin";
    console.log("Password akun admin yang ada berhasil diperbarui.");
  } else {
    db.users.push({
      id: require("crypto").randomUUID(),
      username,
      passwordHash,
      role: "admin"
    });
    console.log("Akun admin baru berhasil ditambahkan.");
  }

  const tempFile = dataFile + ".reset.tmp";
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tempFile, dataFile);
  console.log("Database stok dan transaksi tetap dipertahankan.");
})().catch(error => {
  console.error("Pemulihan gagal:", error.message);
  process.exitCode = 1;
});
NODE

unset RESET_ADMIN_USERNAME RESET_ADMIN_PASSWORD
