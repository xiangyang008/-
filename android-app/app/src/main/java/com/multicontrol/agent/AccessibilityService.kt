package com.multicontrol.agent

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent

/**
 * 无障碍服务：接收归一化坐标，用 dispatchGesture 注入触摸/滑动，
 * 用 performGlobalAction 注入系统按键（HOME/BACK/RECENTS）。
 */
class AccessibilityService : AccessibilityService() {
    companion object {
        var instance: AccessibilityService? = null
    }

    private var gesturePath: Path? = null
    private var gestureStartTime = 0L

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

    override fun onInterrupt() {}

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    /** 注入触摸：action 0=Down, 1=Up, 2=Move；x/y 为归一化 0~1 */
    fun injectTouch(action: Int, x: Float, y: Float) {
        val metrics = resources.displayMetrics
        val px = x * metrics.widthPixels
        val py = y * metrics.heightPixels

        when (action) {
            0 -> {
                gesturePath = Path()
                gesturePath?.moveTo(px, py)
                gestureStartTime = System.currentTimeMillis()
            }
            2 -> {
                gesturePath?.lineTo(px, py)
            }
            1 -> {
                val path = gesturePath ?: return
                val duration = System.currentTimeMillis() - gestureStartTime
                val gesture = GestureDescription.Builder()
                    .addStroke(GestureDescription.StrokeDescription(path, 0, duration.coerceAtLeast(50L)))
                    .build()
                dispatchGesture(gesture, null, null)
                gesturePath = null
            }
        }
    }

    /** 注入系统按键：3=HOME, 4=BACK, 187=RECENTS */
    fun injectKey(keyCode: Int) {
        val action = when (keyCode) {
            3 -> GLOBAL_ACTION_HOME
            4 -> GLOBAL_ACTION_BACK
            187 -> GLOBAL_ACTION_RECENTS
            200 -> GLOBAL_ACTION_NOTIFICATIONS
            201 -> GLOBAL_ACTION_QUICK_SETTINGS
            else -> return
        }
        performGlobalAction(action)
    }
}
    // ===== 新增：注入触摸事件 =====
    fun injectTouch(action: Int, x: Float, y: Float) {
        val path = android.graphics.Path()
        path.moveTo(x, y)
        val gestureBuilder = android.accessibilityservice.GestureDescription.Builder()
        gestureBuilder.addStroke(android.accessibilityservice.GestureDescription.StrokeDescription(path, 0, 1))
        dispatchGesture(gestureBuilder.build(), null, null)
    }

    // ===== 新增：注入按键事件 =====
    fun injectKey(keyCode: Int) {
        val event = android.view.KeyEvent(android.view.KeyEvent.ACTION_DOWN, keyCode)
        // 通过 AccessibilityService 注入按键（需要 API 28+）
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            val node = rootInActiveWindow
            node?.performAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK) // 示例，实际需自定义
            // 简单实现：发送广播或使用 InputManager，但这里仅演示，实际可能需结合其他方式
        }
        // 由于系统限制，简单的 KeyEvent 注入在无障碍中较复杂，可改用 shell 命令（需要 root）或 InputManager
        // 作为临时方案，我们只实现触摸注入，按键暂不实现，或使用其它方式。
        // 如果确实需要按键，可以考虑通过 Runtime.exec("input keyevent $keyCode")
        try {
            Runtime.getRuntime().exec("input keyevent $keyCode")
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
