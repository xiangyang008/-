package com.multicontrol.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics
import org.json.JSONObject

/**
 * 前台服务：持有 MediaProjection + MediaCodec + WebSocket，保活并总控一切。
 */
class ControlService : Service() {
    companion object {
        private const val CHANNEL_ID = "multicontrol"
        private const val NOTIFICATION_ID = 1
        var running = false
            private set
    }

    private var screenCapture: ScreenCapture? = null
    private var netClient: NetClient? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent != null && intent.hasExtra("data")) {
            val resultCode = intent.getIntExtra("resultCode", 0)
            val data: Intent? = intent.getParcelableExtra("data")
            val host = intent.getStringExtra("host") ?: ""
            val token = intent.getStringExtra("token") ?: "multicontrol"
            if (data != null) startCapture(resultCode, data, host, token)
        }
        return START_STICKY
    }

    private fun startCapture(resultCode: Int, data: Intent, host: String, token: String) {
        val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection = mpm.getMediaProjection(resultCode, data)
        if (projection == null) return

        // 屏幕分辨率
        val metrics = DisplayMetrics()
        val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        dm.getDisplay(android.view.Display.DEFAULT_DISPLAY)?.getRealMetrics(metrics)
        val screenW = metrics.widthPixels
        val screenH = metrics.heightPixels

        // 视频分辨率（长边不超过 720，保持宽高比）
        val maxSide = 720
        val scale = if (screenW > screenH) maxSide.toFloat() / screenW else maxSide.toFloat() / screenH
        val videoW = Math.round(screenW * scale)
        val videoH = Math.round(screenH * scale)

        val deviceId = getDeviceId()

        // 网络客户端
        val client = NetClient(host, token, deviceId, screenW, screenH, videoW, videoH)
        netClient = client

        // 屏幕采集
        screenCapture = ScreenCapture(projection, videoW, videoH, metrics.densityDpi) { frame ->
            client.sendVideoFrame(frame)
        }

        // 连接服务器，收到指令后分发
        client.connect { type, msg ->
            when (type) {
                "start" -> {
                    running = true
                    screenCapture?.start()
                }
                "stop" -> {
                    running = false
                    screenCapture?.stop()
                }
                "touch" -> injectTouch(msg)
                "key" -> injectKey(msg)
                else -> {}
            }
        }
    }

    private fun injectTouch(msg: JSONObject) {
        val action = msg.optInt("action", 0)
        val x = msg.optDouble("x", 0.0).toFloat()
        val y = msg.optDouble("y", 0.0).toFloat()
        AccessibilityService.instance?.injectTouch(action, x, y)
    }

    private fun injectKey(msg: JSONObject) {
        val keyCode = msg.optInt("keyCode", 0)
        AccessibilityService.instance?.injectKey(keyCode)
    }

    // ===== 修复：加 override 并改为 public =====
    public override fun getDeviceId(): String {
        val prefs = getSharedPreferences("config", Context.MODE_PRIVATE)
        var id = prefs.getString("deviceId", null)
        if (id == null) {
            id = "phone-" + java.util.UUID.randomUUID().toString().substring(0, 8)
            prefs.edit().putString("deviceId", id).apply()
        }
        return id
    }

    private fun buildNotification(): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL_ID, "多控服务", NotificationManager.IMPORTANCE_LOW)
            nm.createNotificationChannel(channel)
        }
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("多控助手运行中")
            .setContentText("正在接受远程控制")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .build()
    }

    override fun onDestroy() {
        running = false
        screenCapture?.stop()
        netClient?.disconnect()
        super.onDestroy()
    }
}