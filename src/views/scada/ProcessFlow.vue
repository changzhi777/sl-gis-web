<!--
  ProcessFlow.vue — 净水工艺流程图（SVG，SCADA 中列下）
  流程链：取水井 → 絮凝池 → 沉淀池 → 过滤池 →（下行）→ 消毒间 → 清水池 → 加压泵房 → 供水管网
  · S 形双行布局，流向箭头 + 流动虚线（prefers-reduced-motion 时静止）
  · 每节点实时参数（流量/压力/液位/浊度/余氯），数值全部从 mockData 监测点/工程指标推导
  · 越限节点（过滤浊度 >1 NTU / 清水池液位 >4.5 m / 泵房压力点告警）红框闪烁 + 告警徽标
  · 色板与 tokens.css 同源：底 #071525 系、强调 #00C2FF/#00FFE0、告警 #FF5C5C
-->
<template>
  <div class="pf">
    <svg
      class="pf-svg"
      viewBox="0 0 1032 300"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="净水工艺流程图：取水、絮凝、沉淀、过滤、消毒、清水池、泵房、供水管网"
    >
      <defs>
        <marker
          id="pf-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#00C2FF" />
        </marker>
      </defs>

      <!-- 连接线（流向箭头 + 流动虚线） -->
      <path
        v-for="(d, i) in connectors"
        :key="`c-${i}`"
        class="flow-line"
        :d="d"
        marker-end="url(#pf-arrow)"
      />

      <!-- 工艺节点 -->
      <g
        v-for="n in nodes"
        :key="n.key"
        class="node"
        :class="{ 'is-alarm': n.abnormal }"
      >
        <rect class="node-box" :x="n.x" :y="n.y" :width="NODE_W" :height="NODE_H" rx="3" />
        <text class="node-name" :x="n.x + 14" :y="n.y + 26">{{ n.name }}</text>
        <g v-if="n.abnormal">
          <rect class="badge" :x="n.x + NODE_W - 52" :y="n.y + 11" width="40" height="17" rx="2" />
          <text class="badge-t" :x="n.x + NODE_W - 32" :y="n.y + 23">告警</text>
        </g>
        <text
          v-for="(p, pi) in n.params"
          :key="p.k"
          class="p-k"
          :x="n.x + 14"
          :y="n.y + 50 + pi * 19"
        >{{ p.k }}<tspan class="p-v num" dx="8" :class="{ 'p-bad': p.bad }">{{ p.v }}</tspan><tspan class="p-u" dx="3">{{ p.u }}</tspan></text>
      </g>

      <!-- 图例 -->
      <g class="pf-legend">
        <circle cx="10" cy="291" r="4" class="lg-ok" />
        <text class="lg-t" x="20" y="295">运行正常</text>
        <circle cx="96" cy="291" r="4" class="lg-bad" />
        <text class="lg-t" x="106" y="295">越限（红闪）</text>
        <text class="lg-src" x="1022" y="295">数据源：实时监测点 · 10min 采样</text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { mockData } from '@mock/index';

/* ---------- 布局常量（viewBox 1032×300，S 形双行） ---------- */
const NODE_W = 214;
const NODE_H = 88;
const XS = [4, 274, 544, 814];
const Y1 = 14;   // 第一行（左→右）
const Y2 = 178;  // 第二行（右→左）

interface FlowParam {
  k: string;
  v: string;
  u: string;
  bad?: boolean;
}
interface FlowNode {
  key: string;
  name: string;
  x: number;
  y: number;
  params: FlowParam[];
  abnormal: boolean;
}

/* ---------- 从 mockData 推导工艺参数 ---------- */
const mons = mockData.monitors;
const flowMon = mons.filter((m) => m.type === 'flow');
const qualityMon = mons.filter((m) => m.type === 'quality');
const pressureMon = mons.filter((m) => m.type === 'pressure');
const levelMon = mons.filter((m) => m.type === 'level');

const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

const intake = avg(flowMon.map((m) => m.value));            // 取水流量 m³/h
const netFlow = sum(flowMon.map((m) => m.value));           // 管网总流量 m³/h
const settleTurb = qualityMon.length ? Math.min(...qualityMon.map((m) => m.value)) : 0;
const filterTurb = avg(qualityMon.map((m) => m.value));     // 过滤出水浊度 NTU
const clearLevel = avg(levelMon.map((m) => m.value));       // 清水池液位 m
const medPressure = median(pressureMon.map((m) => m.value));// 泵房出口压力 MPa

// 余氯 / 水泵电流来自 A 级工程指标
const gradeA = mockData.projects.filter((p) => p.grade === 'A');
const chlorineVals = gradeA
  .map((p) => p.metrics.chlorine)
  .filter((x): x is number => typeof x === 'number');
const chlorine = chlorineVals.length ? avg(chlorineVals) : 0.55;
const currentVals = gradeA
  .map((p) => p.metrics.pumpCurrent)
  .filter((x): x is number => typeof x === 'number');
const avgCurrent = currentVals.length ? avg(currentVals) : 24;

const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);

/* 越限判定（与监测点告警同口径） */
const filtBad = filterTurb > 1.0;                                  // 国标 ≤1 NTU
const levelBad = clearLevel > 4.5;                                 // 液位越上限
const chlorineBad = chlorine > 0 && chlorine < 0.3;                // 余氯不足
const pumpBad = pressureMon.some((m) => m.status === 'alarm');     // 压力点告警

/* ---------- 节点定义 ---------- */
const nodes = computed<FlowNode[]>(() => [
  {
    key: 'intake', name: '取水井', x: XS[0], y: Y1, abnormal: false,
    params: [
      { k: '流量', v: f1(intake), u: 'm³/h' },
      { k: '水源液位', v: f2(clearLevel * 1.06), u: 'm' },
    ],
  },
  {
    key: 'flocc', name: '絮凝池', x: XS[1], y: Y1, abnormal: false,
    params: [
      { k: '流量', v: f1(intake), u: 'm³/h' },
      { k: '药剂投加', v: f1(intake * 0.08), u: 'L/h' },
    ],
  },
  {
    key: 'settle', name: '沉淀池', x: XS[2], y: Y1, abnormal: false,
    params: [
      { k: '浊度', v: f2(settleTurb), u: 'NTU' },
      { k: '流量', v: f1(intake * 0.99), u: 'm³/h' },
    ],
  },
  {
    key: 'filter', name: '过滤池', x: XS[3], y: Y1, abnormal: filtBad,
    params: [
      { k: '浊度', v: f2(filterTurb), u: 'NTU', bad: filtBad },
      { k: '流量', v: f1(intake * 0.97), u: 'm³/h' },
    ],
  },
  {
    key: 'disinfect', name: '消毒间', x: XS[3], y: Y2, abnormal: chlorineBad,
    params: [
      { k: '余氯', v: f2(chlorine), u: 'mg/L', bad: chlorineBad },
      { k: '流量', v: f1(intake * 0.97), u: 'm³/h' },
    ],
  },
  {
    key: 'clearwell', name: '清水池', x: XS[2], y: Y2, abnormal: levelBad,
    params: [
      { k: '液位', v: f2(clearLevel), u: 'm', bad: levelBad },
      { k: '进站流量', v: f1(intake * 0.97), u: 'm³/h' },
    ],
  },
  {
    key: 'pumproom', name: '加压泵房', x: XS[1], y: Y2, abnormal: pumpBad,
    params: [
      { k: '出口压力', v: f2(medPressure), u: 'MPa', bad: pumpBad },
      { k: '水泵电流', v: f1(avgCurrent), u: 'A' },
    ],
  },
  {
    key: 'network', name: '供水管网', x: XS[0], y: Y2, abnormal: false,
    params: [
      { k: '总流量', v: f1(netFlow), u: 'm³/h' },
      { k: '末端压力', v: f2(medPressure * 0.92), u: 'MPa' },
    ],
  },
]);

/* ---------- 连接线（S 形：行 1 左→右 → 下行 → 行 2 右→左） ---------- */
const cy1 = Y1 + NODE_H / 2; // 58
const cy2 = Y2 + NODE_H / 2; // 222
const connectors = [
  `M${XS[0] + NODE_W},${cy1} H${XS[1] - 6}`,   // 取水 → 絮凝
  `M${XS[1] + NODE_W},${cy1} H${XS[2] - 6}`,   // 絮凝 → 沉淀
  `M${XS[2] + NODE_W},${cy1} H${XS[3] - 6}`,   // 沉淀 → 过滤
  `M${XS[3] + NODE_W / 2},${Y1 + NODE_H} V${Y2 - 6}`, // 过滤 ↓ 消毒
  `M${XS[3]},${cy2} H${XS[2] + NODE_W + 6}`,   // 消毒 → 清水池
  `M${XS[2]},${cy2} H${XS[1] + NODE_W + 6}`,   // 清水池 → 泵房
  `M${XS[1]},${cy2} H${XS[0] + NODE_W + 6}`,   // 泵房 → 管网
];
</script>

<style scoped>
.pf {
  flex: 1;
  min-height: 0;
  display: flex;
}
.pf-svg {
  width: 100%;
  height: 100%;
}

/* 节点 */
.node-box {
  fill: rgba(12, 35, 64, 0.55);
  stroke: rgba(0, 194, 255, 0.45);
  stroke-width: 1;
}
.node.is-alarm .node-box {
  stroke: var(--status-alarm, #ff5c5c);
  filter: drop-shadow(0 0 6px rgba(255, 92, 92, 0.55));
  animation: node-blink 1.1s ease-in-out infinite;
}
@keyframes node-blink {
  0%, 100% { stroke-opacity: 1; }
  50% { stroke-opacity: 0.25; }
}

.node-name {
  fill: var(--text, #e8f1f8);
  font-size: 15px;
  font-weight: 600;
  font-family: var(--cn);
}
.is-alarm .node-name {
  fill: #ffb3b3;
}

/* 参数行 */
.p-k {
  fill: var(--text-dim, #9db2c6);
  font-size: 12px;
  font-family: var(--cn);
}
.p-v {
  fill: var(--spring-green, #00ffe0);
  font-weight: 600;
  font-size: 13px;
}
.p-v.p-bad {
  fill: var(--status-alarm, #ff5c5c);
}
.p-u {
  fill: var(--text-dim, #9db2c6);
  font-size: 11px;
}

/* 告警徽标 */
.badge {
  fill: rgba(255, 92, 92, 0.16);
  stroke: var(--status-alarm, #ff5c5c);
  stroke-width: 1;
}
.badge-t {
  fill: var(--status-alarm, #ff5c5c);
  font-size: 11px;
  font-weight: 600;
  text-anchor: middle;
  font-family: var(--cn);
}

/* 连接线：流动虚线 */
.flow-line {
  fill: none;
  stroke: var(--flood-teal, #00c2ff);
  stroke-width: 1.5;
  stroke-opacity: 0.65;
  stroke-dasharray: 7 5;
  animation: flow-dash 1.2s linear infinite;
}
@keyframes flow-dash {
  to { stroke-dashoffset: -12; }
}

/* 图例 */
.lg-ok { fill: var(--flood-teal, #00c2ff); }
.lg-bad { fill: var(--status-alarm, #ff5c5c); }
.lg-t {
  fill: var(--text-dim, #9db2c6);
  font-size: 11px;
  font-family: var(--cn);
}
.lg-src {
  fill: var(--text-dim, #9db2c6);
  font-size: 10px;
  opacity: 0.65;
  text-anchor: end;
  font-family: var(--cn);
}

@media (prefers-reduced-motion: reduce) {
  .flow-line { animation: none; }
  .node.is-alarm .node-box { animation: none; }
}
</style>
