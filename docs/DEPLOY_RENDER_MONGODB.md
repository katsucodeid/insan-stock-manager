# Deploy backend INSAN ke Render + MongoDB Atlas

## 1. MongoDB Atlas
- Pilih project/cluster yang sudah ada.
- Pastikan user database ratsan0410_db_user aktif.
- Untuk tes awal, Network Access dapat memakai 0.0.0.0/0; ini membuka akses dari semua IP. Gunakan password kuat dan batasi lagi untuk produksi.
- Jangan kirim password ke chat atau menaruh URI di frontend/APK.
- URI: mongodb+srv://USERNAME:PASSWORD_URL_ENCODED@katsucode.o7yauqy.mongodb.net/insan_stock?retryWrites=true&w=majority

## 2. GitHub
Upload seluruh isi proyek ke root repository. Pastikan render.yaml, backend/, frontend/, android/, dan docs/ ada di root. Jangan upload .env.

## 3. Render
- Dashboard > New > Blueprint, pilih repository.
- Isi MONGODB_URI, ADMIN_USERNAME, ADMIN_PASSWORD. JWT_SECRET dibuat otomatis oleh Blueprint.
- Setelah deploy, uji https://URL-API/api/health; harus membalas {"ok":true,...}.

## 4. Frontend
- Deploy folder frontend sebagai Static Site.
- Ubah frontend/config.js: API_BASE menjadi URL API HTTPS tanpa slash akhir.
- Ubah CORS_ORIGIN di Render menjadi URL frontend HTTPS yang tepat, lalu deploy ulang.

## 5. APK
- Buka folder android/ di Android Studio.
- Ubah appUrl di MainActivity.kt menjadi URL frontend HTTPS.
- Sync Gradle lalu Build APK.

## Catatan
Render Free dapat tidur setelah tidak aktif dan mengalami cold start. Seed hanya mengisi dokumen stok yang belum ada; deploy ulang tidak mereset stok.
