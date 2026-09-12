<!--
  RankingBoard.vue — 苏木多维凹凸榜（dv-scroll-ranking-board 原理：DOM 复制轮播）
  用法：<RankingBoard :rows="[{name, value, extra?}]" unit="分" />
  · waitTime 2500 · 收起 300ms · percent=(v-min)/(max-min) · 行内进度条 + shine 高光
  · rows ≤ 6 时静态展示（不轮播）
-->
<template>
  <div class="rb" @mouseenter="paused = true" @mouseleave="paused = false">
    <div class="rb-rows">
      <div v-for="(row, i) in viewRows" :key="`${row.name}-${i}`" class="rb-row" :class="{ out: row.out }">
        <span class="rb-rank num" :class="`rk-${Math.min(i, 4)}`">{{ i + 1 }}</span>
        <span class="rb-name">{{ row.name }}</span>
        <span class="rb-val num">{{ row.value.toFixed(1) }}<small>{{ unit }}</small></span>
        <div class="rb-track">
          <div class="rb-bar" :style="{ width: pct(row.value) + '%' }" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

interface Row {
  name: string;
  value: number;
  out?: boolean;
}

const props = withDefaults(defineProps<{ rows: Array<{ name: string; value: number }>; unit?: string }>(), {
  unit: '',
});

const paused = ref(false);
/** 视图行 = 排序后的行 + 轮播首位复制行（out 标记收起动画） */
const viewRows = ref<Array<Row & { out?: boolean }>>([]);
const timer = ref<ReturnType<typeof setTimeout> | null>(null);

const sorted = computed(() => [...props.rows].sort((a, b) => b.value - a.value));

function pct(v: number): number {
  const vals = viewRows.value.filter((r) => !r.out).map((r) => r.value);
  if (vals.length < 2) return 100;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  return Math.round(((v - min) / span) * 88 + 12);
}

/** 轮播：行数 > 5 时首位滑出尾部补入（DOM 复制法） */
function tick(): void {
  if (paused.value || sorted.value.length <= 5) return;
  viewRows.value = viewRows.value.map((r, i) => (i === 0 ? { ...r, out: true } : r));
  timer.value = setTimeout(() => {
    const [first, ...rest] = viewRows.value;
    viewRows.value = [...rest, { ...first, out: false }];
  }, 300);
}

function schedule(): void {
  if (timer.value) clearTimeout(timer.value);
  if (sorted.value.length > 5) timer.value = setTimeout(() => { tick(); schedule(); }, 2500);
}

watch(
  sorted,
  () => {
    viewRows.value = sorted.value.map((r) => ({ ...r }));
    schedule();
  },
  { immediate: true, deep: true },
);

onBeforeUnmount(() => {
  if (timer.value) clearTimeout(timer.value);
});
</script>

<style scoped>
.rb {
  height: 100%;
  overflow: hidden;
}
.rb-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rb-row {
  transition: all 0.3s ease;
  height: 52px;
  overflow: hidden;
}
.rb-row.out {
  height: 0;
  opacity: 0;
  margin-bottom: -6px;
}
.rb-rank {
  float: left;
  width: 28px;
  font-size: 15px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
}
.rk-0 { color: #00ffe0; }
.rk-1 { color: #00c2ff; }
.rk-2 { color: #7ee081; }
.rk-3, .rk-4 { color: var(--text-dim); }
.rb-name {
  display: block;
  margin-left: 34px;
  font-size: 13px;
  color: var(--text);
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rb-val {
  float: right;
  font-size: 14px;
  font-weight: 600;
  color: var(--spring-green);
  line-height: 20px;
}
.rb-val small { font-size: 11px; color: var(--text-dim); margin-left: 2px; }
.rb-track {
  clear: both;
  height: 6px;
  margin-top: 4px;
  background: rgba(19, 112, 251, 0.2);
  border-radius: 1px;
  position: relative;
  overflow: hidden;
}
.rb-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--flood-teal), rgba(0, 255, 224, 0.8));
  border-radius: 1px;
  transition: width 0.5s ease;
}
.rb-bar::after {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.35);
}
</style>
