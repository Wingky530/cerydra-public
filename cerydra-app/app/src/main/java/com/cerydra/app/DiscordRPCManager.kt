package com.cerydra.app

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import android.util.Log
import kotlin.concurrent.thread
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom

class DiscordRPCManager(private val context: Context) {
    private val prefs: SharedPreferences by lazy { context.getSharedPreferences("cerydra_rpc", Context.MODE_PRIVATE) }
    private val TAG = "CerydraRPC"

    companion object {
        const val CLIENT_ID = "503557087041683458"
        const val REDIRECT_URI = "https://login.premid.app"
        const val SCOPES = "identify activities.write"
        const val APP_NAME = "Cerydra"
        const val ACTIVITY_TYPE = 3
    }

    private var accessToken: String? = null
    private var refreshToken: String? = null
    private var sessionToken: String? = null
    private var expiresAt: Long = 0

    val isConnected: Boolean
        get() = accessToken != null && System.currentTimeMillis() < expiresAt

    init { loadTokens() }

    // --- Persistence ---
    private fun loadTokens() {
        accessToken = prefs.getString("access_token", null)
        refreshToken = prefs.getString("refresh_token", null)
        expiresAt = prefs.getLong("expires_at", 0)
        Log.d(TAG, "loadTokens: hasAccess=${accessToken != null}, expiresAt=$expiresAt, expired=${System.currentTimeMillis() >= expiresAt}")
    }

    private fun saveTokens(access: String, refresh: String, expiresIn: Long) {
        accessToken = access
        refreshToken = refresh
        expiresAt = System.currentTimeMillis() + expiresIn * 1000
        prefs.edit()
            .putString("access_token", access)
            .putString("refresh_token", refresh)
            .putLong("expires_at", expiresAt)
            .apply()
        Log.d(TAG, "saveTokens: ok, expiresAt=$expiresAt")
    }

    fun clearTokens() {
        accessToken = null
        refreshToken = null
        sessionToken = null
        expiresAt = 0
        prefs.edit().clear().apply()
        Log.d(TAG, "clearTokens: ok")
    }

    // --- PKCE ---
    fun generateCodeVerifier(): String {
        val bytes = ByteArray(64)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    fun generateCodeChallenge(verifier: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray())
        return Base64.encodeToString(digest, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    fun buildAuthorizeUrl(challenge: String): String {
        return "https://discord.com/api/v10/oauth2/authorize?" +
            "client_id=$CLIENT_ID" +
            "&redirect_uri=${URLEncoder.encode(REDIRECT_URI, "UTF-8")}" +
            "&response_type=code" +
            "&code_challenge_method=S256" +
            "&code_challenge=$challenge" +
            "&scope=${URLEncoder.encode(SCOPES, "UTF-8")}"
    }

    // --- Direct API OAuth (uses user token -> auth code) ---
    fun getAuthorizationCode(userToken: String, codeChallenge: String): String? {
        return try {
            val url = URL("https://discord.com/api/v10/oauth2/authorize")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Authorization", "Bearer $userToken")
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            conn.doOutput = true
            conn.instanceFollowRedirects = false
            conn.connectTimeout = 15000
            conn.readTimeout = 15000

            val body = "client_id=$CLIENT_ID" +
                "&redirect_uri=${URLEncoder.encode(REDIRECT_URI, "UTF-8")}" +
                "&response_type=code" +
                "&code_challenge_method=S256" +
                "&code_challenge=$codeChallenge" +
                "&scope=${URLEncoder.encode(SCOPES, "UTF-8")}"

            OutputStreamWriter(conn.outputStream).use { it.write(body) }

            val responseCode = conn.responseCode
            val location = conn.getHeaderField("Location")
            Log.d(TAG, "getAuthorizationCode: responseCode=$responseCode, location=$location")

            if (responseCode == 302 && location != null) {
                val code = android.net.Uri.parse(location).getQueryParameter("code")
                Log.d(TAG, "getAuthorizationCode: code from 302=${code != null}")
                code
            } else if (responseCode in 200..399) {
                val bodyText = try { conn.inputStream.bufferedReader().readText() } catch (_: Exception) { "" }
                Log.d(TAG, "getAuthorizationCode: body=[${bodyText.take(500)}]")
                null
            } else {
                val errorText = try { conn.errorStream.bufferedReader().readText() } catch (_: Exception) { "" }
                Log.d(TAG, "getAuthorizationCode: error=$responseCode body=[${errorText.take(500)}]")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "getAuthorizationCode: exception=${e.message}", e)
            null
        }
    }

    // --- Token exchange ---
    fun exchangeCode(code: String, verifier: String): Boolean {
        return try {
            val body = "client_id=$CLIENT_ID" +
                "&grant_type=authorization_code" +
                "&code=$code" +
                "&code_verifier=$verifier" +
                "&redirect_uri=${URLEncoder.encode(REDIRECT_URI, "UTF-8")}"

            val conn = URL("https://discord.com/api/v10/oauth2/token").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            conn.doOutput = true
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            OutputStreamWriter(conn.outputStream).use { it.write(body) }

            val responseCode = conn.responseCode
            val responseText = conn.inputStream.bufferedReader().readText()
            Log.d(TAG, "exchangeCode: responseCode=$responseCode")

            if (responseCode != 200) {
                Log.e(TAG, "exchangeCode: failure body=[${responseText.take(500)}]")
                return false
            }

            val json = JSONObject(responseText)
            saveTokens(
                access = json.getString("access_token"),
                refresh = json.getString("refresh_token"),
                expiresIn = json.getLong("expires_in")
            )
            Log.d(TAG, "exchangeCode: ok")
            true
        } catch (e: Exception) {
            Log.e(TAG, "exchangeCode: exception=${e.message}", e)
            false
        }
    }

    // --- Token refresh ---
    private fun ensureToken(): Boolean {
        if (accessToken != null && System.currentTimeMillis() < expiresAt) return true
        val rt = refreshToken ?: return false
        return try {
            val body = "client_id=$CLIENT_ID&grant_type=refresh_token&refresh_token=$rt"
            val conn = URL("https://discord.com/api/v10/oauth2/token").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            conn.doOutput = true
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            OutputStreamWriter(conn.outputStream).use { it.write(body) }

            val responseCode = conn.responseCode
            val responseText = conn.inputStream.bufferedReader().readText()
            Log.d(TAG, "ensureToken: responseCode=$responseCode")

            if (responseCode != 200) {
                Log.e(TAG, "ensureToken: failure body=[${responseText.take(500)}]")
                clearTokens()
                return false
            }

            val json = JSONObject(responseText)
            saveTokens(
                access = json.getString("access_token"),
                refresh = json.optString("refresh_token", rt),
                expiresIn = json.getLong("expires_in")
            )
            true
        } catch (e: Exception) {
            Log.e(TAG, "ensureToken: exception=${e.message}", e)
            clearTokens()
            false
        }
    }

    // --- Headless Sessions ---
    fun updatePresence(
        details: String,
        state: String = "",
        largeImage: String? = null,
        startTimestamp: Long? = null,
        endTimestamp: Long? = null,
        watchUrl: String? = null
    ) {
        if (!ensureToken()) {
            Log.w(TAG, "updatePresence: no valid token")
            return
        }

        val activity = JSONObject().apply {
            put("application_id", CLIENT_ID)
            put("name", APP_NAME)
            put("type", ACTIVITY_TYPE)
            put("platform", "desktop")
            put("details", details)
            put("state", state)
            
            if (startTimestamp != null || endTimestamp != null) {
                put("timestamps", JSONObject().apply {
                    startTimestamp?.let { put("start", it) }
                    endTimestamp?.let { put("end", it) }
                })
            }
            
            put("status_display_type", 2)
            
            if (largeImage != null) {
                put("assets", JSONObject().apply {
                    put("large_image", largeImage)
                    put("large_text", APP_NAME)
                })
            }
            if (watchUrl != null) {
                put("buttons", JSONArray().apply {
                    put(JSONObject().apply {
                        put("label", "Watch on Cerydra")
                        put("url", watchUrl)
                    })
                })
            }
        }

        val body = JSONObject().apply {
            put("activities", JSONArray().put(activity))
            put("token", sessionToken ?: JSONObject.NULL)
        }

        try {
            val conn = URL("https://discord.com/api/v10/users/@me/headless-sessions").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Authorization", "Bearer $accessToken")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }

            val responseCode = conn.responseCode
            val responseText = conn.inputStream.bufferedReader().readText()
            Log.d(TAG, "updatePresence: responseCode=$responseCode body=[${responseText.take(500)}]")

            if (responseCode == 200) {
                sessionToken = JSONObject(responseText).optString("token", null)
                Log.d(TAG, "updatePresence: sessionToken=${sessionToken != null}")
            } else {
                Log.e(TAG, "updatePresence: failure body=[${responseText.take(500)}]")
            }
        } catch (e: Exception) {
            Log.e(TAG, "updatePresence: exception=${e.message}", e)
        }
    }

    fun clearPresence() {
        sessionToken?.let { token ->
            sessionToken = null
            thread {
                try {
                    val conn = URL("https://discord.com/api/v10/users/@me/headless-sessions/delete").openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Authorization", "Bearer $accessToken")
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.doOutput = true
                    conn.connectTimeout = 10000
                    conn.readTimeout = 10000
                    OutputStreamWriter(conn.outputStream).use { it.write(JSONObject().apply { put("token", token) }.toString()) }
                    val responseCode = conn.responseCode
                    Log.d(TAG, "clearPresence: responseCode=$responseCode")
                    conn.inputStream.bufferedReader().readText()
                } catch (e: Exception) {
                    Log.w(TAG, "clearPresence: exception=${e.message}")
                }
            }
        }
    }
}
