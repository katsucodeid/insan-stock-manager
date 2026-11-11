# Menjalankan INSAN Stock Manager di Termux

## Prinsip operasi
- Backend Node.js berjalan langsung di HP Android (Termux).
- Database utama berupa file lokal `backend/data/data.json`; tidak membutuhkan MongoDB atau internet.
- Frontend dilayani backend yang sama pada port 8787.
- PWA menggunakan Service Worker untuk menyimpan aset aplikasi, dan IndexedDB untuk cache stok serta antrean transaksi offline.
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
Buka browser pada HP server: `http://127.0.0.1:8787`. Untuk perangkat lain pada Wi-Fi yang sama, gunakan `http://IP-LOKAL-HP:8787`. Cari IP dengan `ip -4 addr show wlan0`.

## Offline dan internet
1. Buka aplikasi saat online melalui HTTPS dan pasang ke layar utama agar Service Worker menyimpan asetnya. Setelah pemuatan pertama, aplikasi bisa dibuka offline pada perangkat tersebut.
2. Jika internet putus tetapi perangkat masih bisa menjangkau HP server melalui Wi-Fi/hotspot, semua perangkat dapat terus mengakses backend lokal.
3. Jika perangkat benar-benar tidak memiliki jaringan, aplikasi yang sudah pernah dibuka tetap dapat digunakan secara lokal. Perubahan dicatat di IndexedDB perangkat tersebut.
4. Saat perangkat tersambung lagi ke server, tekan **Perbarui / sinkronkan** atau tunggu event online. Jika stok server sudah berubah sehingga transaksi offline tidak dapat diterapkan, transaksi ditahan dan ditandai untuk pemeriksaan; tidak dibuang diam-diam.

## Akses dari luar Wi-Fi
Untuk mengakses server HP dari luar jaringan diperlukan internet. Gunakan tunnel HTTPS (misalnya Cloudflare Tunnel) yang diarahkan ke `http://localhost:8787`. Quick Tunnel memberikan URL acak dan cocok untuk uji coba; URL baru dapat berubah ketika tunnel dibuat ulang. Jangan menganggap tunnel sebagai jaminan uptime. Jangan membuka port router tanpa memahami risikonya.

## Mulai otomatis
Pasang add-on Termux:Boot dari sumber instalasi Termux yang sama, buka sekali, lalu buat skrip boot. Panduan resmi: https://github.com/termux/termux-boot#readme. Android dapat membatasi proses latar belakang; izinkan Termux berjalan tanpa optimasi baterai. `termux-wake-lock` membantu menjaga CPU aktif tetapi menguras baterai.

## Backup dan keamanan
- Backup database: salin `~/insan-stock-manager/backend/data/data.json` secara berkala ke lokasi aman.
- Jangan hapus folder `backend/data` saat memperbarui kode.
- Jangan commit `.env` atau `data.json` ke GitHub.
- Sistem ini menyimpan data utama di HP server. Jika HP rusak/hilang tanpa backup, data server berisiko hilang.
- Offline di banyak perangkat tidak berarti perubahan langsung menjadi data bersama. Setiap perangkat menyimpan antreannya sendiri sampai bisa menjangkau server. Periksa konflik saat sinkronisasi.

## Pembaruan kode
```bash
cd ~/insan-stock-manager
git pull
cd backend && npm install
```
Hentikan server dengan Ctrl+C sebelum memperbarui, lalu jalankan kembali.
