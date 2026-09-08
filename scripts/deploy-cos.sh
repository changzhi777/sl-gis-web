#!/usr/bin/env bash
# deploy-cos.sh — 上传 dist/ 到腾讯云 COS sl-gis/ 前缀
#
# 两种模式：
#   1) DRY_RUN=1 — 不连腾讯云，cp 到 LOCAL_DEST（默认 /tmp/cos-sim-bucket/sl-gis）
#   2) 默认（无 DRY_RUN）— 调 tccli，需环境变量：
#        TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_APPID
#        TENCENT_BUCKET / TENCENT_REGION（默认 ap-guangzhou）/ TENCENT_PREFIX（默认 sl-gis/）
#
# 部署步骤详见 docs/deploy.md

set -euo pipefail

DIST_DIR="${DIST_DIR:-dist}"
PREFIX="${TENCENT_PREFIX:-sl-gis/}"
REGION="${TENCENT_REGION:-ap-guangzhou}"

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ dist/ 不存在，先跑: pnpm build"
  exit 1
fi

# ===== DRY-RUN 模式 =====
if [ "${DRY_RUN:-0}" = "1" ]; then
  LOCAL_DEST="${LOCAL_DEST:-/tmp/cos-sim-bucket/$PREFIX}"
  echo "=== SL-GIS 部署 DRY-RUN（不连腾讯云）==="
  echo "Bucket  : $LOCAL_DEST (本地模拟)"
  echo "Source  : $DIST_DIR/"
  echo "Prefix  : $PREFIX"
  echo ""
  rm -rf "${LOCAL_DEST%/}"
  mkdir -p "$LOCAL_DEST"
  echo "→ 同步上传..."
  rsync -a --delete "$DIST_DIR/" "$LOCAL_DEST/"
  echo "✓ 上传完成"
  echo ""
  echo "=== 模拟部署结果 ==="
  find "$LOCAL_DEST" -type f | sort | head -20
  echo ""
  echo "总文件: $(find "$LOCAL_DEST" -type f | wc -l) 个"
  echo "总大小: $(du -sh "$LOCAL_DEST" | awk '{print $1}')"
  echo ""
  echo "=== 下一步：真部署 ==="
  echo "1. 配凭证:  export TENCENT_SECRET_ID=... TENCENT_SECRET_KEY=... TENCENT_APPID=..."
  echo "2. 跑本脚本（去掉 DRY_RUN）:  ./scripts/deploy-cos.sh"
  echo "3. COS 控制台 → 静态网站 → 错误文档 = index.html（修 SPA 404）"
  echo "4. CDN 绑 nanoai.fun → /sl-gis/* 回源"
  echo "5. 访问 https://nanoai.fun/sl-gis/"
  exit 0
fi

# ===== 正式模式：需要凭证 =====
: "${TENCENT_SECRET_ID:?set TENCENT_SECRET_ID（真部署时需提供）}"
: "${TENCENT_SECRET_KEY:?set TENCENT_SECRET_KEY}"
: "${TENCENT_APPID:?set TENCENT_APPID}"
: "${TENCENT_BUCKET:?set TENCENT_BUCKET}"

BUCKET_FULL="${TENCENT_BUCKET}-${TENCENT_APPID}"

echo "=== SL-GIS 部署到 COS ==="
echo "Bucket : $BUCKET_FULL"
echo "Region : $REGION"
echo "Prefix : $PREFIX"
echo "Source : $DIST_DIR/"
echo ""

echo "→ 同步上传（清旧 + 传新）..."
tccli cos syncupload \
  --bucket "$BUCKET_FULL" \
  --region "$REGION" \
  --local-path "$DIST_DIR/" \
  --cos-path "/$PREFIX" \
  --delete 2>&1 | tail -20

echo ""
echo "✓ 上传完成"
echo ""
echo "=== 部署后必做（在控制台）==="
echo "1. COS bucket → 静态网站 → 开启 → 错误文档 = index.html（关键，修 SPA 404）"
echo "2. CDN → 绑 nanoai.fun → 路径 /sl-gis/* → 回源 COS"
echo "3. HTTPS 证书（CDN 控制台免费申请）"
echo "4. 访问 https://nanoai.fun/sl-gis/ 验证"
