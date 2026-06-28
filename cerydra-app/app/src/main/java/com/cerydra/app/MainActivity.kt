package com.cerydra.app

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private val rpc by lazy { DiscordRPCManager(this) }
    private val mainHandler = Handler(Looper.getMainLooper())
    private var discordAuthCodeVerifier: String? = null
    private var authPhase: String? = null
    private var returnUrl: String? = null
    private val TAG = "CerydraRPC"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.userAgentString = settings.userAgentString + " CerydraApp/1.0"
            settings.cacheMode = WebSettings.LOAD_DEFAULT

            addJavascriptInterface(CerydraBridge(), "CerydraRPC")

            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    Log.d(TAG, "onPageStarted: url=$url, authPhase=$authPhase")

                    if (url?.startsWith(DiscordRPCManager.REDIRECT_URI) == true) {
                        val code = android.net.Uri.parse(url).getQueryParameter("code")
                        Log.d(TAG, "onPageStarted: redirect match, code=${code != null}, authPhase=$authPhase")
                        if (code != null && authPhase == "waiting_consent") {
                            authPhase = "exchanging"
                            handleOAuthRedirect(code)
                        }
                    }
                }

                override fun onPageFinished(view: WebView, url: String?) {
                    super.onPageFinished(view, url)
                    Log.d(TAG, "onPageFinished: url=$url, authPhase=$authPhase")

                    if ((url?.startsWith("https://discord.com/channels/@me") == true ||
                                url?.startsWith("https://discord.com/app") == true) &&
                        authPhase == "waiting_token"
                    ) {
                        captureToken(view)
                    }
                }
            }

            webChromeClient = WebChromeClient()
            loadUrl(getString(R.string.start_url))
        }

        setContentView(webView)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy: cleaning up RPC")
        rpc.clearPresence()
        super.onDestroy()
    }

    override fun onResume() {
        super.onResume()
        if (rpc.isConnected && authPhase == null) {
            webView.evaluateJavascript(
                "if(window.__rpcResume)window.__rpcResume()", null
            )
        }
    }

    private fun captureToken(view: WebView) {
        // Try multiple keys — Discord has changed storage keys over time
        val js = """
            (function(){
                try {
                    // Key 1: 'token'
                    var t1 = localStorage.getItem('token');
                    if (t1 && t1.length > 50) return t1;
                    
                    // Key 2: '__DISCORD_TOKEN' (some older builds)
                    var t2 = localStorage.getItem('__DISCORD_TOKEN');
                    if (t2 && t2.length > 50) return t2;
                    
                    // Key 3: '__token' (some client mods)
                    var t3 = localStorage.getItem('__token');
                    if (t3 && t3.length > 50) return t3;
                    
                    // Key 4: 'discord_token' (legacy)
                    var t4 = localStorage.getItem('discord_token');
                    if (t4 && t4.length > 50) return t4;
                    
                    // Try to extract from IndexedDB (Discord stores token in 'token' store)
                    // If nothing found, return empty
                    return '';
                } catch(e) {
                    return '';
                }
            })()
        """.trimIndent()

        view.evaluateJavascript(js) { result ->
            val token = result?.trim('"') ?: ""
            Log.d(TAG, "captureToken: token len=${token.length}, >50=${token.length > 50}")
            if (token.length > 50) {
                authPhase = "authorizing"
                doOAuthDirect(token)
            } else {
                Log.w(TAG, "captureToken: token not found in localStorage, trying alternate methods...")
                // Fallback: try to find token via document.cookie or other means
                view.evaluateJavascript(
                    "(function(){try{return document.cookie}catch(e){return ''}})()"
                ) { cookieResult ->
                    val cookie = cookieResult?.trim('"') ?: ""
                    Log.d(TAG, "captureToken: cookies len=${cookie.length}, cookies=[${cookie.take(200)}]")
                    // Also try accessing window.__INITIAL_STATE__
                    view.evaluateJavascript(
                        "(function(){try{var s=window.__INITIAL_STATE__;return s?JSON.stringify(s).substring(0,1000):''}catch(e){return ''}})()"
                    ) { stateResult ->
                        val state = stateResult?.trim('"') ?: ""
                        Log.d(TAG, "captureToken: __INITIAL_STATE__ len=${state.length}")
                        // If all fails, show manual login URL
                        Log.w(TAG, "captureToken: ALL METHODS FAILED - cannot extract Discord token")
                    }
                }
            }
        }
    }

    private fun doOAuthDirect(userToken: String) {
        Log.d(TAG, "doOAuthDirect: starting, token=${userToken.take(20)}...")
        thread {
            val verifier = rpc.generateCodeVerifier()
            discordAuthCodeVerifier = verifier
            val challenge = rpc.generateCodeChallenge(verifier)
            Log.d(TAG, "doOAuthDirect: PKCE generated, challenge=${challenge.take(20)}...")
            val code = rpc.getAuthorizationCode(userToken, challenge)

            if (code != null) {
                Log.d(TAG, "doOAuthDirect: got code directly, exchanging...")
                handleOAuthRedirect(code)
            } else {
                Log.d(TAG, "doOAuthDirect: no direct code, loading consent page...")
                val authUrl = rpc.buildAuthorizeUrl(challenge)
                mainHandler.post {
                    authPhase = "waiting_consent"
                    Log.d(TAG, "doOAuthDirect: loading consent url=$authUrl")
                    webView.loadUrl(authUrl)
                }
            }
        }
    }

    private fun handleOAuthRedirect(code: String) {
        Log.d(TAG, "handleOAuthRedirect: exchanging code ${code.take(20)}...")
        thread {
            val verifier = discordAuthCodeVerifier
            if (verifier == null) {
                Log.e(TAG, "handleOAuthRedirect: no verifier!")
                return@thread
            }
            val ok = rpc.exchangeCode(code, verifier)
            Log.d(TAG, "handleOAuthRedirect: exchange result=$ok")
            mainHandler.post {
                authPhase = null
                discordAuthCodeVerifier = null
                webView.loadUrl(getString(R.string.start_url))
            }
        }
    }

    // --- JS Bridge ---
    inner class CerydraBridge {
        @JavascriptInterface
        fun connect() {
            Log.d(TAG, "bridge: connect() called")
            mainHandler.post {
                if (rpc.isConnected) {
                    Log.d(TAG, "bridge: already connected")
                    return@post
                }
                returnUrl = webView.url
                
                val verifier = rpc.generateCodeVerifier()
                discordAuthCodeVerifier = verifier
                val challenge = rpc.generateCodeChallenge(verifier)
                
                authPhase = "waiting_consent"
                Log.d(TAG, "bridge: loading discord oauth url")
                // Disable cache during login to avoid stale pages
                webView.settings.cacheMode = WebSettings.LOAD_NO_CACHE
                webView.loadUrl(rpc.buildAuthorizeUrl(challenge))
            }
        }

        @JavascriptInterface
        fun disconnect() {
            Log.d(TAG, "bridge: disconnect() called")
            webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
            rpc.clearPresence()
            rpc.clearTokens()
        }

        @JavascriptInterface
        fun updatePresence(json: String) {
            try {
                val data = JSONObject(json)
                Log.d(TAG, "bridge: updatePresence details=${data.optString("details")} state=${data.optString("state")}")
                rpc.updatePresence(
                    details = data.optString("details", "Browsing Cerydra"),
                    state = data.optString("state", ""),
                    largeImage = data.optString("largeImage", null),
                    startTimestamp = if (data.has("startTimestamp")) data.getLong("startTimestamp") else null,
                    endTimestamp = if (data.has("endTimestamp")) data.getLong("endTimestamp") else null,
                    watchUrl = data.optString("url", null)
                )
            } catch (e: Exception) {
                Log.w(TAG, "bridge: updatePresence parse error: ${e.message}")
            }
        }

        @JavascriptInterface
        fun clear() {
            Log.d(TAG, "bridge: clear() called")
            rpc.clearPresence()
        }

        @JavascriptInterface
        fun isConnected(): Boolean = rpc.isConnected

        @JavascriptInterface
        fun getStatus(): String = JSONObject().apply {
            put("connected", rpc.isConnected)
        }.toString()
    }
}
