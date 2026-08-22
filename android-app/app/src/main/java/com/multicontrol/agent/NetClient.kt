package com.multicontrol.agent

import android.os.Build
import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class NetClient(
    private val host: String,
    private val token: String,
    private val deviceId: String,
    private val screenW: Int,
    private val screenH: Int,
    private val videoW: Int,
    private val videoH: Int,
    private val deviceName: String = Build.MODEL
) {
    private var ws: WebSocket? = null
    private val handler = Handler(Looper.getMainLooper())
    private var onCommand: ((String, JSONObject) -> Unit)? = null
    private var reconnectRunnable: Runnable? = null

    fun connect(onCommand: (String, JSONObject) -> Unit) {
        this.onCommand = onCommand
        val client = OkHttpClient.Builder()
            .pingInterval(10, TimeUnit.SECONDS)
            .build()
        val request = Request.Builder().url("ws://$host").build()
        ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val msg = JSONObject()
                msg.put("type", "register")
                msg.put("deviceId", deviceId)
                msg.put("name", deviceName)
                msg.put("token", token)
                msg.put("screenW", screenW)
                msg.put("screenH", screenH)
                msg.put("videoW", videoW)
                msg.put("videoH", videoH)
                webSocket.send(msg.toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = JSONObject(text)
                    val type = msg.optString("type")
                    handler.post { onCommand?.invoke(type, msg) }
                } catch (e: Exception) {
                    // 忽略
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                scheduleReconnect()
            }
        })
    }

    // ===== 修复：使用 toByteString() 扩展函数（Okio 2+ 兼容）=====
    fun sendVideoFrame(data: ByteArray) {
        ws?.send(data.toByteString())
    }

    fun disconnect() {
        reconnectRunnable?.let { handler.removeCallbacks(it) }
        ws?.close(1000, null)
        ws = null
    }

    private fun scheduleReconnect() {
        reconnectRunnable?.let { handler.removeCallbacks(it) }
        reconnectRunnable = Runnable {
            onCommand?.let { connect(it) }
        }
        handler.postDelayed(reconnectRunnable!!, 5000)
    }
}