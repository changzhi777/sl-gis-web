#!/usr/bin/env bash
# e2e.sh — 端到端验证（生产构建 → 起静态服务器 → 跑 playwright）
# 用于 CI 或部署前本地回归
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8765}"
BASE="http://127.0.0.1:$PORT/sl-gis/"

echo "=== 1. build ==="
pnpm build > /tmp/build.log 2>&1 || { tail -20 /tmp/build.log; exit 1; }
echo "✓ build ok"

echo "=== 2. 起静态服务器（dist 根） ==="
cd dist
python3 -m http.server "$PORT" > /tmp/server.log 2>&1 &
SERVER_PID=$!
cd ..
sleep 2

# 检查
HTTP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE")
if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ $BASE 返 $HTTP_STATUS，停止 server"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo "✓ $BASE 200"

cleanup() { kill $SERVER_PID 2>/dev/null || true; }
trap cleanup EXIT

echo "=== 3. playwright e2e ==="
BASE="$BASE" pnpm exec playwright test "$@"
echo "✓ e2e pass"
