<script setup lang="ts">
import { computed } from 'vue'
import DeviceScreen from './DeviceScreen.vue'
import { useDevicesStore } from '../store/devices'
import { useControlStore } from '../store/control'
import { useDevice } from '../composables/useDevice'

const props = defineProps<{ deviceId: string }>()
const emit = defineEmits<{ focus: [deviceId: string] }>()

const devices = useDevicesStore()
const control = useControlStore()
const { startMirror, stopMirror } = useDevice()

const device = computed(() => devices.byId(props.deviceId))
const isMaster = computed(() => control.isMaster(props.deviceId))
const isFollower = computed(() => control.isFollower(props.deviceId))
const running = computed(() => device.value?.mirrorState === 'running')

function toggleMirror(): void {
  if (!device.value) return
  if (running.value) void stopMirror(props.deviceId)
  else void startMirror(props.deviceId)
}

function setMaster(): void {
  control.setMaster(props.deviceId)
}
</script>

<template>
  <div v-if="device" class="device-card" :class="{ master: isMaster, follower: isFollower }">
    <div class="screen-wrap" @dblclick="emit('focus', deviceId)">
      <DeviceScreen :device-id="deviceId" :interactive="!isFollower" />

      <div class="overlay-top">
        <span class="name">{{ device.info.name || device.info.deviceId }}</span>
        <span v-if="isMaster" class="badge master-badge">主控</span>
        <span v-else-if="isFollower" class="badge follower-badge">跟随</span>
      </div>

      <div v-if="!running" class="placeholder" @click="toggleMirror">
        <el-button v-if="device.mirrorState === 'idle'" type="primary" round>
          启动镜像
        </el-button>
        <template v-else-if="device.mirrorState === 'starting'">
          <el-icon class="is-loading" :size="22"><Loading /></el-icon>
          <span class="hint">连接中…</span>
        </template>
        <div v-else-if="device.mirrorState === 'error'" class="error-box">
          <span class="error-text">{{ device.error || '启动失败' }}</span>
        </div>
      </div>

      <div v-if="isFollower" class="lock-overlay">🔒</div>
    </div>

    <div class="status-bar">
      <span class="status-item">{{ device.info.screenW }}×{{ device.info.screenH }}</span>
      <span class="status-item dim">{{ device.info.videoW }}p 视频</span>
      <span class="spacer" />
      <el-button size="small" text @click="toggleMirror">
        {{ running ? '停止' : '启动' }}
      </el-button>
      <el-button size="small" text :type="isMaster ? 'warning' : 'default'" @click="setMaster">
        主控
      </el-button>
      <el-button size="small" text @click="emit('focus', deviceId)">放大</el-button>
    </div>
  </div>
</template>

<style scoped>
.device-card {
  display: flex;
  flex-direction: column;
  background: var(--mc-card);
  border: 1px solid var(--mc-border);
  border-radius: 10px;
  overflow: hidden;
  transition:
    border-color 0.15s,
    transform 0.15s;
}
.device-card:hover {
  border-color: #3d4752;
}
.device-card.master {
  border-color: var(--mc-master);
  box-shadow: 0 0 0 1px var(--mc-master), 0 0 18px -6px var(--mc-master);
}
.device-card.follower {
  border-color: var(--mc-follower);
}

.screen-wrap {
  position: relative;
  flex: 1;
  aspect-ratio: 9 / 16;
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.72), transparent);
  pointer-events: none;
}
.overlay-top .name {
  font-size: 12px;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.badge {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 999px;
  color: #fff;
  line-height: 16px;
}
.master-badge {
  background: var(--mc-master);
}
.follower-badge {
  background: var(--mc-follower);
}

.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(15, 20, 25, 0.55);
  cursor: pointer;
}
.placeholder .hint {
  font-size: 12px;
  color: var(--mc-text-dim);
}
.error-box {
  max-width: 80%;
  text-align: center;
}
.error-text {
  font-size: 12px;
  color: var(--mc-danger);
  word-break: break-all;
}

.lock-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  background: rgba(59, 130, 246, 0.12);
  pointer-events: none;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-top: 1px solid var(--mc-border);
  font-size: 11px;
  color: var(--mc-text);
}
.status-item {
  white-space: nowrap;
}
.status-item.dim {
  color: var(--mc-text-dim);
}
.status-bar .spacer {
  flex: 1;
}
</style>
