package id.katsucode.insan

import android.app.Activity
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

class MainActivity : Activity() {
    // Ganti setelah frontend di-deploy ke HTTPS.
    private val appUrl = "https://GANTI-DENGAN-URL-FRONTEND-ANDA"

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        setContentView(webView)
        if (appUrl.contains("GANTI-DENGAN")) {
            Toast.makeText(this, "Atur URL frontend pada MainActivity.kt terlebih dahulu", Toast.LENGTH_LONG).show()
        } else {
            webView.loadUrl(appUrl)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }
}
