  # SL-GIS 源码（sl-gis-web 单仓）
<!-- ci-trigger-2 -->
<!-- ci-trigger -->

Vue3 + Three.js WebGL 旗县农村供水管理平台大屏。

## 子仓结构

```
src/
├── components/canvas/      # Track A 专属（WebGL 引擎）
├── components/ui/          # Track B 专属（2D 面板）
├── components/charts/      # Track D 专属（ECharts 图表）
├── stores/                 # Pinia
├── mock/                   # Track C 专属（数据工厂）
├── shared/                 # 跨端共享类型/工具
├── views/                  # 路由级页面
├── router/
├── styles/
├── App.vue
└── main.ts
```

## 启动

```bash
pnpm dev          # localhost:5173（dev proxy /api → 8000）
pnpm build        # 生产构建（base = /sl-gis/）
pnpm preview      # 预览 dist/
```

## 设计规范

`/docs/design/design-system.md`（根仓）— 所有 UI 颜色/字号/组件样式以此为准。

## 部署

1. `pnpm build` 出 `dist/`
2. COS bucket `sl-gis-static` 前缀 `sl-gis/`，开 404 → index.html 重写
3. CDN 域名 `nanoai.fun` 回源 COS，路径 `/sl-gis/*` 限定
4. 详细：见根仓 `docs/deploy.md`（脚本占位）
