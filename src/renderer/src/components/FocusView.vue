<script setup lang="ts">
import { computed } from 'vue'
import { Back } from '@element-plus/icons-vue'
import DeviceScreen from './DeviceScreen.vue'
import { useDevicesStore } from '../store/devices'
import { useControlStore } from '../store/control'

const props = defineProps<{ deviceId: string }>()
const emit = defineEmits<{ close: []; switch: [deviceId: string] }>()

const devices = useDevicesStore()
const control = useControlStore()

const current = computed(() => devices.byId(props.deviceId))
const running = computed(() => devices.running)
const isFollower = computed(() => control.isFollower(props.deviceId))

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <div class="focus-view" tabindex="0" @keydown="onKey">
    <div class="focus-main">
      <DeviceScreen :device-id="deviceId" :interactive="!isFollower" />
      <div class="focus-title">
        <span>{{ current?.info.name || deviceId }}</span>
        <span v-if="control.isMaster(deviceId)" class="badge master-badge">主控</span>
        <span v-else-if="isFollower" class="badge follower-badge">跟随</span>
      </div>
    </div>

    <div class="focus-side">
      <div class="side-head">设备列表</div>
      <div class="thumbs">
        <div
          v-for="d in running"
          :key="d.info.deviceId"
          class="thumb"
          :class="{ active: d.info.deviceId === deviceId }"
          @click="emit('switch', d.info.deviceId)"
        >
          <span class="thumb-name">{{ d.info.name || d.info.deviceId }}</span>
          <span class="thumb-res">{{ d.info.screenW }}×{{ d.info.screenH }}</span>
        </div>
      </div>
      <el-button class="back-btn" :icon="Back" @click="emit('close')">返回网格</el-button>
    </div>
  </div>
</template>

<style scoped>
.focus-view {
  display: flex;
  height: 100%;
  padding: 16px;
  gap: 16px;
  outline: none;
}
.focus-main {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
}
.focus-title {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.72), transparent);
  color: #fff;
  font-size: 14px;
  pointer-events: none;
}
.badge {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 999px;
  color: #fff;
}
.master-badge {
  background: var(--mc-master);
}
.follower-badge {
  background: var(--mc-follower);
}

.focus-side {
  display: flex;
  flex-direction: column;
  width: 240px;
  gap: 10px;
}
.side-head {
  font-size: 13px;
  color: var(--mc-text-dim);
}
.thumbs {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.thumb {
  padding: 10px 12px;
  background: var(--mc-card);
  border: 1px solid var(--mc-border);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: border-color 0.15s;
}
.thumb:hover {
  border-color: #3d4752;
}
.thumb.active {
  border-color: var(--mc-primary);
}
.thumb-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.thumb-res {
  font-size: 11px;
  color: var(--mc-text-dim);
}
.back-btn {
  width: 100%;
}
</style>
