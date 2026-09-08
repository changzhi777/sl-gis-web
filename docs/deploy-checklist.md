# CNB 流水线状态速查

推送 `git push origin main` 后 3-5 分钟内会在 CNB 控制台出结果。

## 看构建结果

1. 进入 CNB 项目 → **流水线** 标签
2. 找最新一次运行（最上面），状态分三色：
   - 🟢 **成功**：进入 [Step 4 健康检查](#-部署后-curl-健康检查)
   - 🟡 **运行中**：等 1-3 分钟
   - 🔴 **失败**：点开 → 看「构建日志」最末 30 行 → 给我关键错

## 常见错误速查

| 阶段 | 报错关键词 | 原因 | 修 |
|---|---|---|---|
| build | `Cannot find module '@sl-gis/xxx'` | 漏装 pnpm 依赖 | 重跑 |
| build | `tsc: errors in src/...` | 类型错 | 我改 |
| build | `pnpm install EACCES` | CNB runner 权限 | 加 `--no-frozen-lockfile` 到 install |
| deploy | `coscmd: 401 Unauthorized` | 密钥错 | CAM 重置 SecretId/Key |
| deploy | `coscmd: NoSuchBucket` | bucket 名错 | 控制台核对名称 |
| deploy | `coscmd: SSL: CERTIFICATE_VERIFY_FAILED` | runner 系统 CA 旧 | 加 `pip install --upgrade certifi` |

## 🎯 部署后 curl 健康检查（5 步）

```bash
# 1. SPA 根路径
curl -I https://nanoai.fun/sl-gis/ | head -1
# 期望：HTTP/2 200

# 2. SPA 路由（验证错误页重写）
curl -I https://nanoai.fun/sl-gis/dashboard | head -1
# 期望：HTTP/2 200（不是 404！）

# 3. 静态资源
curl -I https://nanoai.fun/sl-gis/assets/vue-gfO4F0oW.js | head -3
# 期望：200 + Cache-Control: public, max-age=3600

# 4. GeoJSON 资源
curl -I https://nanoai.fun/sl-gis/geo/banner.json | head -3
# 期望：200 + Content-Type: application/json + Cache-Control: max-age=86400

# 5. 浏览器打开
open https://nanoai.fun/sl-gis/
# 期望：9 块面板全活 + 旗县边界（六边形包络）
```

## 🔄 失败时回滚（5 分钟）

```bash
# Option A: CNB 控制台 → 流水线 → 找上一次成功运行 → "重跑"
# Option B: COS 控制台 → 文件管理 → sl-gis/ → 选中旧版本 → "恢复"  
# Option C: 本地修复 + 推 main（CNB 自动反向覆盖）
git revert HEAD
git push origin main
```

## 🆘 跑挂了发我看

把 CNB 流水线日志**最后 30 行**（脱敏后）发我，我定位根因。常用诊断：
- `coscmd list` 在 runner 装 coscmd 后是否能跑通（说明是 COS 限频 vs 凭证 vs 网络）
- `curl -I https://nanoai.fun/sl-gis/` 返 404 还是 5xx（区分 CDN vs COS vs 源站）
