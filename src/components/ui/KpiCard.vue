<!--
  KpiCard.vue — KPI 数值卡
  视觉标准：preview.html `.bigkpi .b`（block）+ `header .k .item`（inline）
  · 数值 Rajdhani 34/26px + 单位 Noto Sans SC 12-13px
  · delta 按「好坏」着色（good=spring-green / bad=alarm-red），不是涨跌
  · 首次载入翻牌 2.5s（自研 rAF；countup.js 未装依赖，不引入新包）
  · prefers-reduced-motion → 直接终态（design-system §8）
-->
<template>
  <div class="kpi" :class="[`layout-${layout}`, { glow }]">
    <div class="v num">
      {{ display }}<small v-if="unit" class="u">{{ unit }}</small>
    </div>
    <div class="l">
      <span class="lt">{{ label }}</span>
      <span v-if="delta !== undefined" class="delta num" :class="isGood ? 'good' : 'bad'">
        {{ deltaDirection === 'up' ? '↑' : '↓' }}{{ Math.abs(delta).toFixed(deltaDecimals) }}%
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    value: number;
    unit?: string;
    label: string;
    /** 同比变化幅度（百分比，取绝对值显示） */
    delta?: number;
    /** 箭头方向 */
    deltaDirection?: 'up' | 'down';
    /** 这个变化是「好」还是「坏」— 决定着色，而非涨跌 */
    isGood?: boolean;
    /** 首次载入翻牌动画 */
    animated?: boolean;
    /** 小数位；缺省按 value 自身小数位 */
    decimals?: number;
    deltaDecimals?: number;
    /** block = 面板内大卡 / inline = 顶栏紧凑 */
    layout?: 'block' | 'inline';
    /** KPI 数字发光（design-system §4 发光预算：顶栏核心 KPI） */
    glow?: boolean;
  }>(),
  {
    unit: '',
    delta: undefined,
    deltaDirection: 'up',
    isGood: true,
    animated: true,
    decimals: undefined,
    deltaDecimals: 1,
    layout: 'block',
    glow: false,
  },
);

/** 翻牌时长：首次 2.5s（§8 动效预算），后续数据更新只滚动 420ms 不重播 */
const FIRST_MS = 2500;
const UPDATE_MS = 420;

const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const decimals = computed(() => {
  if (props.decimals !== undefined) return props.decimals;
  const s = String(props.value);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : Math.min(3, s.length - dot - 1);
});

const current = ref(props.animated && !reduced ? 0 : props.value);
let raf = 0;

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals.value,
    maximumFractionDigits: decimals.value,
  });
}

const display = computed(() => fmt(current.value));

function tween(from: number, to: number, ms: number) {
  if (raf) cancelAnimationFrame(raf);
  if (reduced || ms <= 0) {
    current.value = to;
    return;
  }
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ms);
    // easeOutCubic — 水表指针落位感
    const e = 1 - Math.pow(1 - p, 3);
    current.value = from + (to - from) * e;
    if (p < 1) raf = requestAnimationFrame(step);
    else {
      current.value = to;
      raf = 0;
    }
  };
  raf = requestAnimationFrame(step);
}

onMounted(() => {
  if (props.animated && !reduced) tween(0, props.value, FIRST_MS);
  else current.value = props.value;
});

watch(
  () => props.value,
  (next, prev) => tween(prev ?? 0, next, UPDATE_MS),
);

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf);
});
</script>

<style scoped>
.kpi {
  min-width: 0;
}
.v {
  font-weight: 600;
  line-height: 1.1;
  color: var(--text);
  white-space: nowrap;
}
.u {
  font-family: var(--cn);
  color: var(--text-dim);
  margin-left: 3px;
}
.l {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
}
.delta {
  font-weight: 600;
  font-size: 13px;
}
.delta.good { color: var(--spring-green); }
.delta.bad { color: var(--status-alarm); }

/* 面板内大卡 */
.layout-block .v { font-size: 34px; }
.layout-block .u { font-size: 13px; }

/* 顶栏紧凑 */
.layout-inline {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.layout-inline .v {
  font-size: 26px;
  font-weight: 700;
  color: var(--spring-green);
}
.layout-inline .u { font-size: 13px; }
.layout-inline .l { font-size: 12px; }

/* 发光预算：仅顶栏核心 KPI */
.glow .v {
  text-shadow: 0 0 12px rgba(0, 255, 224, 0.35);
}
</style>
