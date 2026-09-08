<template>
  <div class="micro-bar">
    <span class="mb-label">{{ label }}</span>
    <div class="mb-track">
      <i
        class="mb-fill"
        :style="{ width: pct + '%', background: color }"
      ></i>
    </div>
    <span class="mb-value num">
      {{ formatted }}<small v-if="unit" class="mb-unit">{{ unit }}</small>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value: number;
    /** 百分比上限；缺省按 100 处理 */
    max?: number;
    /** 0-1 小数；与 max 互斥，指定时按小数渲染百分比（如 0.982 → 98.2%） */
    asRatio?: boolean;
    unit?: string;
    color?: string;
    /** 小数位（默认 1） */
    decimals?: number;
  }>(),
  {
    max: 100,
    asRatio: false,
    unit: '%',
    color: 'var(--spring-green)',
    decimals: 1,
  },
);

const pct = computed(() => {
  const v = props.asRatio ? props.value * 100 : props.value;
  const m = props.asRatio ? 100 : props.max;
  return Math.max(0, Math.min(100, (v / m) * 100));
});

const formatted = computed(() => {
  const v = props.asRatio ? props.value * 100 : props.value;
  return v.toFixed(props.decimals);
});
</script>

<style scoped>
.micro-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  line-height: 1.2;
  padding: 6px 0;
}

.mb-label {
  flex: 0 0 72px;
  color: var(--text);
  font-family: var(--cn);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-track {
  flex: 1;
  height: 6px;
  background: var(--surface-blue);
  border-radius: 1px;
  overflow: hidden;
}

.mb-fill {
  display: block;
  height: 100%;
  transition: width 0.4s ease;
}

.mb-value {
  flex: 0 0 auto;
  min-width: 64px;
  text-align: right;
  font-family: var(--num);
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.mb-unit {
  font-family: var(--cn);
  font-size: 12px;
  color: var(--text-dim);
  margin-left: 1px;
  font-weight: 400;
}
</style>