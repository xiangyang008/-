// 多控台中心服务器：手机（设备）与电脑（客户端）之间的 WebSocket 中继 + 用户账号系统
//
// 连接角色：
//   - 设备（手机 App）：先 login 拿 token，再 register（带 token）上线
//   - 客户端（电脑）：{type:"auth", token:TOKEN} 认证（不用登录，看所有已登录设备）
//
// 数据流：
//   - 设备 → 二进制视频帧 → 转发给所有订阅该设备的客户端
//   - 客户端 → {type:"control", deviceId, msg} → 转发给目标设备
import { WebSocketServer, WebSocket } from 'ws'
import { randomBytes, createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8080)
const TOKEN = process.env.TOKEN || 'multicontrol'

// ===== 用户账号（users.json 持久化） =====
const USERS_FILE = join(__dirname, 'users.json')
let users = {}
if (existsSync(USERS_FILE)) {
  try {
    users = JSON.parse(readFileSync(USERS_FILE, 'utf-8'))
  } catch {
    users = {}
  }
}

function saveUsers() {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

function hashPassword(password, salt) {
  return createHash('sha256').update(salt + ':' + password).digest('hex')
}

// 登录会话：loginToken -> username
const sessions = new Map()

const wss = new WebSocketServer({ port: PORT })

// deviceId -> { ws, name, username, screenW, screenH, videoW, videoH }
const devices = new Map()
// 客户端 ws -> Set<deviceId>
const clientSubs = new Map()
// deviceId -> 订阅该设备的客户端数量
const deviceSubCount = new Map()

function sendJson(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
}

function broadcastToClients(obj) {
  for (const ws of clientSubs.keys()) sendJson(ws, obj)
}

function deviceListMessage() {
  return {
    type: 'devices',
    devices: [...devices.entries()].map(([deviceId, d]) => ({
      deviceId,
      name: d.name,
      username: d.username,
      screenW: d.screenW,
      screenH: d.screenH,
      videoW: d.videoW,
      videoH: d.videoH
    }))
  }
}

wss.on('connection', (ws) => {
  ws.role = null
  ws.deviceId = null

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      handleVideoFrame(ws, data)
    } else {
      let msg
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }
      handleMessage(ws, msg)
    }
  })

  ws.on('close', () => handleClose(ws))
  ws.on('error', () => {})
})

function handleMessage(ws, msg) {
  switch (msg.type) {
    // ===== 账号：注册 =====
    case 'register-user': {
      const username = String(msg.username || '').trim()
      const password = String(msg.password || '')
      if (!username || !password) {
        sendJson(ws, { type: 'register-user-error', error: '用户名和密码不能为空' })
        break
      }
      if (users[username]) {
        sendJson(ws, { type: 'register-user-error', error: '用户名已存在' })
        break
      }
      const salt = randomBytes(16).toString('hex')
      users[username] = { salt, hash: hashPassword(password, salt) }
      saveUsers()
      sendJson(ws, { type: 'register-user-ok' })
      break
    }

    // ===== 账号：登录 =====
    case 'login': {
      const username = String(msg.username || '').trim()
      const password = String(msg.password || '')
      const user = users[username]
      if (!user || user.hash !== hashPassword(password, user.salt)) {
        sendJson(ws, { type: 'login-error', error: '用户名或密码错误' })
        break
      }
      const loginToken = randomBytes(32).toString('hex')
      sessions.set(loginToken, username)
      sendJson(ws, { type: 'login-ok', token: loginToken, username })
      break
    }

    // ===== 设备上线（需带有效登录 token） =====
    case 'register': {
      const username = sessions.get(msg.loginToken)
      if (!username) {
        ws.close()
        break
      }
      ws.role = 'device'
      ws.deviceId = msg.deviceId
      devices.set(msg.deviceId, {
        ws,
        name: msg.name || msg.deviceId,
        username,
        screenW: msg.screenW || 0,
        screenH: msg.screenH || 0,
        videoW: msg.videoW || 0,
        videoH: msg.videoH || 0
      })
      sendJson(ws, { type: 'registered' })
      broadcastToClients({ type: 'device-joined', deviceId: msg.deviceId, name: msg.name })
      break
    }

    // ===== 客户端（电脑）认证 =====
    case 'auth': {
      if (msg.token !== TOKEN) {
        ws.close()
        break
      }
      ws.role = 'client'
      clientSubs.set(ws, new Set())
      sendJson(ws, { type: 'authed' })
      sendJson(ws, deviceListMessage())
      break
    }

    case 'list': {
      if (ws.role === 'client') sendJson(ws, deviceListMessage())
      break
    }

    case 'subscribe': {
      if (ws.role !== 'client') break
      const subs = clientSubs.get(ws)
      if (subs && !subs.has(msg.deviceId)) {
        subs.add(msg.deviceId)
        const count = (deviceSubCount.get(msg.deviceId) || 0) + 1
        deviceSubCount.set(msg.deviceId, count)
        if (count === 1) {
          const dev = devices.get(msg.deviceId)
          if (dev) sendJson(dev.ws, { type: 'start' })
        }
      }
      break
    }

    case 'unsubscribe': {
      if (ws.role !== 'client') break
      const subs = clientSubs.get(ws)
      if (subs && subs.has(msg.deviceId)) {
        subs.delete(msg.deviceId)
        const count = Math.max(0, (deviceSubCount.get(msg.deviceId) || 0) - 1)
        deviceSubCount.set(msg.deviceId, count)
        if (count === 0) {
          const dev = devices.get(msg.deviceId)
          if (dev) sendJson(dev.ws, { type: 'stop' })
        }
      }
      break
    }

    case 'control': {
      if (ws.role !== 'client') break
      const dev = devices.get(msg.deviceId)
      if (dev) sendJson(dev.ws, msg.msg)
      break
    }

    case 'ping': {
      break
    }
  }
}

function handleVideoFrame(ws, data) {
  if (ws.role !== 'device' || !ws.deviceId) return
  const deviceId = ws.deviceId
  const deviceIdBuf = Buffer.from(deviceId, 'utf8')
  const header = Buffer.alloc(2)
  header.writeUInt16BE(deviceIdBuf.length, 0)
  const packed = Buffer.concat([header, deviceIdBuf, data])
  for (const [clientWs, subs] of clientSubs.entries()) {
    if (subs.has(deviceId) && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(packed, { binary: true })
    }
  }
}

function handleClose(ws) {
  if (ws.role === 'device' && ws.deviceId) {
    devices.delete(ws.deviceId)
    deviceSubCount.delete(ws.deviceId)
    broadcastToClients({ type: 'device-left', deviceId: ws.deviceId })
  } else if (ws.role === 'client') {
    const subs = clientSubs.get(ws)
    if (subs) {
      for (const deviceId of subs) {
        const count = Math.max(0, (deviceSubCount.get(deviceId) || 0) - 1)
        deviceSubCount.set(deviceId, count)
        if (count === 0) {
          const dev = devices.get(deviceId)
          if (dev) sendJson(dev.ws, { type: 'stop' })
        }
      }
    }
    clientSubs.delete(ws)
  }
}

console.log(`[multicontrol-server] 监听 0.0.0.0:${PORT}，token=${TOKEN}`)
