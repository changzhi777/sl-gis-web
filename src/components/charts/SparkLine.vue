<template>
  <div class="spark-line" :style="{ height: height + 'px' }">
    <svg
      :viewBox="`0 0 ${vbW} ${vbH}`"
      preserveAspectRatio="none"
      role="img"
      aria-label="趋势火花线"
    >
      <!-- 2 条网格水平线 -->
      <line :x1="0" :y1="vbH * 0.3" :x2="vbW" :y2="vbH * 0.3"
            stroke="rgba(0, 194, 255, .10)" stroke-width="1" />
      <line :x1="0" :y1="vbH * 0.7" :x2="vbW" :y2="vbH * 0.7"
            stroke="rgba(0, 194, 255, .10)" stroke-width="1" />

      <!-- 阈值虚线 -->
      <line
        v-if="thresholdY !== null"
        :x1="0"
        :y1="thresholdY"
        :x2="vbW"
        :y2="thresholdY"
        stroke="#FF5C5C"
        stroke-width="1"
        stroke-dasharray="3 3"
        opacity="0.55"
      />

      <!-- 折线主体 -->
      <polyline
        v-if="points.length > 1"
        :points="points"
        fill="none"
        :stroke="strokeColor"
        stroke-width="1.6"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- 端点圆点 -->
      <circle
        v-if="lastPoint"
        :cx="lastPoint.x"
        :cy="lastPoint.y"
        r="2.5"
        :fill="strokeColor"
        stroke="#030812"
        stroke-width="1"
      />

      <!-- 当前值文字 -->
      <text
        v-if="lastPoint"
        :x="lastPoint.x + 4"
        :y="lastPoint.y - 6"
        fill="var(--text)"
        font-size="11"
        font-family="'Rajdhani', sans-serif"
        font-weight="600"
      >{{ formattedCurrent }}{{ unit ? unit : '' }}</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 16-24 点序列 */
    data: number[];
    height?: number;
    /** 当前值（缺省取 data 末尾） */
    current?: number;
    unit?: string;
    /** 阈值（告警下界等）。存在则画虚线 */
    threshold?: number;
    /** 数据全部低于阈值时使用 steppe-amber */
    thresholdColor?: string;
    /** 默认 spring-green */
    color?: string;
    /** 缩放比例：y = vbH * (1 - (v - min) / (max - min)) */
  }>(),
  {
    height: 80,
    current: undefined,
    unit: '',
    threshold: undefined,
    thresholdColor: 'var(--steppe-amber)',
    color: 'var(--spring-green)',
  },
);

const vbW = 320;
const vbH = 80;

const stats = computed(() => {
  if (!props.data.length) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const v of props.data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  // 阈值纳入 y 轴上下界（避免虚线出界）
  if (props.threshold !== undefined) {
    if (props.threshold < min) min = props.threshold;
    if (props.threshold > max) max = props.threshold;
  }
  return { min, max };
});

function yOf(v: number): number {
  const { min, max } = stats.value;
  const pad = 8;
  const usable = vbH - pad * 2;
  const ratio = (v - min) / (max - min);
  return vbH - pad - ratio * usable;
}

const points = computed(() => {
  const n = props.data.length;
  if (n === 0) return '';
  const padX = 6;
  const usableW = vbW - padX * 2;
  return props.data
    .map((v, i) => {
      const x = padX + (n === 1 ? usableW / 2 : (i / (n - 1)) * usableW);
      const y = yOf(v);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
});

const lastPoint = computed(() => {
  const n = props.data.length;
  if (n === 0) return null;
  const padX = 6;
  const usableW = vbW - padX * 2;
  const x = padX + (n === 1 ? usableW / 2 : ((n - 1) / (n - 1)) * usableW);
  const y = yOf(props.data[n - 1]);
  return { x, y };
});

const thresholdY = computed(() => {
  if (props.threshold === undefined) return null;
  return yOf(props.threshold);
});

const strokeColor = computed(() => {
  if (props.threshold !== undefined) {
    const allBelow = props.data.every((v) => v < props.threshold!);
    if (allBelow) return props.thresholdColor;
  }
  return props.color;
});

const formattedCurrent = computed(() => {
  const v = props.current ?? (props.data.length ? props.data[props.data.length - 1] : 0);
  // 自动小数位：< 10 用 2 位，< 100 用 1 位，否则取整
  if (Math.abs(v) < 10) return v.toFixed(2);
  if (Math.abs(v) < 100) return v.toFixed(1);
  return String(Math.round(v));
});
</script>

<style scoped>
.spark-line {
  width: 100%;
}
.spark-line svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>