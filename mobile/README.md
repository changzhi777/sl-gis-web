# SL 供水通 · 移动端骨架（uni-app + Vue3 + Vite + TS）

牧区用水户端：水费查询 / 在线报修 / 停水公告。纯 CLI 构建，无需 HBuilderX（需 Node 18+）。

## 启动
```bash
cd mobile && npm install
npm run dev:h5            # H5 开发
npm run build:h5          # H5 构建 → dist/build/h5
npm run dev:mp-weixin     # 微信小程序开发（微信开发者工具导入 dist/dev/mp-weixin）
npm run build:mp-weixin   # 小程序构建 → dist/build/mp-weixin
```

## 目录
- `src/pages/index/index.vue`  首页：用户卡（户号/余额）+ 快捷宫格 + 停水公告
- `src/pages/bill/index.vue`   水费：当月账单 + 近6月用量（纯CSS柱状）+ 缴费记录
- `src/pages/repair/index.vue` 报修：类型/电话/描述/照片占位，本地 toast 反馈
- `src/api/mock.ts`            牧区口径 mock：水价 3.5 元/m³、月用水 8-20 m³
- `src/styles/theme.scss`      深蓝科技风变量（白底蓝头）

## 依赖版本（已验证组合，build:h5 通过）

DCloud 的 npm dist-tags 长期不更新（latest 指向 2021 老版），必须锁定精确版本：
`@dcloudio/* 3.0.0-4030620241128001` · `vue 3.4.38` · `vite 5.2.8` · `sass 1.77.8` · `pinia 2.1.7`

后端未接，全本地 mock；规划 API 基址 `https://nanoai.fun/api`（FastAPI + JWT）。
