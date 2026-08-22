# MultiControl 多控台（App 化异地版）

在电脑上同时控制**多台分布在各地的 Android 手机**：同屏平铺 + 独立操控 + 一键同步群控。

**无需 root、无需公网 IP、无需配置隧道**。手机装一个 App，电脑装一个客户端，中间一台服务器中转，装好就能用。

## 架构

```
各地手机(装 App) ──WebSocket──► 中心服务器 ◄──WebSocket── 电脑客户端
  录屏+H.264编码                   设备路由                    多路解码显示
  无障碍注入(开一次权限)           信令+媒体中继               输入+群控广播
```

- 手机 App 主动连服务器（手机在 NAT 后也无需公网 IP）
- 视频：手机 H.264 编码 → 服务器转发 → 电脑 WebCodecs 硬解
- 控制：电脑发归一化坐标 → 服务器转发 → 手机无障碍 `dispatchGesture` 注入

## 三步上手

### 第 1 步：部署服务器（一次，约 2 分钟）

在公网云服务器（阿里云/腾讯云轻量即可）上：

```bash
# 上传 server/ 目录后执行
cd server
TOKEN=你的密钥 ./deploy.sh      # 一条命令，Docker 或 Node 自动选择
```

记下服务器 IP、端口（默认 8080）、token。**在云服务器安全组放行 TCP 8080 端口。**

### 第 2 步：手机装 App（每台一次，约 2 分钟）

1. **先配置服务器地址**：打开 `android-app/app/src/main/java/com/multicontrol/agent/Config.kt`，把 `SERVER_HOST` 改成你的服务器地址（如 `1.2.3.4:8080`），再编译 APK
2. 编译 APK（见下方「App 编译」），发到每台手机安装
3. 打开「多控助手」App → 输入**用户名和密码** → 点「**注册新账号**」→ 注册成功后再点「**登录**」
4. 登录成功后 → 允许录屏
5. 点「**开启无障碍权限**」→ 在系统设置里打开「多控助手」的无障碍开关
6. 完成。手机屏幕显示「已连接」，即可放一边

> 账号说明：每台手机的用户可以**自行注册任意账号**，登录后手机才上线、才能被电脑控制；未登录的手机不会出现在电脑端。账号数据保存在服务器的 `users.json`。

### 第 3 步：电脑装客户端

```bash
cd multi-control
npm install
npm run dev        # 开发运行；打包见下文
```

打开后顶部填**服务器地址 + 端口 + token**，点「连接」，自动看到所有在线手机 → 启动镜像 → 同屏控制 + 群控。

## App 编译（二选一）

**方式 A —— GitHub 自动编译（推荐，不用装开发环境）**
1. 把整个 `multi-control` 目录推到 GitHub 仓库
2. GitHub Actions 自动编译（`android-app/.github/workflows/build-apk.yml` 已配好）
3. 到仓库的 Actions 页下载 `multi-control-agent-apk` 产物

**方式 B —— 本地 Android Studio**
1. 用 Android Studio 打开 `android-app/` 目录
2. 菜单 Build → Build APK(s)，或执行 `./gradlew assembleDebug`
3. 产物在 `app/build/outputs/apk/`

## 使用说明

- **同屏平铺**：所有在线手机画面网格显示，WebCodecs 硬解低延迟
- **独立操控**：点哪台控哪台（点击/滑动/滚轮）
- **同步群控**：顶部开「群控」→ 选主控 → 主控操作同步到所有跟随设备（金色边框=主控，蓝色=跟随）
- **聚焦模式**：双击某台放大，`Esc` 返回
- **主控按键**：群控时按 Home/Back 等键可同步到所有设备（客户端预留，手机端支持 HOME/BACK/RECENTS）

## 群控坐标原理

电脑发送**归一化坐标（0~1）**，各手机按自身屏幕分辨率换算，因此不同分辨率/不同屏幕比例的手机，点击位置也能保持一致。

## 项目结构

```
multi-control/
├── src/                        # 电脑客户端（Electron + Vue3 + WebCodecs）
│   ├── main/                   #   主进程：server-client(WebSocket) + IPC
│   ├── preload/                #   contextBridge API
│   └── renderer/               #   Vue 组件 + h264 解析 + 解码渲染 + 群控
├── server/                     # 中心服务器（Node.js + ws）
│   ├── index.js                #   设备路由 + 视频帧/指令转发
│   └── deploy.sh               #   一键部署
└── android-app/                # 手机 App（Kotlin）
    ├── app/src/main/java/com/multicontrol/agent/
    │   ├── MainActivity.kt     #   引导权限 + 填服务器地址
    │   ├── ControlService.kt   #   前台服务总控
    │   ├── ScreenCapture.kt    #   MediaProjection + MediaCodec H.264
    │   ├── AccessibilityService.kt  # dispatchGesture 注入
    │   └── NetClient.kt        #   WebSocket 客户端
    └── .github/workflows/      #   GitHub Actions 自动编译 APK
```

## 常见问题

- **电脑看不到手机**：确认手机 App「服务运行中」、token 一致、服务器 8080 端口已放行。
- **画面黑屏/卡顿**：异地延迟属物理限制。卡顿时把 `ScreenCapture.kt` 里的 `KEY_BIT_RATE` 降到 1_000_000、`KEY_FRAME_RATE` 降到 10。
- **点按没反应**：确认手机「无障碍」里「多控助手」开关已打开（系统强制，每次只能手动开）。
- **带宽**：默认每路约 1~2 Mbps，10 台约 10~20 Mbps，请确保服务器带宽足够。

## 安全

- 服务器与手机/客户端之间用同一 `token` 鉴权（设备与客户端都验证）
- 生产环境请把 token 换成强随机串，并用防火墙限制服务器 8080 端口只允许你的 IP 访问
