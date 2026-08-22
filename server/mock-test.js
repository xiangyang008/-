// 服务器冒烟测试：注册 → 登录 → 设备上线（带 token）→ 客户端控制
import { WebSocket } from 'ws'

const URL = 'ws://127.0.0.1:8080'
const TOKEN = 'multicontrol'
const results = {
  registered: false,
  loggedIn: false,
  deviceOnline: false,
  clientAuthed: false,
  startOk: false,
  frameOk: false,
  controlOk: false
}

// 1. 注册（临时连接）
function registerUser() {
  const ws = new WebSocket(URL)
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'register-user', username: 'testuser', password: 'testpass' }))
  })
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'register-user-ok') {
      results.registered = true
      console.log('[注册] 成功')
      login()
    }
    ws.close()
  })
}

// 2. 登录（临时连接）
function login() {
  const ws = new WebSocket(URL)
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'login', username: 'testuser', password: 'testpass' }))
  })
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'login-ok') {
      results.loggedIn = true
      console.log('[登录] 成功，token:', msg.token.slice(0, 8) + '...')
      deviceOnline(msg.token)
    }
    ws.close()
  })
}

// 3. 设备上线（长连接，带 token）
function deviceOnline(loginToken) {
  const ws = new WebSocket(URL)
  ws.on('open', () => {
    ws.send(
      JSON.stringify({
        type: 'register',
        deviceId: 'phone-001',
        name: '测试手机',
        loginToken,
        screenW: 1080,
        screenH: 2400,
        videoW: 720,
        videoH: 1600
      })
    )
  })
  ws.on('message', (data, isBinary) => {
    if (isBinary) return
    const msg = JSON.parse(data.toString())
    if (msg.type === 'registered') {
      results.deviceOnline = true
      console.log('[设备] 上线成功')
      clientAuth()
    }
    if (msg.type === 'start') {
      results.startOk = true
      console.log('[设备] 收到 start，推流 3 帧')
      for (let i = 0; i < 3; i++) {
        const flags = Buffer.from([i === 0 ? 1 : 0])
        const payload = Buffer.from([0, 0, 0, 1, 0x65, i, 0x10, 0x20])
        ws.send(Buffer.concat([flags, payload]), { binary: true })
      }
    }
    if (msg.type === 'touch') {
      results.controlOk = true
      console.log('[设备] 收到触摸指令')
    }
  })
}

// 4. 客户端（电脑）认证 + 订阅 + 控制
function clientAuth() {
  const ws = new WebSocket(URL)
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'auth', token: TOKEN }))
  })
  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      results.frameOk = true
      return
    }
    const msg = JSON.parse(data.toString())
    if (msg.type === 'authed') {
      results.clientAuthed = true
      console.log('[客户端] 认证成功')
    }
    if (msg.type === 'devices' && msg.devices.length === 1) {
      console.log('[客户端] 设备列表:', msg.devices[0].deviceId, '归属', msg.devices[0].username)
      ws.send(JSON.stringify({ type: 'subscribe', deviceId: 'phone-001' }))
      setTimeout(() => {
        ws.send(
          JSON.stringify({
            type: 'control',
            deviceId: 'phone-001',
            msg: { type: 'touch', action: 0, x: 0.5, y: 0.5 }
          })
        )
      }, 800)
    }
  })
}

registerUser()

setTimeout(() => {
  console.log('\n=== 测试结果 ===')
  console.log('用户注册   :', results.registered ? '✅' : '❌')
  console.log('用户登录   :', results.loggedIn ? '✅' : '❌')
  console.log('设备上线   :', results.deviceOnline ? '✅' : '❌')
  console.log('客户端认证 :', results.clientAuthed ? '✅' : '❌')
  console.log('订阅启推   :', results.startOk ? '✅' : '❌')
  console.log('视频转发   :', results.frameOk ? '✅' : '❌')
  console.log('控制路由   :', results.controlOk ? '✅' : '❌')
  const allOk = Object.values(results).every(Boolean)
  console.log(allOk ? '\n🎉 全部通过' : '\n❌ 有未通过项')
  process.exit(allOk ? 0 : 1)
}, 4000)
