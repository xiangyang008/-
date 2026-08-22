// H.264 视频解码渲染管理器：接收 annexb 流 → 解析 SPS/PPS → WebCodecs 解码 → canvas 渲染
import {
  parseAnnexb,
  nalType,
  NAL_SPS,
  NAL_PPS,
  NAL_IDR,
  avcCodecString,
  buildAvcCDescription,
  nalToAvcc
} from './h264'

interface DecoderSession {
  decoder: VideoDecoder | null
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D | null
  sps: Uint8Array | null
  pps: Uint8Array | null
  configured: boolean
  pending: { data: Uint8Array; keyframe: boolean }[]
  timestamp: number
  onSize: (w: number, h: number) => void
}

class VideoManager {
  private sessions = new Map<string, DecoderSession>()
  private canvases = new Map<string, HTMLCanvasElement>()
  private sizeCallbacks = new Map<string, (w: number, h: number) => void>()

  registerCanvas(deviceId: string, canvas: HTMLCanvasElement, onSize: (w: number, h: number) => void): void {
    this.canvases.set(deviceId, canvas)
    this.sizeCallbacks.set(deviceId, onSize)
  }

  unregisterCanvas(deviceId: string): void {
    this.destroySession(deviceId)
    this.canvases.delete(deviceId)
    this.sizeCallbacks.delete(deviceId)
  }

  onData(deviceId: string, annexb: Uint8Array, keyframe: boolean): void {
    const canvas = this.canvases.get(deviceId)
    if (!canvas) return
    const session = this.ensureSession(deviceId, canvas)
    this.feed(session, annexb, keyframe)
  }

  onEnd(deviceId: string): void {
    // 视频流结束：销毁解码器，但保留 canvas 注册（设备可能重连）
    this.destroySession(deviceId)
  }

  private destroySession(deviceId: string): void {
    const s = this.sessions.get(deviceId)
    if (s) {
      try {
        s.decoder?.close()
      } catch {
        /* 忽略 */
      }
      this.sessions.delete(deviceId)
    }
  }

  private ensureSession(deviceId: string, canvas: HTMLCanvasElement): DecoderSession {
    let s = this.sessions.get(deviceId)
    if (!s) {
      const onSize = this.sizeCallbacks.get(deviceId) || (() => {})
      s = {
        decoder: null,
        canvas,
        ctx: canvas.getContext('2d'),
        sps: null,
        pps: null,
        configured: false,
        pending: [],
        timestamp: 0,
        onSize
      }
      this.sessions.set(deviceId, s)
    }
    return s
  }

  private feed(session: DecoderSession, annexb: Uint8Array, keyframe: boolean): void {
    const nals = parseAnnexb(annexb)
    for (const nal of nals) {
      const t = nalType(nal)
      if (t === NAL_SPS) session.sps = nal
      else if (t === NAL_PPS) session.pps = nal
    }

    if (!session.configured && session.sps && session.pps) {
      this.configure(session)
    }

    // 非 SPS/PPS 的 NAL 才是帧数据
    const frameNals = nals.filter((n) => {
      const t = nalType(n)
      return t !== NAL_SPS && t !== NAL_PPS
    })
    if (frameNals.length === 0) return

    // 拼接 avcC 格式（长度前缀 + NAL）
    let total = 0
    for (const n of frameNals) total += 4 + n.length
    const avcc = new Uint8Array(total)
    let o = 0
    for (const n of frameNals) {
      const enc = nalToAvcc(n)
      avcc.set(enc, o)
      o += enc.length
    }

    const isKey = keyframe || frameNals.some((n) => nalType(n) === NAL_IDR)

    if (!session.configured) {
      if (session.pending.length < 60) session.pending.push({ data: avcc, keyframe: isKey })
      return
    }
    this.decode(session, avcc, isKey)
  }

  private configure(session: DecoderSession): void {
    try {
      const description = buildAvcCDescription(session.sps!, session.pps!)
      const decoder = new VideoDecoder({
        output: (frame) => this.render(session, frame),
        error: (e) => console.error('[decode]', e)
      })
      decoder.configure({
        codec: avcCodecString(session.sps!),
        description,
        optimizeForLatency: true
      })
      session.decoder = decoder
      session.configured = true
      // 冲刷缓存的帧
      const cached = session.pending
      session.pending = []
      for (const p of cached) this.decode(session, p.data, p.keyframe)
    } catch (e) {
      console.error('[configure]', e)
    }
  }

  private decode(session: DecoderSession, avcc: Uint8Array, keyframe: boolean): void {
    const decoder = session.decoder
    if (!decoder || decoder.state !== 'configured') return
    try {
      decoder.decode(
        new EncodedVideoChunk({
          type: keyframe ? 'key' : 'delta',
          timestamp: session.timestamp++,
          data: avcc
        })
      )
    } catch (e) {
      console.error('[decode]', e)
    }
  }

  private render(session: DecoderSession, frame: VideoFrame): void {
    const ctx = session.ctx
    if (!ctx) {
      frame.close()
      return
    }
    if (session.canvas.width !== frame.codedWidth || session.canvas.height !== frame.codedHeight) {
      session.canvas.width = frame.codedWidth
      session.canvas.height = frame.codedHeight
      session.onSize(frame.codedWidth, frame.codedHeight)
    }
    ctx.drawImage(frame, 0, 0)
    frame.close()
  }
}

export const videoManager = new VideoManager()
