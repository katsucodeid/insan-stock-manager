# Android Studio project
1. Install Android Studio and Android SDK Platform 35.
2. Open this android folder in Android Studio.
3. Wait for Gradle sync.
4. After deploying the frontend, edit app/src/main/java/id/katsucode/insan/MainActivity.kt and set appUrl to the HTTPS frontend URL.
5. Build > Build Bundle(s) / APK(s) > Build APK(s).
6. APK debug appears under app/build/outputs/apk/debug/.
7. For distribution, create a signed release APK via Build > Generate Signed Bundle / APK.
