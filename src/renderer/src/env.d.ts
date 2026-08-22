/// <reference types="vite/client" />

import type { DeviceInfo, MirrorState } from '@shared/types'

declare global {
  interface Window {
    mcApi: {
      connectServer(host: string, port: number, token: string): Promise<void>
      disconnectServer(): Promise<void>
      startMirror(deviceId: string): Promise<void>
      stopMirror(deviceId: string): Promise<void>
      injectTouch(deviceId: string, msg: unknown): void
      injectScroll(deviceId: string, msg: unknown): void
      injectKey(deviceId: string, msg: unknown): void
      injectText(deviceId: string, text: string): void
      onServerState(cb: (state: 'connected' | 'disconnected') => void): void
      onDevices(cb: (devices: DeviceInfo[]) => void): void
      onVideoData(cb: (deviceId: string, annexb: Uint8Array, keyframe: boolean) => void): void
      onVideoEnd(cb: (deviceId: string) => void): void
      onMirrorState(cb: (deviceId: string, state: MirrorState) => void): void
    }
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<{}, {}, any>
  export default component
}

export {}
