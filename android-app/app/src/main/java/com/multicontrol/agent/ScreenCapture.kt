package com.multicontrol.agent

import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.projection.MediaProjection

/**
 * 屏幕采集 + H.264 硬编码。
 * MediaProjection → VirtualDisplay → Surface → MediaCodec(输入 Surface) → annexb 字节流。
 * 输出格式：`[1 字节 flags: bit0=关键帧] + H.264 annexb 数据`
 */
class ScreenCapture(
    private val projection: MediaProjection,
    private val width: Int,
    private val height: Int,
    private val densityDpi: Int,
    private val onFrame: (ByteArray) -> Unit
) {
    private var codec: MediaCodec? = null
    private var virtualDisplay: VirtualDisplay? = null

    fun start() {
        if (codec != null) return

        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height)
        format.setInteger(
            MediaFormat.KEY_COLOR_FORMAT,
            MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface
        )
        format.setInteger(MediaFormat.KEY_BIT_RATE, 2_000_000)
        format.setInteger(MediaFormat.KEY_FRAME_RATE, 15)
        format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)

        val c = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        c.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        val inputSurface = c.createInputSurface()

        c.setCallback(object : MediaCodec.Callback() {
            override fun onInputBufferAvailable(codec: MediaCodec, index: Int) {}

            override fun onOutputBufferAvailable(codec: MediaCodec, index: Int, info: MediaCodec.BufferInfo) {
                val buffer = codec.getOutputBuffer(index) ?: return
                val data = ByteArray(info.size)
                buffer.position(info.offset)
                buffer.limit(info.offset + info.size)
                buffer.get(data)
                val isKey = info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME != 0
                codec.releaseOutputBuffer(index, false)
                onFrame(buildFrame(data, isKey))
            }

            override fun onError(codec: MediaCodec, e: MediaCodec.CodecException) {}

            override fun onOutputFormatChanged(codec: MediaCodec, format: MediaFormat) {}
        })

        c.start()
        codec = c

        virtualDisplay = projection.createVirtualDisplay(
            "multicontrol",
            width,
            height,
            densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            inputSurface,
            null,
            null
        )
    }

    private fun buildFrame(data: ByteArray, isKey: Boolean): ByteArray {
        val out = ByteArray(1 + data.size)
        out[0] = if (isKey) 1 else 0
        System.arraycopy(data, 0, out, 1, data.size)
        return out
    }

    fun stop() {
        virtualDisplay?.release()
        virtualDisplay = null
        codec?.stop()
        codec?.release()
        codec = null
    }
}
