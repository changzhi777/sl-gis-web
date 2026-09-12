<!--
  FlipNumber.vue — 翻牌数字（DataV digital-flop 原理：RAF 插值 900ms easeOutCubic）
  用法：<FlipNumber :value="1234.5" :decimals="1" unit="万m³" label="当日供水量" color="#00FFE0" />
  值刷新事件驱动 · 静息 0 开销 · 千分位 toLocaleString
-->
<template>
  <div class="flip">
    <div class="flip-value num" :style="{ color, textShadow: `0 0 12px ${glow}` }">
      {{ display }}<small v-if="unit" class="u">{{ unit }}</small>
    </div>
    <div v-if="label" class="flip-label">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    value: number;
    decimals?: number;
    unit?: string;
    label?: string;
    color?: string;
  }>(),
  { decimals: 0, unit: '', label: '', color: '#00FFE0' },
);

const glow = ref('rgba(0,194,255,.8)');
const display = ref(format(props.value, props.decimals));

let rafId = 0;
const DURATION = 900;

function format(n: number, d: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** easeOutCubic 插值刷新 */
watch(
  () => props.value,
  (target) => {
    cancelAnimationFrame(rafId);
    const from = parseFloat(display.value.replace(/,/g, '')) || 0;
    const t0 = performance.now();
    const step = (now: number): void => {
      const p = Math.min(1, (now - t0) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      display.value = format(from + (target - from) * eased, props.decimals);
      if (p < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  },
);

onBeforeUnmount(() => cancelAnimationFrame(rafId));
</script>

<style scoped>
.flip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.flip-value {
  font-size: 34px;
  font-weight: 700;
  line-height: 1.1;
  white-space: nowrap;
}
.flip-value .u {
  font-family: var(--cn);
  font-size: 13px;
  font-weight: 400;
  color: var(--text-dim);
  margin-left: 4px;
}
.flip-label {
  font-size: 12px;
  color: var(--text-dim);
  letter-spacing: 1px;
}
</style>
