/** 阶段 1 契约：4 轨道并行 subagent 的文件所有权边界表
 * 严格隔离 — 越界即冲突。所有公共文件（main.ts/router/Dashboard.vue）由主 agent 在阶段 2.5 总装阶段创建。
 */

# Track A — WebGL 引擎（src/components/canvas/** 专属）
- src/components/canvas/Stage.ts            [A]  WebGLRenderer + PerspectiveCamera + OrbitControls + RenderLoop + EventBus
- src/components/canvas/BaseLayer.ts       [A]  抽象基类
- src/components/canvas/BaseMapLayer.ts    [A]  暗色底 + 旗边界描边（读 public/geo/banner.json）
- src/components/canvas/PipeLayer.ts       [A]  流光（SubwayMesh 配方移植）
- src/components/canvas/ProjectLayer.ts     [A]  A-D 形状 × 5 状态 + 点击事件
- src/components/canvas/MonitorLayer.ts    [A]  光晕球（LightSphere 配方）
- src/components/canvas/AlertLayer.ts       [A]  雷达脉冲 + 围幕
- src/components/canvas/FlyLineLayer.ts     [A]  CatmullRom + 尾迹飞线
- src/components/canvas/CityLayer.ts        [A]  3D 城市建筑群（v7.3 增量 · 程序化 + InstancedMesh）
- src/components/canvas/ModelLayer.ts       [A]  GLTFLoader + DRACO + PBR（v7.2 增量）
- src/components/canvas/palette.ts          [A]  场景色常量（与 tokens.css 同源；只读 imported from tokens）
- src/components/canvas/hitTest.ts         [A]  屏幕→世界坐标
- src/components/canvas/utils/lon2xy.ts     [A]  墨卡托（19 行，照抄 smartcity）

# Track B — UI 组件 + 布局（src/components/ui/** + src/views/** 专属）
- src/components/ui/Panel.vue                [B]  刻度角标 + 红顶条变体
- src/components/ui/KpiCard.vue              [B]  countup + delta 好坏着色
- src/components/ui/Legend.vue               [B]  A-D 形状 + 状态双编码
- src/components/ui/TopBar.vue               [B]  告警红徽标链路
- src/components/ui/ModelViewer.vue          [B]  3D 详情浮窗（v7.2 增量 · 独立 renderer）
- src/components/ui/CityToggle.vue           [B]  建筑群开关 + 密度滑杆（v7.3 增量）
- src/views/DashboardLayout.vue              [B]  v-scale-screen 1920×1080 九宫格
- src/views/pipe-network/Dashboard.vue       [B]  大屏主视图（业务组件 + 公共 state 接线）
- src/views/pipe-network/CockpitPanel.vue    [B]  左列三面板（工程总览/供水保障/水量电耗）
- src/views/pipe-network/AlertList.vue       [B]  右列实时告警滚动
- src/views/pipe-network/MonitorPanel.vue    [B]  右列水质/运维效能

# Track C — Mock 数据工厂（src/mock/** 专属）
- src/mock/index.ts                          [C]  Mock.js 体系 + USE_MOCK 开关（仿 IofTV）
- src/mock/factories/projects.ts             [C]  46 处工程（12A/8B/26C + 1842D）
- src/mock/factories/pipes.ts                [C]  200 段管网
- src/mock/factories/monitors.ts             [C]  50 个监测点 + 24h 历史
- src/mock/factories/alerts.ts               [C]  告警流
- src/mock/factories/cockpit.ts              [C]  驾驶舱 KPI
- public/geo/banner.json                     [C]  从 /Users/mac/Documents/Projects/sl-gis/mock-geo/152524-苏尼特右旗.json 拷入

# Track D — ECharts 图表（src/components/charts/** 专属）
- src/components/charts/TrendLine.vue        [D]  多系列 + 网格刻度 + dot 图例
- src/components/charts/StatusBars.vue       [D]  六态横条 + 刻度纹理
- src/components/charts/MiniRings.vue        [D]  环图 + 目标刻度
- src/components/charts/MicroBar.vue         [D]  微型条
- src/components/charts/SparkLine.vue        [D]  火花线
- src/components/charts/index.ts             [D]  导出 + 主题
- src/components/charts/theme/water-tech.ts  [D]  ECharts 主题（与 tokens 同源色）

# 主 agent — 阶段 2.5 总装（公共区，所有 agent 不可碰）
- src/main.ts                                [主]
- src/App.vue                                [主]
- src/router/index.ts                        [主]
- src/stores/cockpit.ts                      [主]  Pinia 总线
- src/stores/layers.ts                       [主]  Layer 显隐/密度
- src/composables/useMockData.ts             [主]  桥接 mock 工厂与 store
- src/composables/useApi.ts                  [主]  mock/real 切换钩子
- index.html                                 [主]

# 阶段 4 部署（主 agent 备料，用户执行）
- scripts/deploy-cos.sh                      [主]
- docs/deploy.md                             [主]

# 公共 imported 区（read-only 引用）
- src/shared/types.ts                        [冻结]  跨端共享类型
- src/styles/tokens.css                      [冻结]  CSS variables
- vite.config.ts                             [冻结]  别名 + proxy
- tsconfig.json                              [冻结]  path 别名
- package.json                               [冻结]  依赖已装齐

# 验收（主 agent）
- playwright.config.ts                       [主]
- e2e/dashboard.spec.ts                      [主]
