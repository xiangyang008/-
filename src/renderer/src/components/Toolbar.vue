<script setup lang="ts">
import { ref } from 'vue'
import { VideoPlay, VideoPause, Link } from '@element-plus/icons-vue'
import { useDevice } from '../composables/useDevice'
import { useControlStore } from '../store/control'
import { useDevicesStore } from '../store/devices'

const { connectServer, disconnectServer, startAll, stopAll } = useDevice()
const devices = useDevicesStore()
const control = useControlStore()

const host = ref('')
const port = ref(8080)
const token = ref('multicontrol')

const connected = () => devices.serverState === 'connected'

function onConnect(): void {
  if (!host.value.trim()) return
  void connectServer(host.value.trim(), port.value, token.value)
}

function onDisconnect(): void {
  void disconnectServer()
}

function onGroupToggle(val: string | number | boolean): void {
  if (val) control.groupEnabled = true
  else control.disableGroup()
}
</script>

<template>
  <header class="toolbar">
    <div class="brand">
      <span class="logo">📱</span>
      <span class="title">MultiControl</span>
      <span class="sub">多控台</span>
    </div>

    <div class="server">
      <el-input v-model="host" placeholder="服务器 IP/域名" style="width: 170px" clearable />
      <el-input-number v-model="port" :min="1" :max="65535" controls-position="right" style="width: 110px" />
      <el-input v-model="token" placeholder="token" style="width: 120px" clearable />
      <el-button v-if="!connected()" type="primary" :icon="Link" @click="onConnect">连接</el-button>
      <el-button v-else :icon="Link" @click="onDisconnect">断开</el-button>
      <span class="state" :class="connected() ? 'on' : 'off'">
        {{ connected() ? '● 已连接' : '○ 未连接' }}
      </span>
    </div>

    <div class="tool-group">
      <el-button :icon="VideoPlay" @click="startAll">全部启动</el-button>
      <el-button :icon="VideoPause" @click="stopAll">全部停止</el-button>
    </div>

    <div class="spacer" />

    <el-switch
      :model-value="control.groupEnabled"
      active-text="群控"
      @change="onGroupToggle"
    />
    <el-select
      v-model="control.masterId"
      placeholder="选择主控"
      size="default"
      style="width: 170px"
      :disabled="!control.groupEnabled"
      clearable
    >
      <el-option
        v-for="d in devices.running"
        :key="d.info.deviceId"
        :label="d.info.name || d.info.deviceId"
        :value="d.info.deviceId"
      />
    </el-select>
  </header>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  background: var(--mc-bg-soft);
  border-bottom: 1px solid var(--mc-border);
  flex-wrap: wrap;
}
.brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}
.brand .logo {
  font-size: 18px;
}
.brand .title {
  font-size: 16px;
  font-weight: 700;
  color: var(--mc-text);
}
.brand .sub {
  font-size: 12px;
  color: var(--mc-text-dim);
}
.server {
  display: flex;
  align-items: center;
  gap: 6px;
}
.state {
  font-size: 12px;
  white-space: nowrap;
}
.state.on {
  color: var(--mc-success);
}
.state.off {
  color: var(--mc-text-dim);
}
.tool-group {
  display: flex;
}
.spacer {
  flex: 1;
}
</style>
