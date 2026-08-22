package com.multicontrol.agent

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var usernameInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var statusText: TextView

    private var pendingLoginToken: String? = null

    private val handler = Handler(Looper.getMainLooper())
    private val statusRefresh = object : Runnable {
        override fun run() {
            updateStatus()
            handler.postDelayed(this, 1500)
        }
    }

    private val mediaProjectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK && result.data != null && pendingLoginToken != null) {
            startControlService(result.resultCode, result.data!!, pendingLoginToken!!)
        } else {
            statusText.text = "已取消录屏授权"
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        usernameInput = findViewById(R.id.usernameInput)
        passwordInput = findViewById(R.id.passwordInput)
        statusText = findViewById(R.id.statusText)
        val loginButton = findViewById<Button>(R.id.loginButton)
        val registerButton = findViewById<Button>(R.id.registerButton)
        val accessibilityButton = findViewById<Button>(R.id.accessibilityButton)

        // 恢复上次登录的用户名
        val prefs = getSharedPreferences("config", Context.MODE_PRIVATE)
        usernameInput.setText(prefs.getString("username", ""))

        loginButton.setOnClickListener { doLogin() }
        registerButton.setOnClickListener { doRegister() }
        accessibilityButton.setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        updateStatus()
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
        handler.postDelayed(statusRefresh, 1500)
    }

    override fun onPause() {
        super.onPause()
        handler.removeCallbacks(statusRefresh)
    }

    private fun updateStatus() {
        statusText.text = when {
            ControlService.running -> "✅ 已连接，正在被控制"
            ControlService.connected -> "✅ 已连接，等待电脑控制\n（打开电脑端就能看到这台手机）"
            else -> "未连接"
        }
    }

    private fun doLogin() {
        val username = usernameInput.text.toString().trim()
        val password = passwordInput.text.toString()
        if (username.isEmpty() || password.isEmpty()) {
            statusText.text = "请输入用户名和密码"
            return
        }
        statusText.text = "登录中…"
        NetClient(Config.SERVER_HOST).login(username, password) { result ->
            when (result.optString("type")) {
                "login-ok" -> {
                    val token = result.optString("token")
                    getSharedPreferences("config", Context.MODE_PRIVATE)
                        .edit()
                        .putString("username", username)
                        .putString("loginToken", token)
                        .apply()
                    pendingLoginToken = token
                    statusText.text = "登录成功，请允许录屏"
                    requestMediaProjection()
                }
                "login-error" -> statusText.text = result.optString("error", "登录失败")
                else -> statusText.text = "登录失败：" + result.optString("error", "无法连接服务器")
            }
        }
    }

    private fun doRegister() {
        val username = usernameInput.text.toString().trim()
        val password = passwordInput.text.toString()
        if (username.isEmpty() || password.isEmpty()) {
            statusText.text = "请输入用户名和密码"
            return
        }
        statusText.text = "注册中…"
        NetClient(Config.SERVER_HOST).registerUser(username, password) { result ->
            when (result.optString("type")) {
                "register-user-ok" -> statusText.text = "注册成功，请点「登录」"
                "register-user-error" -> statusText.text = result.optString("error", "注册失败")
                else -> statusText.text = "注册失败：" + result.optString("error", "无法连接服务器")
            }
        }
    }

    private fun requestMediaProjection() {
        val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjectionLauncher.launch(mpm.createScreenCaptureIntent())
    }

    private fun startControlService(resultCode: Int, data: Intent, loginToken: String) {
        val intent = Intent(this, ControlService::class.java)
        intent.putExtra("resultCode", resultCode)
        intent.putExtra("data", data)
        intent.putExtra("loginToken", loginToken)
        if (Build.VERSION.SDK_INT >= 26) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        statusText.text = "连接中…"
    }
}
