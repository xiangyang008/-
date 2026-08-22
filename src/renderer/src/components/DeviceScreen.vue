<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { videoManager } from '../core/video'
import { canvasToNormalized } from '../core/input'
import { useControlStore } from '../store/control'
import { useGroupControl } from '../composables/useGroupControl'

const props = defineProps<{
  deviceId: string
  /** 是否接受输入（群控跟随设备为只读） */
  interactive?: boolean
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const control = useControlStore()
const { broadcastTouch, broadcastScroll } = useGroupControl()

let touching = false

function sendTouch(action: number, clientX: number, clientY: number): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const { x, y } = canvasToNormalized(clientX, clientY, canvas)
  const msg = { action, x, y }
  window.mcApi.injectTouch(props.deviceId, msg)
  if (control.isMaster(props.deviceId)) broadcastTouch(msg)
}

function onPointerDown(e: PointerEvent): void {
  if (props.interactive === false) return
  touching = true
  canvasRef.value?.setPointerCapture?.(e.pointerId)
  sendTouch(0, e.clientX, e.clientY)
}

function onPointerMove(e: PointerEvent): void {
  if (!touching) return
  sendTouch(2, e.clientX, e.clientY)
}

function onPointerUp(e: PointerEvent): void {
  if (!touching) return
  touching = false
  sendTouch(1, e.clientX, e.clientY)
}

function onWheel(e: WheelEvent): void {
  if (props.interactive === false) return
  const canvas = canvasRef.value
  if (!canvas) return
  const { x, y } = canvasToNormalized(e.clientX, e.clientY, canvas)
  const msg = { x, y, scrollX: e.deltaX / 100, scrollY: e.deltaY / 100 }
  window.mcApi.injectScroll(props.deviceId, msg)
  if (control.isMaster(props.deviceId)) broadcastScroll(msg)
}

onMounted(() => {
  const canvas = canvasRef.value
  if (canvas) videoManager.registerCanvas(props.deviceId, canvas, () => {})
})

onBeforeUnmount(() => {
  videoManager.unregisterCanvas(props.deviceId)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="device-screen"
    :class="{ locked: interactive === false }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel.prevent="onWheel"
    @contextmenu.prevent
  />
</template>

<style scoped>
.device-screen {
  width: 100%;
  height: 100%;
  object-fit: contain;
  touch-action: none;
  cursor: crosshair;
  background: #000;
}
.device-screen.locked {
  cursor: not-allowed;
}
</style>
