import { defineStore } from 'pinia'
import type { DeviceInfo } from '@shared/types'

export type DeviceRuntimeState = 'idle' | 'starting' | 'running' | 'error'

export interface DeviceRuntime {
  info: DeviceInfo
  mirrorState: DeviceRuntimeState
  error: string
}

export const useDevicesStore = defineStore('devices', {
  state: () => ({
    devices: [] as DeviceRuntime[],
    serverState: 'disconnected' as 'connected' | 'disconnected',
    loading: false
  }),
  getters: {
    byId: (state) => (deviceId: string) => state.devices.find((d) => d.info.deviceId === deviceId),
    running: (state) => state.devices.filter((d) => d.mirrorState === 'running')
  },
  actions: {
    setDevices(list: DeviceInfo[]) {
      this.devices = list.map((info) => {
        const existing = this.devices.find((d) => d.info.deviceId === info.deviceId)
        return existing
          ? { ...existing, info }
          : { info, mirrorState: 'idle' as DeviceRuntimeState, error: '' }
      })
    },
    setMirrorState(deviceId: string, state: DeviceRuntimeState) {
      const d = this.byId(deviceId)
      if (d) d.mirrorState = state
    },
    setError(deviceId: string, msg: string) {
      const d = this.byId(deviceId)
      if (d) {
        d.mirrorState = 'error'
        d.error = msg
      }
    },
    setServerState(state: 'connected' | 'disconnected') {
      this.serverState = state
      if (state === 'disconnected') {
        // 服务器断开，清空设备
        this.devices = []
      }
    }
  }
})
