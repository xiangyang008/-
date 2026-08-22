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
 *
 * 关键：MediaCodec 的 CODEC_CONFIG 帧是原始 SPS/PPS（无起始码），
 * 客户端解析器只认 annexb（带 00 00 00 01 起始码），
 * 所以这里在 onOutputFormatChanged 里主动把 SPS/PPS 拼成 annexb 发送一次，
 * 并跳过原始 CODEC_CONFIG 帧，否则客户端拿不到 SPS/PPS → 解码失败 → 黑屏。
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
    private var configSent = false

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

            override fun onOutputFormatChanged(codec: MediaCodec, format: MediaFormat) {
                // 主动发送 SPS/PPS（拼成 annexb），确保客户端能配置解码器
                if (!configSent) {
                    val sps = format.getByteBuffer("csd-0")
                    val pps = format.getByteBuffer("csd-1")
                    if (sps != null && pps != null) {
                        val spsBytes = ByteArray(sps.remaining())
                        sps.get(spsBytes)
                        val ppsBytes = ByteArray(pps.remaining())
                        pps.get(ppsBytes)
                        val startCode = byteArrayOf(0, 0, 0, 1)
                        val annexb = ByteArray(4 + spsBytes.size + 4 + ppsBytes.size)
                        var o = 0
                        System.arraycopy(startCode, 0, annexb, o, 4); o += 4
                        System.arraycopy(spsBytes, 0, annexb, o, spsBytes.size); o += spsBytes.size
                        System.arraycopy(startCode, 0, annexb, o, 4); o += 4
                        System.arraycopy(ppsBytes, 0, annexb, o, ppsBytes.size)
                        configSent = true
                        onFrame(buildFrame(annexb, true))
                    }
                }
            }

            override fun onOutputBufferAvailable(codec: MediaCodec, index: Int, info: MediaCodec.BufferInfo) {
                // 跳过原始 CODEC_CONFIG 帧（SPS/PPS 已在 onOutputFormatChanged 发送）
                if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                    codec.releaseOutputBuffer(index, false)
                    return
                }
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
        configSent = false
        virtualDisplay?.release()
        virtualDisplay = null
        codec?.stop()
        codec?.release()
        codec = null
    }
}
