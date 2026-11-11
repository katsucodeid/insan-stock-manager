# Android client

Source Android WebView untuk membuka backend Termux lokal pada perangkat yang sama.

1. Jalankan backend pada Termux dengan `bash ~/insan-stock-manager/scripts/start-termux.sh`.
2. Buka folder `android/` menggunakan Android Studio dan tunggu Gradle sync.
3. Aplikasi membuka `http://127.0.0.1:8787`; Termux harus berjalan pada HP yang sama.
4. Build > Build Bundle(s) / APK(s) > Build APK(s).
5. APK debug tersedia di `app/build/outputs/apk/debug/`.

Catatan: repository ini menyimpan source project, bukan APK siap pasang. Untuk perangkat berbeda, buka alamat IP lokal HP server pada browser ketika berada di Wi-Fi/hotspot yang sama, atau gunakan tunnel HTTPS saat internet tersedia. PWA harus pernah dibuka melalui origin yang mendukung Service Worker sebelum bisa membuka antarmuka secara offline.
