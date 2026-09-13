<!--
  StyleMap.vue — 风格化全域地图主视觉（D 稿落地 · 驾驶舱可切换视图）
  · 点阵地形 + 同心等高线呼吸 + 旗界双线对流 + 苏木节点真在线率 + 低在线告警脉冲环
  · 与工程一张图差异：去瓦片纯数据墨水渲染（点阵 + 等高线抽象地形）
  · 动效纪律：仅 transform/stroke-dashoffset/opacity · prefers-reduced-motion 静默
-->
<template>
  <div class="sm">
    <svg viewBox="0 0 1240 800" preserveAspectRatio="xMidYMid slice" role="img" aria-label="风格化全域地图">
      <defs>
        <pattern id="sm-dot" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.3" fill="rgba(0,194,255,.28)" />
        </pattern>
        <filter id="sm-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="sm-clip">
          <path d="M330 170 L520 120 L740 150 L960 130 L1090 240 L1060 430 L940 560 L760 640 L560 660 L400 590 L300 440 L280 300 Z" />
        </clipPath>
      </defs>

      <!-- 旗界域内：点阵地形 + 等高线呼吸 -->
      <g clip-path="url(#sm-clip)">
        <rect x="260" y="100" width="860" height="580" fill="url(#sm-dot)" class="sm-dots" />
        <ellipse class="sm-contour" cx="620" cy="400" rx="300" ry="190" fill="none" stroke="rgba(0,255,224,.25)" stroke-width="1" />
        <ellipse class="sm-contour" cx="620" cy="400" rx="230" ry="145" fill="none" stroke="rgba(0,194,255,.3)" stroke-width="1" />
        <ellipse class="sm-contour" cx="620" cy="400" rx="160" ry="100" fill="none" stroke="rgba(0,255,224,.32)" stroke-width="1" />
        <ellipse class="sm-contour" cx="620" cy="400" rx="90" ry="56" fill="none" stroke="rgba(0,194,255,.4)" stroke-width="1" />
        <ellipse class="sm-contour" cx="460" cy="260" rx="90" ry="56" fill="none" stroke="rgba(0,194,255,.22)" stroke-width="1" />
      </g>

      <!-- 旗界双线（对流流动） -->
      <g fill="none">
        <path
          class="sm-flow"
          d="M330 170 L520 120 L740 150 L960 130 L1090 240 L1060 430 L940 560 L760 640 L560 660 L400 590 L300 440 L280 300 Z"
          stroke="rgba(0,255,224,.7)"
          stroke-width="1.6"
        />
        <path
          class="sm-flow slow"
          d="M338 182 L522 132 L738 162 L954 142 L1078 244 L1048 426 L932 552 L756 628 L562 648 L408 580 L312 440 L292 302 Z"
          stroke="rgba(0,194,255,.4)"
          stroke-width="1"
        />
        <path
          d="M330 170 L520 120 L740 150 L960 130 L1090 240 L1060 430 L940 560 L760 640 L560 660 L400 590 L300 440 L280 300 Z"
          fill="rgba(13,36,64,.25)"
          stroke="none"
        />
      </g>

      <!-- 水厂→苏木辐射管线（色=健康度 · 流动） -->
      <g fill="none" filter="url(#sm-glow)">
        <path class="sm-flow" d="M620 400 Q 520 300 430 250" stroke="#00ffe0" stroke-width="3" />
        <path class="sm-flow slow" d="M620 400 Q 760 320 860 260" stroke="#00c2ff" stroke-width="2.6" />
        <path class="sm-flow" d="M620 400 Q 480 420 400 430" stroke="#00c2ff" stroke-width="2.8" />
        <path class="sm-flow slow" d="M620 400 Q 780 420 890 440" stroke="#00ffe0" stroke-width="2.4" />
        <path class="sm-flow slow" d="M620 400 Q 540 540 500 570" stroke="#00c2ff" stroke-width="2.2" />
        <path class="sm-flow" d="M620 400 Q 740 540 800 560" stroke="#ffb454" stroke-width="2.4" />
      </g>

      <!-- 水厂枢纽 -->
      <g filter="url(#sm-glow)">
        <path d="M620 380 L637 390 L637 410 L620 420 L603 410 L603 390 Z" fill="rgba(0,255,224,.25)" stroke="#00ffe0" stroke-width="2" />
        <text class="sm-label" x="620" y="362" text-anchor="middle">第二水厂</text>
        <text class="sm-sub" x="620" y="348" text-anchor="middle">供水枢纽 · 1.2万m³/d</text>
      </g>

      <!-- 六苏木节点（真在线率 · <90% 挂告警脉冲环） -->
      <g v-for="n in spokes" :key="n.name">
        <circle :cx="n.ex" :cy="n.ey" r="6" :fill="nodeColor(n.value)" filter="url(#sm-glow)" />
        <circle v-if="n.value < 90" class="sm-ring" :cx="n.ex" :cy="n.ey" r="10" fill="none" stroke="#ffb454" stroke-width="1.6" />
        <text class="sm-label" :x="n.tx" :y="n.ty" text-anchor="middle" :fill="n.value < 90 ? '#ffb454' : undefined">{{ n.short }}</text>
        <text class="sm-sub" :x="n.tx" :y="n.ty + 14" text-anchor="middle">在线 {{ n.value.toFixed(0) }}%</text>
      </g>

      <!-- 监测小星 -->
      <g fill="#8FA8FF">
        <circle cx="530" cy="330" r="2.6" />
        <circle cx="700" cy="360" r="2.6" />
        <circle cx="580" cy="500" r="2.6" />
        <circle cx="740" cy="470" r="2.6" />
        <circle cx="470" cy="360" r="2.6" />
      </g>
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

/** 六节点锚点（设计稿 D 构图 · 节点/文字位置） */
const ANCHORS = [
  { ex: 430, ey: 250, tx: 430, ty: 228 },
  { ex: 860, ey: 260, tx: 860, ty: 238 },
  { ex: 400, ey: 430, tx: 370, ty: 410 },
  { ex: 890, ey: 440, tx: 924, ty: 418 },
  { ex: 500, ey: 570, tx: 462, ty: 598 },
  { ex: 800, ey: 560, tx: 828, ty: 590 },
];

const spokes = computed(() =>
  props.nodes.slice(0, 6).map((n, i) => ({
    ...n,
    short: n.name.length > 7 ? n.name.slice(0, 7) : n.name,
    ...ANCHORS[i],
  })),
);

function nodeColor(v: number): string {
  return v >= 90 ? '#00ffe0' : '#ffb454';
}
</script>

<style scoped>
.sm {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
.sm svg {
  width: 100%;
  height: 100%;
}

.sm-dots {
  animation: sm-dots-b 7s ease-in-out infinite;
}
@keyframes sm-dots-b {
  50% { opacity: 0.5; }
}

.sm-contour {
  transform-origin: 620px 400px;
  animation: sm-contour-p 8s ease-in-out infinite;
}
@keyframes sm-contour-p {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.62; }
}

.sm-flow {
  stroke-dasharray: 8 12;
  animation: sm-flow-move 2s linear infinite;
}
.sm-flow.slow {
  animation-duration: 3.2s;
}
@keyframes sm-flow-move {
  to { stroke-dashoffset: -20; }
}

.sm-ring {
  transform-origin: center;
  transform-box: fill-box;
  animation: sm-ring-p 2s ease-out infinite;
}
@keyframes sm-ring-p {
  from { transform: scale(0.5); opacity: 0.9; }
  to { transform: scale(2.4); opacity: 0; }
}

.sm-label {
  font-size: 12px;
  fill: #e8f1f8;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-weight: 600;
}
.sm-sub {
  font-size: 10px;
  fill: #9db2c6;
  font-family: 'Rajdhani', 'DIN Alternate', sans-serif;
}

@media (prefers-reduced-motion: reduce) {
  .sm-dots, .sm-contour, .sm-flow, .sm-ring { animation: none; }
}
</style>
