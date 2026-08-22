package com.multicontrol.agent

import android.os.Build
import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString.Companion.toByteString
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * WebSocket 客户端：
 * 1. request()：临时连接，发一条 JSON、收一条结果（用于注册/登录）
 * 2. start()：长连接，设备上线（带登录 token）、发视频帧、收控制指令，断线自动重连
 */
class NetClient(private val host: String) {
    private val handler = Handler(Looper.getMainLooper())

    // ===== 临时请求（注册 / 登录）=====
    fun request(msg: JSONObject, onResult: (JSONObject) -> Unit) {
        val client = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .build()
        val req = Request.Builder().url("ws://$host").build()
        client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                webSocket.send(msg.toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val result = try {
                    JSONObject(text)
                } catch (e: Exception) {
                    JSONObject().put("type", "error")
                }
                handler.post { onResult(result) }
                webSocket.close(1000, null)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                handler.post {
                    onResult(JSONObject().put("type", "error").put("error", t.message ?: "无法连接服务器"))
                }
            }
        })
    }

    fun login(username: String, password: String, onResult: (JSONObject) -> Unit) {
        request(
            JSONObject().put("type", "login").put("username", username).put("password", password),
            onResult
        )
    }

    fun registerUser(username: String, password: String, onResult: (JSONObject) -> Unit) {
        request(
            JSONObject().put("type", "register-user").put("username", username).put("password", password),
            onResult
        )
    }

    // ===== 长连接（设备运行）=====
    private var loginToken = ""
    private var deviceId = ""
    private var screenW = 0
    private var screenH = 0
    private var videoW = 0
    private var videoH = 0
    private var ws: WebSocket? = null
    private var onCommand: ((String, JSONObject) -> Unit)? = null
    private var reconnectRunnable: Runnable? = null

    fun start(
        loginToken: String,
        deviceId: String,
        screenW: Int,
        screenH: Int,
        videoW: Int,
        videoH: Int,
        onCommand: (String, JSONObject) -> Unit
    ) {
        this.loginToken = loginToken
        this.deviceId = deviceId
        this.screenW = screenW
        this.screenH = screenH
        this.videoW = videoW
        this.videoH = videoH
        this.onCommand = onCommand
        connect()
    }

    private fun connect() {
        val client = OkHttpClient.Builder()
            .pingInterval(10, TimeUnit.SECONDS)
            .build()
        val req = Request.Builder().url("ws://$host").build()
        ws = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val msg = JSONObject()
                msg.put("type", "register")
                msg.put("deviceId", deviceId)
                msg.put("name", Build.MODEL)
                msg.put("loginToken", loginToken)
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
                    // 忽略无法解析的消息
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

    fun sendVideoFrame(data: ByteArray) {
        ws?.send(data.toByteString())
    }

    fun disconnect() {
        reconnectRunnable?.let { handler.removeCallbacks(it) }
        reconnectRunnable = null
        ws?.close(1000, null)
        ws = null
    }

    private fun scheduleReconnect() {
        reconnectRunnable?.let { handler.removeCallbacks(it) }
        reconnectRunnable = Runnable { connect() }
        handler.postDelayed(reconnectRunnable!!, 5000)
    }
}
