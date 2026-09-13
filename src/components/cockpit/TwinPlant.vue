<!--
  TwinPlant.vue — 厂区数字孪生主视觉（等轴测线框 · 数据驱动）
  · 净水车间/清水池/加压泵房/加药间 四主体 + 工艺管线流动 + 地台网格呼吸
  · 数据绑定：remoteNodes 苏木在线率（真 projects 聚合）· treat 净水参数（真监测点）· alarm 告警光柱（SSE）
  · 动效纪律：仅 stroke-dashoffset/transform/opacity · 常态动画 6 组（≤20 预算）
-->
<template>
  <div class="twin">
    <!-- MiniMax 生成视频背景层（muted 循环 · 加载失败静默回落纯 SVG） -->
    <video
      v-if="videoSrc && vidOk"
      ref="vid"
      class="twin-video"
      :src="videoSrc"
      autoplay
      muted
      loop
      playsinline
      @error="vidOk = false"
    />
    <svg viewBox="0 0 1180 760" role="img" aria-label="厂区数字孪生">
      <defs>
        <linearGradient id="tp-roof" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1a3a5c" stop-opacity=".92" />
          <stop offset="1" stop-color="#0d2440" stop-opacity=".95" />
        </linearGradient>
        <linearGradient id="tp-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#123052" stop-opacity=".85" />
          <stop offset="1" stop-color="#081728" stop-opacity=".92" />
        </linearGradient>
        <linearGradient id="tp-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#00c2ff" stop-opacity=".55" />
          <stop offset="1" stop-color="#005f8f" stop-opacity=".75" />
        </linearGradient>
        <radialGradient id="tp-plat" cx=".5" cy=".5" r=".55">
          <stop offset="0" stop-color="#00c2ff" stop-opacity=".18" />
          <stop offset="1" stop-color="#00c2ff" stop-opacity="0" />
        </radialGradient>
        <filter id="tp-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <!-- 地台辉光 + 等轴测网格（呼吸） -->
      <ellipse cx="590" cy="470" rx="470" ry="200" fill="url(#tp-plat)" />
      <g class="tp-grid" stroke="rgba(0,194,255,.14)" stroke-width="1">
        <path d="M190 500 L590 660 L990 500 L590 340 Z" fill="rgba(10,24,42,.5)" />
        <path
          d="M290 460 L690 620 M390 420 L790 580 M490 380 L890 540 M290 540 L690 700 M490 620 L890 460 M390 660 L790 500 M490 700 L890 540"
          opacity=".6"
        />
      </g>

      <!-- 远端辐射干线（水厂 → 苏木 · 流动） -->
      <g stroke="#00c2ff" stroke-width="2" fill="none" filter="url(#tp-glow)" opacity=".8">
        <path class="tp-flow" d="M830 350 Q 950 300 1080 320" />
        <path class="tp-flow slow" d="M850 420 Q 1010 430 1105 520" />
        <path class="tp-flow" d="M330 430 Q 190 400 90 430" />
        <path class="tp-flow slow" d="M350 520 Q 240 600 160 640" />
      </g>

      <!-- 远端苏木节点（真在线率） -->
      <g v-for="n in nodes" :key="n.name">
        <circle class="tp-node" :cx="n.x" :cy="n.y" r="6" :fill="nodeColor(n.value)" filter="url(#tp-glow)" />
        <text class="tp-label" :x="n.tx" :y="n.ty">{{ n.name }}</text>
        <text class="tp-val" :x="n.tx" :y="n.ty + 15" :fill="nodeColor(n.value)">{{ n.value.toFixed(1) }}%</text>
      </g>

      <!-- 净水车间（主体） -->
      <g>
        <path d="M400 300 L560 240 L680 290 L520 350 Z" fill="url(#tp-roof)" stroke="#00c2ff" stroke-width="1.2" stroke-opacity=".7" />
        <path d="M400 300 L400 390 L520 450 L520 350 Z" fill="url(#tp-wall)" stroke="#00c2ff" stroke-width="1" stroke-opacity=".55" />
        <path d="M520 350 L520 450 L680 390 L680 290 Z" fill="#0a1e36" stroke="#00c2ff" stroke-width="1" stroke-opacity=".45" />
        <path d="M440 330 L440 402 M480 346 L480 418 M440 330 L480 346 M440 402 L480 418" stroke="rgba(0,194,255,.4)" stroke-width="1" />
        <text class="tp-label" x="392" y="286">净水车间</text>
        <text class="tp-val" x="392" y="270">1.2万m³/d</text>
        <line class="tp-lline" x1="470" y1="292" x2="470" y2="316" />
      </g>

      <!-- 清水池（波动水面） -->
      <g>
        <path d="M700 430 L800 390 L900 430 L800 470 Z" fill="#0b2038" stroke="#00c2ff" stroke-width="1.2" stroke-opacity=".6" />
        <path class="tp-wave" d="M712 430 L800 396 L888 430 L800 464 Z" fill="url(#tp-water)" />
        <path d="M700 430 L700 452 L800 492 L900 452 L900 430 L800 470 Z" fill="#081728" stroke="#00c2ff" stroke-width="1" stroke-opacity=".5" />
        <text class="tp-label" x="906" y="418">清水池</text>
        <text class="tp-val" x="906" y="434">{{ poolLevel }}%</text>
      </g>

      <!-- 加压泵房 -->
      <g>
        <path d="M560 480 L680 432 L760 466 L640 514 Z" fill="url(#tp-roof)" stroke="#00c2ff" stroke-width="1.2" stroke-opacity=".7" />
        <path d="M560 480 L560 540 L640 574 L640 514 Z" fill="url(#tp-wall)" stroke="#00c2ff" stroke-width="1" stroke-opacity=".55" />
        <path d="M640 514 L640 574 L760 526 L760 466 Z" fill="#0a1e36" stroke="#00c2ff" stroke-width="1" stroke-opacity=".45" />
        <text class="tp-label" x="556" y="596">加压泵房 · 3机组</text>
        <text class="tp-val" x="556" y="612">2运1备</text>
      </g>

      <!-- 加药间（余氯真值） -->
      <g>
        <path d="M300 500 L400 460 L470 490 L370 530 Z" fill="url(#tp-roof)" stroke="#00c2ff" stroke-width="1" stroke-opacity=".6" />
        <path d="M300 500 L300 546 L370 576 L370 530 Z" fill="url(#tp-wall)" stroke="#00c2ff" stroke-width="1" stroke-opacity=".5" />
        <path d="M370 530 L370 576 L470 536 L470 490 Z" fill="#0a1e36" stroke="#00c2ff" stroke-width="1" stroke-opacity=".4" />
        <text class="tp-label" x="292" y="600">加药间</text>
        <text class="tp-val" x="292" y="616">{{ dosing }}</text>
      </g>

      <!-- 厂内工艺管线（流动） -->
      <g stroke="#7ee081" stroke-width="2.4" fill="none" filter="url(#tp-glow)" opacity=".9">
        <path class="tp-flow" d="M520 350 Q 600 400 700 428" />
        <path class="tp-flow" d="M800 470 Q 760 520 700 500" />
        <path class="tp-flow slow" d="M680 300 Q 640 380 660 430" />
      </g>

      <!-- 告警光柱（未签收告警时亮起） -->
      <g v-if="alarm" class="tp-beacon">
        <path d="M470 418 L466 340 L474 340 L470 418" fill="rgba(255,111,82,.55)" filter="url(#tp-glow)" />
        <circle cx="470" cy="336" r="4" fill="#ff6f52" />
      </g>

      <!-- 底注 -->
      <text x="590" y="740" text-anchor="middle" class="tp-label" opacity=".8">
        {{ plantName }} · 数字孪生（等轴测线框 · 实时工艺参数叠加）
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

export interface TwinNode {
  name: string;
  value: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

const vid = ref<HTMLVideoElement | null>(null);
const vidOk = ref(true);

/** public 资源必须带 BASE_URL 前缀（子路径部署 /sl-gis/） */
const videoSrc = computed(() => (props.video ? `${import.meta.env.BASE_URL}${props.video.replace(/^\//, '')}` : ''));

const props = withDefaults(
  defineProps<{
    /** 远端苏木节点（真在线率 · 已含锚点坐标） */
    nodes?: TwinNode[];
    /** 加药间标签（真水质口径 · 如「水质 98.2%」） */
    dosing?: string;
    /** 清水池液位 % */
    poolLevel?: number;
    /** 存在未签收告警 */
    alarm?: boolean;
    plantName?: string;
    /** MiniMax 生成视频背景（public 相对路径 · 加载失败回落纯 SVG） */
    video?: string;
  }>(),
  {
    nodes: () => [
      { name: '乌日根塔拉', value: 92.1, x: 1080, y: 320, tx: 1092, ty: 315 },
      { name: '朱日和镇', value: 93.4, x: 1105, y: 520, tx: 1046, ty: 546 },
      { name: '额仁淖尔', value: 86.3, x: 90, y: 430, tx: 52, ty: 410 },
      { name: '桑宝拉格', value: 88.7, x: 160, y: 640, tx: 118, ty: 666 },
    ],
    dosing: '运行正常',
    poolLevel: 82,
    alarm: false,
    plantName: '苏尼特右旗第二水厂',
    video: '',
  },
);

/** 设计稿锚点里额仁淖尔/桑宝拉格的文字在节点上方/下方错位排布 */
const nodes = computed(() => props.nodes);

function nodeColor(v: number): string {
  return v >= 90 ? '#00ffe0' : '#ffb454';
}
</script>

<style scoped>
.twin { position: relative; width: 100%; height: 100%; display: grid; place-items: center; overflow: hidden; }
.twin svg { width: min(92%, 1180px); height: 92%; position: relative; z-index: 1; }

/* 视频背景层：暗化融合，SVG 标注保持可读 */
.twin-video {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; opacity: 0.55; filter: saturate(1.05);
  pointer-events: none;
}

.tp-grid { animation: tp-gridfade 6s ease-in-out infinite; }
@keyframes tp-gridfade { 50% { opacity: 0.55; } }

.tp-flow { stroke-dasharray: 10 14; animation: tp-flowmove 1.6s linear infinite; }
.tp-flow.slow { animation-duration: 2.6s; }
@keyframes tp-flowmove { to { stroke-dashoffset: -24; } }

.tp-wave { animation: tp-wave 4s ease-in-out infinite; }
@keyframes tp-wave { 50% { transform: translateY(2px); } }

.tp-beacon { animation: tp-beacon 2.4s ease-in-out infinite; }
@keyframes tp-beacon { 50% { opacity: 0.25; } }

.tp-node { animation: tp-nodep 2.8s ease-in-out infinite; }
.tp-node:nth-of-type(2n) { animation-delay: 0.9s; }
@keyframes tp-nodep { 50% { opacity: 0.4; } }

.tp-label { font-size: 11px; fill: #9db2c6; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.tp-val { font-family: 'Rajdhani', 'DIN Alternate', sans-serif; font-weight: 700; font-size: 13px; fill: #00ffe0; }
.tp-lline { stroke: rgba(0, 194, 255, 0.35); stroke-width: 1; }

@media (prefers-reduced-motion: reduce) {
  .tp-grid, .tp-flow, .tp-wave, .tp-beacon, .tp-node { animation: none; }
}
</style>
