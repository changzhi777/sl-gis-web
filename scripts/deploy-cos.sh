#!/usr/bin/env bash
# deploy-cos.sh — 上传 dist/ 到腾讯云 COS sl-gis/ 前缀
# 凭证：环境变量 TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_APPID
# 依赖：pip install tccli（或 coscmd 任意）

set -euo pipefail

DIST_DIR="${DIST_DIR:-dist}"
BUCKET="${TENCENT_BUCKET:-sl-gis-static-$(echo $TENCENT_APPID)}"
REGION="${TENCENT_REGION:-ap-guangzhou}"
PREFIX="${TENCENT_PREFIX:-sl-gis/}"

# 凭证校验
: "${TENCENT_SECRET_ID:?set TENCENT_SECRET_ID}"
: "${TENCENT_SECRET_KEY:?set TENCENT_SECRET_KEY}"
: "${TENCENT_APPID:?set TENCENT_APPID}"

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ dist/ 不存在，先跑: pnpm build"
  exit 1
fi

echo "=== SL-GIS 部署到 COS ==="
echo "Bucket:  $BUCKET"
echo "Region:  $REGION"
echo "Prefix:  $PREFIX"
echo "Source:  $DIST_DIR/"
echo ""

# 同步（会清空 sl-gis/ 前缀的旧文件）
echo "→ 同步上传（清旧 + 传新）..."
tccli cos syncupload \
  --bucket "$BUCKET-$TENCENT_APPID" \
  --region "$REGION" \
  --local-path "$DIST_DIR/" \
  --cos-path "/$PREFIX" \
  --delete 2>&1 | tail -20

echo ""
echo "✓ 上传完成"
echo ""
echo "=== 部署后验证（用户/agent 在真浏览器中）==="
echo "1. COS 控制台 → bucket → 文件管理 → 确认 $PREFIX 下有 index.html / assets/"
echo "2. 静态网站开关：COS 控制台 → 基础配置 → 静态网站 → 开启（已开启则跳过）"
echo "3. 错误文档：COS 静态网站 → 设置 index.html（解决 SPA 路由刷新 404）"
echo "4. CDN：绑定 nanoai.fun / 启用 HTTPS / 路径 /sl-gis/* 回源到该 bucket"
echo "5. 访问 https://nanoai.fun/sl-gis/ 验证"
