import { useDevicesStore } from '../store/devices'

export function useDevice() {
  const store = useDevicesStore()

  async function connectServer(host: string, port: number, token: string): Promise<void> {
    await window.mcApi.connectServer(host, port, token)
  }

  async function disconnectServer(): Promise<void> {
    await window.mcApi.disconnectServer()
  }

  async function startMirror(deviceId: string): Promise<void> {
    store.setMirrorState(deviceId, 'starting')
    try {
      await window.mcApi.startMirror(deviceId)
    } catch (e) {
      store.setError(deviceId, e instanceof Error ? e.message : String(e))
    }
  }

  async function stopMirror(deviceId: string): Promise<void> {
    await window.mcApi.stopMirror(deviceId)
    store.setMirrorState(deviceId, 'idle')
  }

  async function startAll(): Promise<void> {
    for (const d of store.devices) {
      if (d.mirrorState !== 'running') void startMirror(d.info.deviceId)
    }
  }

  async function stopAll(): Promise<void> {
    for (const d of store.devices) {
      if (d.mirrorState === 'running') void stopMirror(d.info.deviceId)
    }
  }

  return { store, connectServer, disconnectServer, startMirror, stopMirror, startAll, stopAll }
}
