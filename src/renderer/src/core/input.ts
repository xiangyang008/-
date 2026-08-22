/**
 * 将 canvas 上的客户端坐标换算为归一化坐标（0~1）。
 * 手机端收到后乘以自身屏幕分辨率，天然适配不同分辨率设备。
 */
export function canvasToNormalized(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
  const x = (clientX - rect.left) / rect.width
  const y = (clientY - rect.top) / rect.height
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
