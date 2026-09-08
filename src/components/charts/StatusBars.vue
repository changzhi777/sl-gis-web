<template>
  <div class="status-bars">
    <div
      v-for="item in items"
      :key="item.status"
      class="sb-row"
    >
      <span class="sb-label">{{ item.label }}</span>
      <div class="sb-track">
        <i
          class="sb-fill"
          :class="`is-${item.status}`"
          :style="fillStyle(item)"
        ></i>
      </div>
      <span class="sb-value num" :class="`is-${item.status}`">
        {{ item.value }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Status } from '@shared/types';

interface StatusItem {
  label: string;
  value: number;
  status: Status | string;
}

const props = withDefaults(
  defineProps<{
    items: StatusItem[];
    /** 总数（用于宽度比例）；缺省按 max(items.value) */
    total?: number;
  }>(),
  { total: 0 },
);

/** 5 状态色 — 与 tokens.css §2.3 完全同源 */
const STATUS_FILL: Record<string, string> = {
  normal: 'var(--spring-green)',
  alarm: 'var(--status-alarm)',
  repair: 'var(--status-repair)',
  stop: 'var(--status-stop)',
  offline: 'var(--status-offline)',
};

const baseline = computed(() => {
  if (props.total > 0) return props.total;
  let m = 0;
  for (const it of props.items) if (it.value > m) m = it.value;
  return Math.max(m, 1);
});

function fillStyle(item: StatusItem) {
  const w = Math.max(4, (item.value / baseline.value) * 100);
  const color = STATUS_FILL[item.status] ?? 'var(--flood-teal)';
  return {
    width: `${w}%`,
    background: color,
  };
}
</script>

<style scoped>
.status-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.sb-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  line-height: 1.2;
  padding: 2px 0;
}

.sb-label {
  flex: 0 0 36px;
  color: var(--text-dim);
  font-family: var(--cn);
}

.sb-track {
  flex: 1;
  height: 10px;
  border-radius: 1px;
  overflow: hidden;
  position: relative;
  /* 刻度纹理（repeating-linear-gradient） */
  background: repeating-linear-gradient(
    90deg,
    var(--surface-blue) 0 19px,
    rgba(0, 194, 255, 0.10) 19px 20px
  );
}

.sb-fill {
  display: block;
  height: 100%;
  min-width: 4px;
  transition: width 0.4s ease;
  /* normal 行加 inset 蓝条（与 preview 同款） */
  box-shadow: none;
}

.sb-fill.is-normal {
  box-shadow: inset -2px 0 0 var(--flood-teal);
}

.sb-value {
  flex: 0 0 56px;
  text-align: right;
  font-family: var(--num);
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
}

/* 数字按状态着色 — normal 与 alarm 也用对应色，其余默认 text */
.sb-value.is-normal { color: var(--spring-green); }
.sb-value.is-alarm  { color: var(--status-alarm); }
.sb-value.is-repair { color: var(--status-repair); }
.sb-value.is-stop   { color: var(--status-stop); }
.sb-value.is-offline{ color: var(--status-offline); }
</style>