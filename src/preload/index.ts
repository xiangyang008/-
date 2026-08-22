import { contextBridge, ipcRenderer } from 'electron'
import type { DeviceInfo, MirrorState } from '../shared/types'

const api = {
  // 服务器连接
  connectServer: (host: string, port: number, token: string): Promise<void> =>
    ipcRenderer.invoke('server:connect', host, port, token),
  disconnectServer: (): Promise<void> => ipcRenderer.invoke('server:disconnect'),

  // 镜像（订阅/退订设备视频）
  startMirror: (deviceId: string): Promise<void> => ipcRenderer.invoke('mirror:start', deviceId),
  stopMirror: (deviceId: string): Promise<void> => ipcRenderer.invoke('mirror:stop', deviceId),

  // 输入注入（归一化坐标）
  injectTouch: (deviceId: string, msg: unknown): void =>
    ipcRenderer.send('input:touch', deviceId, msg),
  injectScroll: (deviceId: string, msg: unknown): void =>
    ipcRenderer.send('input:scroll', deviceId, msg),
  injectKey: (deviceId: string, msg: unknown): void =>
    ipcRenderer.send('input:key', deviceId, msg),
  injectText: (deviceId: string, text: string): void =>
    ipcRenderer.send('input:text', deviceId, text),

  // 主进程 → 渲染进程 事件
  onServerState: (cb: (state: 'connected' | 'disconnected') => void): void => {
    ipcRenderer.on('server:state', (_e, state) => cb(state))
  },
  onDevices: (cb: (devices: DeviceInfo[]) => void): void => {
    ipcRenderer.on('devices:update', (_e, devices) => cb(devices))
  },
  onVideoData: (cb: (deviceId: string, annexb: Uint8Array, keyframe: boolean) => void): void => {
    ipcRenderer.on('video:data', (_e, deviceId, annexb, keyframe) =>
      cb(deviceId, annexb, keyframe)
    )
  },
  onVideoEnd: (cb: (deviceId: string) => void): void => {
    ipcRenderer.on('video:end', (_e, deviceId) => cb(deviceId))
  },
  onMirrorState: (cb: (deviceId: string, state: MirrorState) => void): void => {
    ipcRenderer.on('mirror:state', (_e, deviceId, state) => cb(deviceId, state))
  }
}

contextBridge.exposeInMainWorld('mcApi', api)

export type McApi = typeof api
