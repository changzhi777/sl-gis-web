# SL-GIS 部署到 nanoai.fun/sl-gis

## 访问地址
**`https://nanoai.fun/sl-gis/`**

## 架构

```
┌──────────────────────────────────────────────────────────────┐
│ 用户浏览器                                                   │
│  https://nanoai.fun/sl-gis/                                 │
│   ↓ HTTPS                                                   │
│  CDN (nanoai.fun)                                          │
│   ↓ 回源 /sl-gis/*                                         │
│  COS bucket (sl-gis-static-$APPID)                         │
│   /sl-gis/                                                  │
│    ├── index.html              ← SPA 入口（错误页重写目标）  │
│    ├── assets/*.js, *.css                                  │
│    └── geo/banner.json          ← 旗县边界 GeoJSON           │
└──────────────────────────────────────────────────────────────┘
```

## 一次性配置（腾讯云控制台）

### 1. COS bucket
- 控制台：https://console.cloud.tencent.com/cos/bucket
- 名称：`sl-gis-static`（建议，脚本会拼 `-$APPID`）
- 地域：**ap-guangzhou**（或你账号的就近地域）
- 权限：公有读 + 私有写

### 2. 静态网站（关键 · 解决 SPA 刷新 404）
- 进入 bucket → **基础配置** → **静态网站** → 开启
- 索引文档：`index.html`
- 错误文档：**`index.html`** ← 让 `/sl-gis/dashboard` 等深路径刷新也回 SPA 入口

### 3. CDN 域名绑定
- 进入 bucket → **域名管理** → **CDN 加速域名** → 添加
- 域名：`nanoai.fun`（或 sl-gis 子域名 `sl-gis.nanoai.fun`）
- 回源：COS 源站
- 路径策略：**路径 `/sl-gis/*`** → 限定仅 sl-gis 前缀走本 bucket，其他回原站
- HTTPS：申请免费证书

### 4. 鉴权子账号（推荐）
- 控制台：https://console.cloud.tencent.com/cam/policy
- 创建自定义策略 `QcloudHunyuan3DFullAccess`（仅开通 ai3d + billing 读子集）
- 子账号 + 关联策略 → 生成 SecretId/Key
- 这对密钥**仅**给大屏 GEN-3D 脚本用；不与大屏 Web 端密钥混用

## 部署执行

### 方式 A：脚本（用户执行）
```bash
# 配置 COS 凭证（用户本地）
export TENCENT_SECRET_ID=AKIDxxx
export TENCENT_SECRET_KEY=xxx
export TENCENT_APPID=1300000000
export TENCENT_BUCKET=sl-gis-static
export TENCENT_REGION=ap-guangzhou
export TENCENT_PREFIX=sl-gis/

# 安装 tccli（如未装）
pip install tccli

# 跑部署
cd sl-gis-web
./scripts/deploy-cos.sh
```

### 方式 B：手动（coscmd / 控制台）
```bash
# 1. 装 coscmd
pip install coscmd

# 2. 配 .cos.conf（`coscmd config -a SecretId -s SecretKey -b bucket -r region`）

# 3. 同步上传
cd sl-gis-web
coscmd upload -r dist/ /sl-gis/ -H '{"Cache-Control":"public, max-age=3600"}'
```

## 部署后验证清单

- [ ] `curl -I https://nanoai.fun/sl-gis/` 返 200
- [ ] 浏览器直接访问 `https://nanoai.fun/sl-gis/dashboard` 不 404
- [ ] 路由直接刷新不 404（依赖 COS 错误页重写）
- [ ] WebGL 在公网正常渲染（无 mixed content 警告 — 必须 HTTPS）
- [ ] 旗县边界（banner.json 6.5KB）正确加载
- [ ] CDN 缓存头生效

## 排错

| 症状 | 原因 | 修 |
|---|---|---|
| `/sl-gis/dashboard` 刷新 404 | COS 错误页未设为 index.html | COS → 静态网站 → 错误文档 → index.html |
| Mixed content 警告 | CDN 没配 HTTPS | CDN → HTTPS 配置 → 选 Let's Encrypt 证书 |
| 静态资源 403 | bucket 私有读 | COS → 权限管理 → 跨域访问 CORS + 公有读 + CDN 边缘回源 |
| 刷新跳首页 | base 路径错 | vite.config base='/sl-gis/' 已设，**部署前** `pnpm build` |
| 大屏地图白屏 | Stage canvas 0×0 | 真浏览器验证 — Playwright headless 软 WebGL 不准 |

## 性能基线

构建产物（已 gzipped）：
- vue runtime: 35.5 KB
- Dashboard 业务: 47 KB  
- echarts: 167.5 KB
- three: 135.7 KB
- index.html: 0.46 KB
- 总首屏：**约 386 KB gzip**（可接受，CDN 缓存后几乎瞬开）

## 后续迭代

- v1.1：接 gen-3d.py + 子账号 SecretId 跑 12 A 级真实 GLB
- v1.2：换 TCB 云开发（一键自动 404 重写 + HTTPS）
- v2.0：加 FastAPI 后端（mini-rbac 5 表）+ 真实告警 SSE 推送
