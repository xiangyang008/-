// 直接连用户的香港服务器，测试注册/登录/设备上线全流程
import { WebSocket } from 'ws'

const URL = 'ws://47.82.122.186:8080'
const uname = 'test_' + Date.now()

function testRegister() {
  console.log('① 测试注册，用户名:', uname)
  const ws = new WebSocket(URL)
  const timer = setTimeout(() => { console.log('  ❌ 注册超时（服务器无响应）'); process.exit(1) }, 8000)
  ws.on('open', () => {
    console.log('  WebSocket 已连接')
    ws.send(JSON.stringify({ type: 'register-user', username: uname, password: '123456' }))
  })
  ws.on('message', (data) => {
    clearTimeout(timer)
    const msg = JSON.parse(data.toString())
    console.log('  收到:', JSON.stringify(msg))
    if (msg.type === 'register-user-ok') {
      testLogin()
    } else if (msg.type === 'register-user-error') {
      console.log('  ❌ 注册失败:', msg.error)
      process.exit(1)
    }
    ws.close()
  })
  ws.on('error', (e) => {
    clearTimeout(timer)
    console.log('  ❌ 连接失败:', e.message)
    console.log('  → 可能原因：服务器没运行 / 8080 端口没开放 / 服务器还是旧代码（没有注册功能）')
    process.exit(1)
  })
}

function testLogin() {
  console.log('② 测试登录')
  const ws = new WebSocket(URL)
  const timer = setTimeout(() => { console.log('  ❌ 登录超时'); process.exit(1) }, 8000)
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'login', username: uname, password: '123456' }))
  })
  ws.on('message', (data) => {
    clearTimeout(timer)
    const msg = JSON.parse(data.toString())
    console.log('  收到:', msg.type, msg.type === 'login-ok' ? 'token=' + String(msg.token).slice(0, 8) + '...' : msg.error || '')
    if (msg.type === 'login-ok') {
      testDevice(msg.token)
    } else {
      console.log('  ❌ 登录失败')
      process.exit(1)
    }
    ws.close()
  })
  ws.on('error', (e) => { clearTimeout(timer); console.log('  ❌ 连接失败:', e.message); process.exit(1) })
}

function testDevice(loginToken) {
  console.log('③ 测试设备上线（带 token）')
  const ws = new WebSocket(URL)
  const timer = setTimeout(() => { console.log('  ❌ 设备上线超时'); process.exit(1) }, 8000)
  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'register', deviceId: 'test-device', name: '测试机', loginToken,
      screenW: 1080, screenH: 2400, videoW: 720, videoH: 1600
    }))
  })
  ws.on('message', (data) => {
    clearTimeout(timer)
    const msg = JSON.parse(data.toString())
    console.log('  收到:', msg.type)
    if (msg.type === 'registered') {
      console.log('\n✅ 全流程测试通过：注册 → 登录 → 设备上线 都正常！')
      console.log('→ 说明服务器端完全正常，问题在手机 App 端（APK 没重新编译/没装新版/地址不对）')
      process.exit(0)
    } else {
      console.log('  ❌ 设备上线失败')
      process.exit(1)
    }
    ws.close()
  })
  ws.on('error', (e) => { clearTimeout(timer); console.log('  ❌ 连接失败:', e.message); process.exit(1) })
}

testRegister()
