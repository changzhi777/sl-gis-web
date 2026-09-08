<template>
  <div class="mini-rings" :style="{ width: '100%' }">
    <svg
      :viewBox="`0 0 ${svgW} ${svgH}`"
      :width="svgW"
      :height="svgH"
      role="img"
      aria-label="环图"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- 底部 5 状态说明文本 -->
      <text
        v-for="(it, i) in items"
        :key="`cap-${i}`"
        :x="centerX(i)"
        :y="svgH - 4"
        text-anchor="middle"
        fill="var(--text-dim)"
        font-size="11"
        font-family="'Noto Sans SC', sans-serif"
      >
        {{ it.name }}
      </text>

      <g v-for="(it, i) in items" :key="`g-${i}`">
        <!-- 背景环（沉底色） -->
        <circle
          :cx="centerX(i)"
          :cy="cy"
          :r="r"
          fill="none"
          stroke="var(--surface-blue)"
          stroke-width="10"
        />
        <!-- 主环（按比例） -->
        <circle
          :cx="centerX(i)"
          :cy="cy"
          :r="r"
          fill="none"
          :stroke="ringColor(it)"
          stroke-width="10"
          stroke-linecap="butt"
          :stroke-dasharray="`${dashFilled(it)} ${circumference}`"
          :transform="`rotate(-90 ${centerX(i)} ${cy})`"
        />
        <!-- 目标刻度线（短白线） -->
        <line
          v-if="it.target !== undefined"
          :x1="targetX1(i)"
          :y1="targetY1(i)"
          :x2="targetX2(i)"
          :y2="targetY2(i)"
          stroke="var(--text)"
          stroke-width="2"
          stroke-linecap="round"
        />
        <!-- 环心数字（Rajdhani 22px · dominant-baseline central） -->
        <text
          :x="centerX(i)"
          :y="cy"
          text-anchor="middle"
          dominant-baseline="central"
          fill="var(--text)"
          font-size="22"
          font-weight="600"
          font-family="'Rajdhani', sans-serif"
        >{{ Math.round(it.value) }}%</text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface RingItem {
  name: string;
  /** 0-100 的百分比 */
  value: number;
  /** 目标值（0-100）。存在则画白线刻度 */
  target?: number;
  /** 环色（CSS 变量或 hex） */
  color?: string;
}

const props = withDefaults(
  defineProps<{
    items: RingItem[];
    /** 环半径（SVG viewBox 单位） */
    radius?: number;
    /** 单环左右间距（viewBox 单位） */
    gap?: number;
    /** 高度（viewBox） */
    height?: number;
  }>(),
  { radius: 32, gap: 32, height: 110 },
);

const r = computed(() => props.radius);
const cy = computed(() => props.height / 2 - 6);
const svgH = computed(() => props.height);
const circumference = computed(() => 2 * Math.PI * r.value);

const svgW = computed(() => {
  const n = Math.max(1, props.items.length);
  return Math.round(props.radius * 2 + (n - 1) * (props.radius * 2 + props.gap));
});

function centerX(i: number): number {
  return Math.round(r.value + i * (r.value * 2 + props.gap));
}

function dashFilled(it: RingItem): number {
  const pct = Math.max(0, Math.min(100, it.value)) / 100;
  return Number((circumference.value * pct).toFixed(3));
}

/** 数值低于目标时环色用 steppe-amber */
function ringColor(it: RingItem): string {
  if (it.target !== undefined && it.value < it.target) {
    return 'var(--steppe-amber)';
  }
  return it.color ?? 'var(--spring-green)';
}

/** 目标刻度短线端点计算（target% 位置） */
function targetX1(i: number): number {
  const cx = centerX(i);
  const ang = (Math.max(0, Math.min(100, props.items[i].target ?? 0)) / 100) * 2 * Math.PI - Math.PI / 2;
  // 内端：r - 8
  return cx + (r.value - 8) * Math.cos(ang);
}
function targetY1(i: number): number {
  return cy.value + (r.value - 8) * Math.sin(angFor(i));
}
function targetX2(i: number): number {
  const cx = centerX(i);
  const ang = angFor(i);
  // 外端：r + 2
  return cx + (r.value + 2) * Math.cos(ang);
}
function targetY2(i: number): number {
  return cy.value + (r.value + 2) * Math.sin(angFor(i));
}
function angFor(i: number): number {
  const pct = Math.max(0, Math.min(100, props.items[i].target ?? 0)) / 100;
  return pct * 2 * Math.PI - Math.PI / 2;
}
</script>

<style scoped>
.mini-rings {
  width: 100%;
}
.mini-rings svg {
  width: 100%;
  height: auto;
  display: block;
}
</style>