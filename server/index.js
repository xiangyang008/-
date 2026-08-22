// 多控台中心服务器：手机（设备）与电脑（客户端）之间的 WebSocket 中继
//
// 连接角色：
//   - 设备（手机 App）：首个消息 {type:"register", deviceId, name, ...}
//   - 客户端（电脑）：首个消息 {type:"auth", token}
//
// 数据流：
//   - 设备 → 二进制视频帧 → 转发给所有订阅该设备的客户端
//   - 客户端 → {type:"control", deviceId, msg} → 转发给目标设备
import { WebSocketServer, WebSocket } from 'ws'

const PORT = Number(process.env.PORT || 8080)
const TOKEN = process.env.TOKEN || 'multicontrol'

const wss = new WebSocketServer({ port: PORT })

// deviceId -> { ws, name, screenW, screenH, videoW, videoH }
const devices = new Map()
// 客户端 ws -> Set<deviceId>
const clientSubs = new Map()
// deviceId -> 订阅该设备的客户端数量（用于启停推流）
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
    case 'register': {
      // 设备也验证 token（与客户端 auth 一致）
      if (msg.token !== TOKEN) {
        ws.close()
        break
      }
      ws.role = 'device'
      ws.deviceId = msg.deviceId
      devices.set(msg.deviceId, {
        ws,
        name: msg.name || msg.deviceId,
        screenW: msg.screenW || 0,
        screenH: msg.screenH || 0,
        videoW: msg.videoW || 0,
        videoH: msg.videoH || 0
      })
      sendJson(ws, { type: 'registered' })
      broadcastToClients({ type: 'device-joined', deviceId: msg.deviceId, name: msg.name })
      break
    }
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
      // 设备心跳，忽略
      break
    }
  }
}

function handleVideoFrame(ws, data) {
  if (ws.role !== 'device' || !ws.deviceId) return
  const deviceId = ws.deviceId
  // 转发给客户端时加 deviceId 头：[2字节 deviceId长度][deviceId][原始帧]
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
    // 清理该客户端的订阅计数
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
