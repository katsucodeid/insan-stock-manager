# APK Android INSAN Stock Manager

Setiap perubahan pada folder `android/` akan memicu GitHub Actions untuk membangun APK debug. Kamu juga bisa menjalankan build manual dari tab **Actions** > **Build INSAN Stock Manager APK** > **Run workflow**.

Setelah status workflow **Success**:
1. Buka halaman repository GitHub.
2. Pilih tab **Actions**.
3. Buka proses **Build INSAN Stock Manager APK** yang terbaru.
4. Di bagian **Artifacts**, unduh `INSAN-Stock-Manager-debug-APK`.
5. Ekstrak ZIP, lalu instal `app-debug.apk` di Android.

APK ini adalah antarmuka WebView untuk backend Termux lokal. Sebelum membuka APK, jalankan server:
```bash
bash ~/insan-stock-manager/scripts/start-termux.sh
```
Kemudian buka APK. Server dan database berada di HP yang sama. APK tidak menggantikan backend Termux.

Catatan: ini APK debug untuk pengujian/pemasangan pribadi, belum ditandatangani sebagai rilis produksi.
