# CNB Pipeline · SL-GIS

CI/CD 自动化：推 `main` → 构建 → 同步到腾讯云 COS+CDN → 可选同步到香港服务器。

## 前置配置（一次性，5 分钟）

### 1. CNB 控制台创建 4 个密钥

进入 CNB 项目 → **设置** → **密钥** → 新建：

| 密钥名 | 必填 | 值 |
|---|---|---|
| `SL-GIS-SECRET-ID` | ✅ | 子账号 `qmwx-cos-uploader` 的 SecretId（CAM 控制台「访问密钥」新建并复制） |
| `SL-GIS-SECRET-KEY` | ✅ | 同上的 SecretKey（**一次性显示，复制即保存**） |
| `TENCENT_APPID` | ✅ | `100050691448`（子账号归属） |

> ⚠️ SecretKey 永不出现在代码/聊天/截图里，**只**在 CNB 加密存储。

### 2. COS 一次性配置（控制台，5 分钟）

1. 创建 bucket：`sl-gis-static-100050691448`，地域 ap-guangzhou，权限：公有读 + 私有写
2. **静态网站** → 开启 → 索引/错误文档 = `index.html`
3. **CDN 加速域名** → 添加 `nanoai.fun`，回源 COS 源站，**路径** `/sl-gis/*` 限定
4. 申请/绑定免费 HTTPS 证书

### 3. （可选）香港服务器 fallback

如需部署到您自己的香港服务器，额外加 4 个密钥：
- `SL-GIS-SSH-USER` (如 `ubuntu`)
- `SL-GIS-SSH-HOST` (如 `hk.example.com`)
- `SL-GIS-SSH-PORT` (默认 22)
- `SL-GIS-SSH-KEY` (整段 PEM 私钥，含 BEGIN/END 行)
- `SL-GIS-SSH-PATH` (默认 `/var/www/sl-gis/`)

并取消 `.cnb.yml` 中 `# step: name: "deploy-to-hk-server"` 段的注释。

## 触发部署

```bash
cd /Users/mac/Documents/Projects/sl-gis/sl-gis-web
git add .cnb.yml docs/deploy.md
git commit -m "ci: CNB pipeline → COS 自动部署"
git push origin main
```

CNB 自动跑：
1. **build** — `pnpm install + typecheck + vite build` → `dist/`
2. **deploy-to-cos** — `coscmd upload --delete --sync` 同步到 bucket `sl-gis-static-100050691448` 的 `sl-gis/` 前缀

## 部署后验证

```bash
curl -I https://nanoai.fun/sl-gis/                    # 期望 200
curl -I https://nanoai.fun/sl-gis/dashboard         # 期望 200（SPA fallback）
curl -I https://nanoai.fun/sl-gis/geo/banner.json   # 期望 200 + Content-Type: application/json
```

## 回滚

```bash
# 1. CNB 控制台 → 流水线 → 最近一次成功构建 → 重新运行（幂等）
# 2. COS 紧急回滚：控制台 → 文件管理 → sl-gis/ → 选旧版本上传覆盖
# 3. 兜底：git revert && git push（CNB 自动反向部署）
```

## 故障排查

| 现象 | 原因 | 修 |
|---|---|---|
| 流水线 `install coscmd` 失败 | 网络问题 | 改用 `pip install --index-url https://pypi.tuna.tsinghua.edu.cn/simple coscmd` |
| `coscmd config` 401 | SecretId/Key 错 | CAM 控制台重置密钥 |
| 部署后 `/sl-gis/` 404 | CDN 路径配置错 | CDN → 域名管理 → 路径规则确认是 `/sl-gis/*` |
| SPA 路由刷新 404 | COS 错误文档未设 | 静态网站 → 错误文档 = `index.html` |
| HTTPS 证书警告 | 证书未生效 | 等待 CDN 证书签发（几分钟）或手动绑定 |
