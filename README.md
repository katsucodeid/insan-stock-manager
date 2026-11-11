# INSAN Stock Manager

Aplikasi stok offline-first untuk Termux Android. Tidak memakai Render dan tidak wajib memakai MongoDB.

## Arsitektur
- Backend Node.js/Express berjalan di HP Android melalui Termux.
- Database lokal persisten: `backend/data/data.json`.
- Frontend PWA memakai Service Worker untuk cache aset dan IndexedDB untuk snapshot serta antrean transaksi.
- Saat online, perubahan disinkronkan ke backend Termux melalui `/api/sync` dengan ID transaksi idempoten.
- Akses perangkat lain di jaringan lokal melalui IP HP server. Akses dari luar jaringan membutuhkan internet dan tunnel HTTPS.

## Fitur
- Login admin/staff, dashboard stok, barang masuk, target produksi, laporan siap salin, riwayat, tema gelap/terang.
- Aturan normal: 2 pcs per loyang untuk Box isi 3, Box isi 5 luar, Box isi 5 dalam, dan Kertas Minyak.
- Request kemasan khusus menggantikan aturan normal untuk transaksi tersebut.
- Mika tidak otomatis berkurang.
- Validasi agar stok tidak negatif.
- Operasi offline disimpan lokal dan antrean disinkronkan kembali saat server dapat dijangkau.

## Stok awal
- Box isi 3: 3861
- Box isi 5 luar/slongsong: 3427
- Box isi 5 dalam/tatakan polos: 3559
- Kertas Minyak: 1686
- Mika: 210

## Instalasi cepat Termux
```bash
pkg update && pkg upgrade -y
pkg install git nodejs-lts openssl -y
git clone https://github.com/katsucodeid/insan-stock-manager.git
cd insan-stock-manager
bash scripts/install-termux.sh
```
Simpan kredensial admin yang muncul. Jalankan server:
```bash
bash scripts/start-termux.sh
```
Buka `http://127.0.0.1:8787`.

Petunjuk lengkap: [docs/TERMUX_OFFLINE.md](docs/TERMUX_OFFLINE.md).

## Catatan penting
- Offline penuh baru tersedia setelah aplikasi pernah dibuka dan asetnya tercache.
- Banyak perangkat tanpa internet dapat mengakses server yang sama jika masih berada pada jaringan lokal yang sama.
- Perangkat yang benar-benar terputus dari server menyimpan perubahan secara lokal; sinkronisasi terjadi setelah terhubung kembali.
- Akses dari internet luar memerlukan koneksi internet pada HP server dan tunnel HTTPS.
- Backup berkala file `backend/data/data.json`.
- Jangan unggah `.env`, password, token, atau `data.json` ke GitHub.
