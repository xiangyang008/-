package com.multicontrol.agent

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.util.Log

class AccessibilityService : AccessibilityService() {
    companion object {
        var instance: AccessibilityService? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: android.view.accessibility.AccessibilityEvent?) {
        // 不需要处理事件
    }

    override fun onInterrupt() {
        // 不需要处理
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    // ===== 注入触摸手势 =====
    fun injectTouch(action: Int, x: Float, y: Float) {
        val path = Path()
        path.moveTo(x, y)
        val stroke = GestureDescription.StrokeDescription(path, 0, 1)
        val builder = GestureDescription.Builder()
        builder.addStroke(stroke)
        val gesture = builder.build()
        dispatchGesture(gesture, null, null)
    }

    // ===== 注入按键（使用 shell 命令，无需 root）=====
    fun injectKey(keyCode: Int) {
        try {
            Runtime.getRuntime().exec("input keyevent $keyCode")
        } catch (e: Exception) {
            Log.e("AccessibilityService", "按键注入失败", e)
        }
    }
}