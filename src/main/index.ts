import { app, BrowserWindow, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ServerClient } from './server-client'
import type { TouchMessage, ScrollMessage, KeyMessage } from '../shared/types'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let serverClient: ServerClient | null = null
const subscribed = new Set<string>() // 正在镜像（已订阅）的设备

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'MultiControl 多控台',
    backgroundColor: '#0f1419',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // F12 打开开发者工具（方便调试视频黑屏等）
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('server:connect', (_e, host: string, port: number, token: string) => {
    if (serverClient) serverClient.disconnect()
    serverClient = new ServerClient({
      onConnected: () => mainWindow?.webContents.send('server:state', 'connected'),
      onDisconnected: () => mainWindow?.webContents.send('server:state', 'disconnected'),
      onDevices: (devices) => mainWindow?.webContents.send('devices:update', devices),
      onVideoData: (deviceId, annexb, keyframe) =>
        mainWindow?.webContents.send('video:data', deviceId, annexb, keyframe)
    })
    serverClient.connect(host, port, token)
  })

  ipcMain.handle('server:disconnect', () => {
    serverClient?.disconnect()
    serverClient = null
    mainWindow?.webContents.send('server:state', 'disconnected')
  })

  ipcMain.handle('mirror:start', (_e, deviceId: string) => {
    if (!subscribed.has(deviceId)) {
      subscribed.add(deviceId)
      serverClient?.subscribe(deviceId)
    }
    mainWindow?.webContents.send('mirror:state', deviceId, 'running')
  })

  ipcMain.handle('mirror:stop', (_e, deviceId: string) => {
    if (subscribed.has(deviceId)) {
      subscribed.delete(deviceId)
      serverClient?.unsubscribe(deviceId)
    }
    mainWindow?.webContents.send('mirror:state', deviceId, 'idle')
    mainWindow?.webContents.send('video:end', deviceId)
  })

  ipcMain.on('input:touch', (_e, deviceId: string, msg: TouchMessage) => {
    serverClient?.sendTouch(deviceId, msg)
  })
  ipcMain.on('input:scroll', (_e, deviceId: string, msg: ScrollMessage) => {
    serverClient?.sendScroll(deviceId, msg)
  })
  ipcMain.on('input:key', (_e, deviceId: string, msg: KeyMessage) => {
    serverClient?.sendKey(deviceId, msg)
  })
  ipcMain.on('input:text', (_e, deviceId: string, text: string) => {
    serverClient?.sendText(deviceId, text)
  })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  serverClient?.disconnect()
  if (process.platform !== 'darwin') app.quit()
})
