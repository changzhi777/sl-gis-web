<!--
  CityToggle.vue — 3D 镇区建筑群开关 + 密度滑杆（地图右上浮动）
  视觉标准：preview.html `.mapctrl` 按钮语言 + design-system §12
  状态由父级（主 agent stores/layers.ts）持有：v-model:enabled / v-model:density
-->
<template>
  <div class="city-toggle" role="group" aria-label="镇区建筑群">
    <button
      class="btn"
      type="button"
      :class="{ on: enabled }"
      :aria-pressed="enabled"
      @click="emit('update:enabled', !enabled)"
    >
      ◧ 镇区建筑群 {{ enabled ? '开' : '关' }}
    </button>

    <div class="dense" :class="{ dim: !enabled }">
      <input
        class="rng"
        type="range"
        min="0"
        max="2"
        step="1"
        :value="idx"
        :disabled="!enabled"
        aria-label="建筑群密度"
        @input="onRange"
      />
      <div class="ticks">
        <span
          v-for="(lv, i) in LEVELS"
          :key="lv"
          :class="{ cur: i === idx }"
          @click="enabled && emit('update:density', lv)"
          >{{ LABELS[i] }}</span
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Density = 'low' | 'mid' | 'high';

const LEVELS: Density[] = ['low', 'mid', 'high'];
const LABELS = ['疏', '中', '密'];

const props = withDefaults(
  defineProps<{
    enabled?: boolean;
    density?: Density;
  }>(),
  { enabled: true, density: 'mid' },
);

const emit = defineEmits<{
  (e: 'update:enabled', v: boolean): void;
  (e: 'update:density', v: Density): void;
}>();

const idx = computed(() => Math.max(0, LEVELS.indexOf(props.density)));

function onRange(ev: Event) {
  const i = Number((ev.target as HTMLInputElement).value);
  emit('update:density', LEVELS[Math.min(2, Math.max(0, i))]);
}
</script>

<style scoped>
.city-toggle {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(3, 8, 18, 0.78);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  padding: 8px 10px;
  backdrop-filter: blur(4px);
  width: 148px;
}
.btn {
  background: rgba(7, 21, 37, 0.85);
  border: var(--border-w) solid var(--line-vein);
  color: var(--text-dim);
  font-size: 12px;
  padding: 5px 10px;
  border-radius: var(--radius);
  cursor: pointer;
  font-family: var(--cn);
  transition: color 0.15s ease, border-color 0.15s ease;
}
.btn:hover {
  color: var(--text);
  border-color: rgba(0, 194, 255, 0.45);
}
.btn.on {
  color: var(--spring-green);
  border-color: rgba(0, 255, 224, 0.4);
}

.dense { transition: opacity 0.18s ease; }
.dense.dim { opacity: 0.4; }

.rng {
  width: 100%;
  height: 14px;
  margin: 2px 0 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}
.rng::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 1px;
  background: repeating-linear-gradient(
    90deg,
    var(--surface-blue) 0 43px,
    rgba(0, 194, 255, 0.25) 43px 44px
  );
}
.rng::-webkit-slider-thumb {
  appearance: none;
  width: 10px;
  height: 10px;
  margin-top: -3px;
  border-radius: 1px;
  background: var(--flood-teal);
  box-shadow: 0 0 6px rgba(0, 194, 255, 0.6);
}
.rng:disabled::-webkit-slider-thumb { background: var(--status-stop); box-shadow: none; }
.rng::-moz-range-track { height: 4px; background: var(--surface-blue); }
.rng::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: none;
  border-radius: 1px;
  background: var(--flood-teal);
}

.ticks {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-dim);
}
.ticks span { cursor: pointer; }
.ticks .cur { color: var(--flood-teal); }

.btn:focus-visible,
.rng:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: 2px;
}
</style>
