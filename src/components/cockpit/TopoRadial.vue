<!--
  TopoRadial.vue — 供水拓扑辐射主视觉（B 稿落地 · 驾驶舱可切换视图）
  · 水厂为心双环旋转 + 苏木放射干线（线宽=规模口径固定 · 色=在线率健康度）+ 牧户散点三环
  · 数据绑定：nodes 六苏木真在线率（projects 按苏木聚合）
  · 动效纪律：仅 transform/stroke-dashoffset/opacity · prefers-reduced-motion 静默
-->
<template>
  <div class="topo">
    <svg viewBox="0 0 1200 800" role="img" aria-label="供水拓扑辐射">
      <defs>
        <radialGradient id="tr-core" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="#00ffe0" stop-opacity=".35" />
          <stop offset=".6" stop-color="#00c2ff" stop-opacity=".12" />
          <stop offset="1" stop-color="#00c2ff" stop-opacity="0" />
        </radialGradient>
        <filter id="tr-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <!-- 牧户散点三弧带（闪烁） -->
      <g fill="#00c2ff">
        <circle v-for="(p, i) in FARMERS" :key="i" class="tr-hh" :cx="p[0]" :cy="p[1]" :r="p[2]" :opacity="p[3]" />
      </g>

      <!-- 刻度环（缓慢旋转） -->
      <g class="tr-ring" stroke="rgba(0,194,255,.22)">
        <circle cx="590" cy="400" r="330" fill="none" stroke-dasharray="2 26" stroke-width="10" />
        <circle cx="590" cy="400" r="238" fill="none" stroke-dasharray="40 10 4 10" stroke-width="1" />
      </g>

      <!-- 六条辐射干线（色=健康度 · 流动） -->
      <g fill="none" filter="url(#tr-glow)">
        <path
          v-for="(n, i) in spokes"
          :key="n.name"
          class="tr-flow"
          :class="{ slow: i % 2 === 1 }"
          :d="`M590 400 Q ${n.cx} ${n.cy} ${n.ex} ${n.ey}`"
          :stroke="nodeColor(n.value)"
          :stroke-width="3 + (i % 3)"
        />
      </g>

      <!-- 中心水厂 -->
      <circle class="tr-pulse" cx="590" cy="400" r="120" fill="url(#tr-core)" />
      <g class="tr-spin-a"><circle cx="590" cy="400" r="74" fill="none" stroke="rgba(0,255,224,.5)" stroke-width="1.4" stroke-dasharray="60 14 8 14" /></g>
      <g class="tr-spin-b"><circle cx="590" cy="400" r="56" fill="none" stroke="rgba(0,194,255,.55)" stroke-width="1.2" stroke-dasharray="20 10" /></g>
      <circle cx="590" cy="400" r="40" fill="rgba(10,24,42,.9)" stroke="#00ffe0" stroke-width="1.6" filter="url(#tr-glow)" />
      <path d="M590 378 c -9 12 -13 18 -13 25 a 13 13 0 0 0 26 0 c 0 -7 -4 -13 -13 -25 Z" fill="#00ffe0" />
      <path d="M574 414 q 8 5 16 0 q 8 -5 16 0" stroke="#00c2ff" stroke-width="1.6" fill="none" />
      <text class="tr-label" x="590" y="452" text-anchor="middle" font-size="13">第二水厂</text>
      <text class="tr-sub" x="590" y="468" text-anchor="middle">1.2万m³/d · 2运1备</text>

      <!-- 六苏木节点（真在线率） -->
      <g v-for="n in spokes" :key="n.name">
        <circle class="tr-node" :cx="n.ex" :cy="n.ey" r="7" :fill="nodeColor(n.value)" filter="url(#tr-glow)" />
        <circle v-if="n.value < 90" :cx="n.ex" :cy="n.ey" r="13" fill="none" stroke="rgba(255,180,84,.5)" stroke-dasharray="3 4" />
        <text class="tr-label" :x="n.tx" :y="n.ty" text-anchor="middle">{{ n.name }}</text>
        <text class="tr-sub" :x="n.tx" :y="n.ty + 15" text-anchor="middle" :fill="nodeColor(n.value)">{{ n.value.toFixed(1) }}%</text>
      </g>

      <text class="tr-note" x="590" y="760" text-anchor="middle">全域供水拓扑 · 颜色=在线率健康度（青正常 / 琥珀关注） · 外圈为牧户供水点</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ nodes?: Array<{ name: string; value: number }> }>(),
  {
    nodes: () => [
      { name: '赛汉塔拉镇', value: 94.2 },
      { name: '乌日根塔拉镇', value: 91.5 },
      { name: '朱日和镇', value: 92.8 },
      { name: '赛汉乌力吉苏木', value: 90.1 },
      { name: '桑宝拉格苏木', value: 88.7 },
      { name: '额仁淖尔苏木', value: 86.3 },
    ],
  },
);

/** 六节点环形锚点（设计稿 B 构图 · 终点/文字位置） */
const ANCHORS = [
  { cx: 470, cy: 240, ex: 350, ey: 190, tx: 350, ty: 148 },
  { cx: 720, cy: 250, ex: 836, ey: 210, tx: 836, ty: 168 },
  { cx: 380, cy: 380, ex: 252, ey: 408, tx: 226, ty: 384 },
  { cx: 800, cy: 380, ex: 928, ey: 402, tx: 954, ty: 378 },
  { cx: 450, cy: 580, ex: 362, ey: 608, tx: 362, ty: 638 },
  { cx: 740, cy: 570, ex: 824, ey: 602, tx: 824, ty: 632 },
];

const spokes = computed(() =>
  props.nodes.slice(0, 6).map((n, i) => ({ ...n, short: n.name.length > 7 ? n.name.slice(0, 7) : n.name, ...ANCHORS[i], name: n.name.length > 7 ? n.name.slice(0, 7) : n.name })),
);

/** 牧户散点（设计稿 B 三弧带坐标） */
const FARMERS: Array<[number, number, number, number]> = [
  [340, 250, 2.2, 0.5], [392, 196, 2, 0.4], [470, 158, 2.4, 0.55], [700, 150, 2, 0.4], [790, 180, 2.3, 0.5], [856, 238, 2, 0.45], [300, 330, 2.1, 0.45], [884, 322, 2.2, 0.5],
  [248, 410, 2.4, 0.6], [932, 404, 2.4, 0.6], [268, 520, 2, 0.4], [916, 516, 2.1, 0.45], [360, 612, 2.3, 0.5], [826, 606, 2.2, 0.5], [470, 662, 2, 0.4], [714, 658, 2.2, 0.5],
  [150, 300, 1.8, 0.3], [1030, 292, 1.8, 0.3], [128, 470, 2, 0.35], [1056, 468, 2, 0.35], [205, 640, 1.8, 0.3], [980, 636, 1.8, 0.3],
];

function nodeColor(v: number): string {
  return v >= 90 ? '#00ffe0' : '#ffb454';
}
</script>

<style scoped>
.topo { width: 100%; height: 100%; display: grid; place-items: center; }
.topo svg { width: min(94%, 1200px); height: 94%; }

.tr-spin-a { transform-origin: 590px 400px; animation: tr-spin 26s linear infinite; }
.tr-spin-b { transform-origin: 590px 400px; animation: tr-spin 40s linear infinite reverse; }
@keyframes tr-spin { to { transform: rotate(360deg); } }

.tr-pulse { transform-origin: 590px 400px; animation: tr-pulse 3.2s ease-in-out infinite; }
@keyframes tr-pulse { 50% { opacity: 0.72; } }

.tr-flow { stroke-dasharray: 8 12; animation: tr-flow 1.8s linear infinite; }
.tr-flow.slow { animation-duration: 3s; }
@keyframes tr-flow { to { stroke-dashoffset: -20; } }

.tr-node { animation: tr-nodep 2.6s ease-in-out infinite; }
.tr-node:nth-of-type(2n) { animation-delay: 0.8s; }
@keyframes tr-nodep { 50% { opacity: 0.55; } }

.tr-hh { animation: tr-hhp 4s ease-in-out infinite; }
.tr-hh:nth-of-type(3n) { animation-delay: 1.4s; }
@keyframes tr-hhp { 50% { opacity: 0.25; } }

.tr-ring { transform-origin: 590px 400px; animation: tr-spin 90s linear infinite; }

.tr-label { font-size: 12px; fill: #e8f1f8; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; font-weight: 600; }
.tr-sub { font-size: 10px; fill: #9db2c6; font-family: 'Rajdhani', 'DIN Alternate', sans-serif; }
.tr-note { font-size: 11px; fill: #9db2c6; opacity: 0.85; }

@media (prefers-reduced-motion: reduce) {
  .tr-spin-a, .tr-spin-b, .tr-pulse, .tr-flow, .tr-node, .tr-hh, .tr-ring { animation: none; }
}
</style>
