import { defineStore } from 'pinia'

/** 群控状态：开关 + 主控设备 id */
export const useControlStore = defineStore('control', {
  state: () => ({
    groupEnabled: false,
    masterId: '' as string
  }),
  getters: {
    isMaster: (state) => (deviceId: string) =>
      state.groupEnabled && state.masterId === deviceId,
    isFollower: (state) => (deviceId: string) =>
      state.groupEnabled && state.masterId !== '' && state.masterId !== deviceId,
    hasMaster: (state) => state.masterId !== ''
  },
  actions: {
    setMaster(deviceId: string) {
      this.masterId = deviceId
    },
    toggleGroup() {
      this.groupEnabled = !this.groupEnabled
      if (!this.groupEnabled) this.masterId = ''
    },
    disableGroup() {
      this.groupEnabled = false
      this.masterId = ''
    }
  }
})
