// 主进程与渲染进程共享的 IPC 契约类型（App 化异地控制版）

/** 一台远程设备（手机）的信息，由服务器下发 */
export interface DeviceInfo {
  deviceId: string
  name: string
  screenW: number
  screenH: number
  videoW: number
  videoH: number
}

/** 视频流元数据（首帧前推送，用于创建解码器） */
export interface VideoMeta {
  deviceId: string
  width: number
  height: number
  /** avcC description（SPS/PPS 构建），base64 或 Uint8Array */
  description: Uint8Array
}

/** 触摸注入消息（坐标为归一化 0~1，手机端乘屏幕分辨率） */
export interface TouchMessage {
  /** 0=Down, 1=Up, 2=Move */
  action: number
  x: number
  y: number
}

/** 滚轮/滚动注入消息 */
export interface ScrollMessage {
  x: number
  y: number
  scrollX: number
  scrollY: number
}

/** 按键消息（AndroidKeyCode：3=HOME, 4=BACK, 187=RECENTS） */
export interface KeyMessage {
  keyCode: number
}

export type MirrorState = 'idle' | 'starting' | 'running' | 'error'
