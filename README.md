# INSAN Stock Manager

Aplikasi inventaris bersama: frontend web/PWA + backend Node.js/MongoDB + kerangka Android WebView.

## Fitur
- Login multi-perangkat dengan JWT.
- Dashboard stok bersama.
- Barang masuk: pack x isi per pack + tambahan pcs.
- Target produksi per tanggal/lokasi dan jenis loyang.
- Aturan normal: 2 pcs per loyang untuk Box isi 3, Box isi 5 luar, Box isi 5 dalam, dan Kertas Minyak.
- Request khusus menggantikan aturan normal untuk target tersebut.
- Mika roti roll tidak otomatis berkurang.
- Riwayat transaksi dan laporan siap salin.
- Dark/light mode.

## Keamanan
Jangan masukkan URI MongoDB atau password ke frontend/Android. Simpan `MONGODB_URI`, `JWT_SECRET`, `ADMIN_USERNAME`, dan `ADMIN_PASSWORD` hanya sebagai environment variables backend. Gunakan format URI Atlas `mongodb+srv://USER:PASSWORD_URL_ENCODED@HOST/insan_stock?retryWrites=true&w=majority`.

## Deploy
Backend Node.js 20+ di Render (Blueprint `render.yaml`), database MongoDB Atlas, frontend statis HTTPS. Lihat `docs/DEPLOY_RENDER_MONGODB.md`.

## Android
Folder `android/` berisi proyek Android WebView; ganti URL frontend HTTPS di `MainActivity.kt`, lalu build APK melalui Android Studio. Ini source project, bukan APK biner.

## Stok awal
- Box isi 3: 3861
- Box isi 5 luar/slongsong: 3427
- Box isi 5 dalam/tatakan polos: 3559
- Kertas Minyak: 1686
- Mika roti roll: 210
