<script setup lang="ts">
import DeviceCard from './DeviceCard.vue'
import { useDevicesStore } from '../store/devices'

const emit = defineEmits<{ focus: [deviceId: string] }>()
const devices = useDevicesStore()
</script>

<template>
  <div class="device-grid">
    <DeviceCard
      v-for="d in devices.devices"
      :key="d.info.deviceId"
      :device-id="d.info.deviceId"
      @focus="emit('focus', $event)"
    />
    <el-empty
      v-if="devices.devices.length === 0"
      :description="devices.serverState === 'connected' ? '暂无在线手机' : '请先连接服务器'"
    />
  </div>
</template>

<style scoped>
.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  padding: 16px;
  align-items: start;
  overflow-y: auto;
  height: 100%;
}
</style>
