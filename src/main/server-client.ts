import WebSocket from 'ws'
import type { DeviceInfo, TouchMessage, ScrollMessage, KeyMessage } from '../shared/types'

export interface ServerClientCallbacks {
  onConnected: () => void
  onDisconnected: () => void
  onDevices: (devices: DeviceInfo[]) => void
  /** 收到视频帧：[1字节flags 的 keyframe 已解析] */
  onVideoData: (deviceId: string, annexb: Buffer, keyframe: boolean) => void
}

/**
 * 客户端到中心服务器的 WebSocket 连接：
 * 认证、查询设备、订阅设备、收视频帧、发控制指令。断线自动重连。
 */
export class ServerClient {
  private ws: WebSocket | null = null
  private host = ''
  private port = 0
  private token = ''
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor(private readonly cb: ServerClientCallbacks) {}

  connect(host: string, port: number, token: string): void {
    this.host = host
    this.port = port
    this.token = token
    this.open()
  }

  private open(): void {
    const ws = new WebSocket(`ws://${this.host}:${this.port}`)
    this.ws = ws

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: this.token }))
    })

    ws.on('message', (data, isBinary) => {
      if (isBinary) this.onBinary(data as Buffer)
      else this.onJson(data.toString())
    })

    ws.on('close', () => {
      this.cb.onDisconnected()
      // 3 秒后自动重连
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
      this.reconnectTimer = setTimeout(() => {
        if (this.ws === ws) this.open()
      }, 3000)
    })

    ws.on('error', () => {})
  }

  private onJson(text: string): void {
    let msg: any
    try {
      msg = JSON.parse(text)
    } catch {
      return
    }
    switch (msg.type) {
      case 'authed':
        this.cb.onConnected()
        break
      case 'devices':
        this.cb.onDevices(msg.devices || [])
        break
      case 'device-joined':
      case 'device-left':
        this.send({ type: 'list' })
        break
    }
  }

  private onBinary(data: Buffer): void {
    // 服务器转发格式：[2字节 deviceId长度][deviceId][1字节 flags][annexb]
    if (data.length < 4) return
    const idLen = data.readUInt16BE(0)
    if (data.length < 2 + idLen + 1) return
    const deviceId = data.subarray(2, 2 + idLen).toString('utf8')
    const flags = data[2 + idLen]
    const annexb = data.subarray(2 + idLen + 1)
    this.cb.onVideoData(deviceId, annexb, (flags & 1) === 1)
  }

  subscribe(deviceId: string): void {
    this.send({ type: 'subscribe', deviceId })
  }

  unsubscribe(deviceId: string): void {
    this.send({ type: 'unsubscribe', deviceId })
  }

  sendTouch(deviceId: string, msg: TouchMessage): void {
    this.sendControl(deviceId, { type: 'touch', ...msg })
  }

  sendScroll(deviceId: string, msg: ScrollMessage): void {
    this.sendControl(deviceId, { type: 'scroll', ...msg })
  }

  sendKey(deviceId: string, msg: KeyMessage): void {
    this.sendControl(deviceId, { type: 'key', ...msg })
  }

  sendText(deviceId: string, text: string): void {
    this.sendControl(deviceId, { type: 'text', text })
  }

  private sendControl(deviceId: string, msg: unknown): void {
    this.send({ type: 'control', deviceId, msg })
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.ws?.close()
    this.ws = null
  }

  private send(obj: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }
}
