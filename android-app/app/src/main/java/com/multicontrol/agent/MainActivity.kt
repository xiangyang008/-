package com.multicontrol.agent

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView

class MainActivity : Activity() {
    companion object {
        private const val REQUEST_MEDIA_PROJECTION = 100
    }

    private lateinit var hostInput: EditText
    private lateinit var tokenInput: EditText
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        hostInput = findViewById(R.id.hostInput)
        tokenInput = findViewById(R.id.tokenInput)
        statusText = findViewById(R.id.statusText)
        val startButton = findViewById<Button>(R.id.startButton)
        val accessibilityButton = findViewById<Button>(R.id.accessibilityButton)

        // 恢复上次填写的服务器地址与 token
        val prefs = getSharedPreferences("config", Context.MODE_PRIVATE)
        hostInput.setText(prefs.getString("host", ""))
        tokenInput.setText(prefs.getString("token", "multicontrol"))

        startButton.setOnClickListener {
            val host = hostInput.text.toString().trim()
            if (host.isEmpty()) {
                statusText.text = "请先填写服务器地址"
                return@setOnClickListener
            }
            val token = tokenInput.text.toString().trim().ifEmpty { "multicontrol" }
            prefs.edit().putString("host", host).putString("token", token).apply()
            requestMediaProjection()
        }

        accessibilityButton.setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        updateStatus()
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
    }

    private fun updateStatus() {
        val running = ControlService.running
        statusText.text = if (running) "状态：服务运行中" else "状态：未启动"
    }

    private fun requestMediaProjection() {
        val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(mpm.createScreenCaptureIntent(), REQUEST_MEDIA_PROJECTION)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == RESULT_OK && data != null) {
                startService(resultCode, data)
            } else {
                statusText.text = "已取消录屏授权"
            }
        }
    }

    private fun startService(resultCode: Int, data: Intent) {
        val host = hostInput.text.toString().trim()
        val token = tokenInput.text.toString().trim().ifEmpty { "multicontrol" }
        val intent = Intent(this, ControlService::class.java)
        intent.putExtra("resultCode", resultCode)
        intent.putExtra("data", data)
        intent.putExtra("host", host)
        intent.putExtra("token", token)
        if (Build.VERSION.SDK_INT >= 26) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        statusText.text = "启动中…"
    }
}
