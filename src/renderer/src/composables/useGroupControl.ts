import { useDevicesStore } from '../store/devices'
import { useControlStore } from '../store/control'
import type { TouchMessage, ScrollMessage } from '@shared/types'

/**
 * 群控广播：主控输入直接复制给所有跟随设备。
 * 坐标是归一化（0~1），与设备分辨率无关，天然适配不同尺寸屏幕。
 */
export function useGroupControl() {
  const devices = useDevicesStore()
  const control = useControlStore()

  function followers(): string[] {
    if (!control.groupEnabled || !control.masterId) return []
    return devices.devices
      .filter((d) => d.info.deviceId !== control.masterId && d.mirrorState === 'running')
      .map((d) => d.info.deviceId)
  }

  function broadcastTouch(msg: TouchMessage): void {
    for (const deviceId of followers()) {
      window.mcApi.injectTouch(deviceId, msg)
    }
  }

  function broadcastScroll(msg: ScrollMessage): void {
    for (const deviceId of followers()) {
      window.mcApi.injectScroll(deviceId, msg)
    }
  }

  return { followers, broadcastTouch, broadcastScroll }
}
