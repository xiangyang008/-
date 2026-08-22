#!/usr/bin/env bash
# 中心服务器一键部署脚本（在公网云服务器上执行一次即可）
# 用法：TOKEN=你的密钥 PORT=8080 ./deploy.sh
set -e
cd "$(dirname "$0")"

export TOKEN="${TOKEN:-multicontrol}"
export PORT="${PORT:-8080}"

if command -v docker >/dev/null 2>&1; then
  echo "▶ 用 Docker 部署..."
  docker build -t multicontrol-server .
  docker rm -f multicontrol-server 2>/dev/null || true
  docker run -d --name multicontrol-server --restart unless-stopped \
    -p "$PORT":8080 -e TOKEN="$TOKEN" multicontrol-server
  echo "✅ 服务器已启动（Docker），端口 $PORT，token $TOKEN"
else
  echo "▶ 未检测到 Docker，改用 Node 直接运行..."
  npm install --omit=dev
  nohup env PORT="$PORT" TOKEN="$TOKEN" node index.js > server.log 2>&1 &
  echo "✅ 服务器已启动（Node），端口 $PORT，token $TOKEN"
  echo "   查看日志：tail -f server.log"
fi

echo "   请确认云服务器安全组/防火墙已放行 TCP $PORT 端口。"
