# Menjalankan INSAN Stock Manager di Termux

## Prinsip operasi
- Backend Node.js berjalan langsung di HP Android (Termux).
- Database utama berupa file lokal `backend/data/data.json`; tidak membutuhkan MongoDB atau internet.
- Frontend dilayani backend yang sama pada port 8787.
- PWA memakai Service Worker untuk menyimpan aset aplikasi, dan IndexedDB untuk cache stok serta antrean transaksi offline.
- Ketika koneksi ke server tersedia lagi, transaksi antrean dikirim ke endpoint sinkronisasi dengan ID unik agar tidak terduplikasi.

## Instalasi
Pasang Termux dari F-Droid atau sumber resmi Termux. Buka Termux, lalu jalankan:

```bash
pkg update && pkg upgrade -y
pkg install git nodejs-lts openssl -y
git clone https://github.com/katsucodeid/insan-stock-manager.git
cd insan-stock-manager
bash scripts/install-termux.sh
```

Catat username dan password admin yang ditampilkan. Jangan bagikan file `backend/.env`.

## Menjalankan server
```bash
cd ~/insan-stock-manager
bash scripts/start-termux.sh
```
Buka browser pada HP server: `http://127.0.0.1:8787`. Untuk perangkat lain pada Wi-Fi/hotspot yang sama, gunakan `http://IP-LOKAL-HP:8787`. Cari IP dengan `ip -4 addr show wlan0`.

## Offline dan sinkronisasi
1. Buka aplikasi saat online melalui HTTPS dan pasang ke layar utama agar Service Worker menyimpan asetnya. Setelah pemuatan pertama, aplikasi dapat dibuka offline pada perangkat tersebut.
2. Jika internet putus tetapi perangkat masih bisa menjangkau HP server melalui Wi-Fi/hotspot lokal, semua perangkat dapat terus menggunakan database pusat di HP server.
3. Jika perangkat benar-benar tidak memiliki jalur jaringan ke server, aplikasi yang sudah pernah dibuka tetap dapat dipakai pada perangkat itu. Perubahan disimpan di IndexedDB lokal.
4. Saat perangkat tersambung lagi ke server, tekan **Perbarui / sinkronkan** atau tunggu koneksi kembali. Transaksi offline dikirim satu per satu/batch dengan ID unik. Jika stok server sudah berubah sehingga transaksi tidak bisa diterapkan, transaksi tetap berada di antrean dan ditandai untuk pemeriksaan.

**Batasan penting:** beberapa perangkat yang terpisah total dari jaringan tidak dapat melihat perubahan satu sama lain secara langsung. Setiap perangkat menampung perubahan sendiri sampai dapat tersambung kembali ke server. Sinkronisasi bukan penggabungan real-time saat tidak ada koneksi.

## Akses dari luar jaringan
Agar dapat diakses melalui internet, HP server harus memiliki koneksi internet dan Termux + server tetap berjalan. Jika cloudflared yang kompatibel tersedia di Termux:

```bash
cd ~/insan-stock-manager
bash scripts/start-tunnel.sh
```

Cloudflare Quick Tunnel menghasilkan URL acak `trycloudflare.com`; URL tersebut aktif hanya selama proses tunnel berjalan dan berubah ketika dibuat ulang. Quick Tunnel ditujukan untuk pengujian, bukan layanan produksi dengan jaminan uptime. Siapa pun yang mengetahui URL dapat mencapai halaman login; jangan bagikan URL sembarangan. Opsional, batasi alamat email dengan:

```bash
TUNNEL_EMAIL=alamat-email-anda@example.com bash scripts/start-tunnel.sh
```

Quick Tunnel dan tunnel internet tidak akan dapat bekerja ketika HP server kehilangan internet. Akses lokal melalui IP Wi-Fi masih dapat berfungsi.

## Mulai otomatis saat HP restart
Install add-on Termux:Boot dari sumber instalasi Termux yang sama. Buka Termux:Boot satu kali, lalu di Termux jalankan:

```bash
cd ~/insan-stock-manager
bash scripts/install-boot.sh
```

Panduan resmi: https://github.com/termux/termux-boot#readme. Android dapat membatasi proses latar belakang; izinkan Termux berjalan tanpa optimasi baterai. `termux-wake-lock` membantu menjaga CPU aktif tetapi menguras baterai. Mulai otomatis bukan jaminan Android tidak akan menghentikan proses.

## Backup dan keamanan
- Backup database: salin `~/insan-stock-manager/backend/data/data.json` secara berkala ke lokasi aman.
- Jangan hapus folder `backend/data` saat memperbarui kode.
- Jangan commit `.env` atau `data.json` ke GitHub.
- Sistem ini menyimpan data utama di HP server. Jika HP rusak/hilang tanpa backup, data server berisiko hilang.
- Password disimpan dalam bentuk hash bcrypt. Tetap gunakan password kuat.
- Jangan membuka port router secara langsung.

## Pembaruan kode
```bash
cd ~/insan-stock-manager
git pull
cd backend && npm install
```
Hentikan server dengan Ctrl+C sebelum memperbarui, lalu jalankan kembali.
