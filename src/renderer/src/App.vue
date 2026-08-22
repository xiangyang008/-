<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Toolbar from './components/Toolbar.vue'
import DeviceGrid from './components/DeviceGrid.vue'
import FocusView from './components/FocusView.vue'
import { useDevicesStore } from './store/devices'
import { videoManager } from './core/video'

const devices = useDevicesStore()
const focusId = ref('')

onMounted(() => {
  window.mcApi.onServerState((state) => {
    devices.setServerState(state)
  })

  window.mcApi.onDevices((list) => {
    devices.setDevices(list)
  })

  window.mcApi.onVideoData((deviceId, annexb, keyframe) => {
    videoManager.onData(deviceId, annexb, keyframe)
  })

  window.mcApi.onVideoEnd((deviceId) => {
    videoManager.onEnd(deviceId)
  })

  window.mcApi.onMirrorState((deviceId, state) => {
    devices.setMirrorState(deviceId, state)
    if (state === 'idle' || state === 'error') videoManager.onEnd(deviceId)
  })
})
</script>

<template>
  <div class="app">
    <Toolbar />
    <main class="app-main">
      <FocusView
        v-if="focusId"
        :device-id="focusId"
        @close="focusId = ''"
        @switch="focusId = $event"
      />
      <DeviceGrid v-else @focus="focusId = $event" />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.app-main {
  flex: 1;
  min-height: 0;
}
</style>
