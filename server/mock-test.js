// 服务器冒烟测试：客户端先认证，再让设备上线，验证完整消息路由
// 用法：先启动 index.js，再运行 node mock-test.js
import { WebSocket } from 'ws'

const URL = 'ws://127.0.0.1:8080'
const TOKEN = 'multicontrol'
const results = { deviceJoined: false, authed: false, listOk: false, startOk: false, frameOk: false, controlOk: false }

let device

// 客户端（电脑）先连接
const client = new WebSocket(URL)
client.on('open', () => {
  console.log('[客户端] 已连接，发送 auth')
  client.send(JSON.stringify({ type: 'auth', token: TOKEN }))
})
client.on('message', (data, isBinary) => {
  if (isBinary) {
    results.frameOk = true
    console.log('[客户端] 收到视频帧，长度', data.length)
    return
  }
  const msg = JSON.parse(data.toString())
  console.log('[客户端] 收到:', msg.type)
  if (msg.type === 'authed') {
    results.authed = true
    createDevice() // 认证通过后再让设备上线
  }
  if (msg.type === 'devices' && msg.devices.length === 1) results.listOk = true
  if (msg.type === 'device-joined') {
    results.deviceJoined = true
    client.send(JSON.stringify({ type: 'list' })) // 设备上线后再查一次，此时列表应含 1 台
    client.send(JSON.stringify({ type: 'subscribe', deviceId: 'phone-001' }))
    setTimeout(() => {
      client.send(
        JSON.stringify({
          type: 'control',
          deviceId: 'phone-001',
          msg: { type: 'touch', action: 0, x: 0.5, y: 0.5 }
        })
      )
    }, 600)
  }
})

function createDevice() {
  device = new WebSocket(URL)
  device.on('open', () => {
    console.log('[设备] 已连接，发送 register')
    device.send(
      JSON.stringify({
        type: 'register',
        deviceId: 'phone-001',
        name: '测试手机',
        token: TOKEN,
        screenW: 1080,
        screenH: 2400,
        videoW: 720,
        videoH: 1600
      })
    )
  })
  device.on('message', (data, isBinary) => {
    if (isBinary) return
    const msg = JSON.parse(data.toString())
    console.log('[设备] 收到:', msg.type)
    if (msg.type === 'start') {
      results.startOk = true
      console.log('[设备] 收到 start，开始推流（3 帧）')
      for (let i = 0; i < 3; i++) {
        const flags = Buffer.from([i === 0 ? 1 : 0])
        const payload = Buffer.from([0, 0, 0, 1, 0x65, i, 0x10, 0x20])
        device.send(Buffer.concat([flags, payload]), { binary: true })
      }
    }
    if (msg.type === 'touch') {
      results.controlOk = true
      console.log('[设备] 收到触摸指令:', msg.action, msg.x, msg.y)
    }
  })
}

setTimeout(() => {
  console.log('\n=== 测试结果 ===')
  console.log('设备上线广播   :', results.deviceJoined ? '✅' : '❌')
  console.log('客户端认证     :', results.authed ? '✅' : '❌')
  console.log('设备列表下发   :', results.listOk ? '✅' : '❌')
  console.log('订阅→设备启推  :', results.startOk ? '✅' : '❌')
  console.log('视频帧转发     :', results.frameOk ? '✅' : '❌')
  console.log('控制指令路由   :', results.controlOk ? '✅' : '❌')
  const allOk = Object.values(results).every(Boolean)
  console.log(allOk ? '\n🎉 全部通过' : '\n❌ 有未通过项')
  process.exit(allOk ? 0 : 1)
}, 3500)
