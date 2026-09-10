<!--
  DashboardLayout.vue — 大屏三列弹性骨架（T1 弹性布局 · v8.2 全屏态）
  视觉标准：preview.html `main` 栅格 + design-system §5
  · 3 列（左 minmax(300px,5fr) / 中 minmax(0,14fr) / 右 minmax(300px,5fr)）
    × 2 行（中央 1fr / 趋势带 clamp(140px,14vh,176px) 通栏）
  · 左右列子项 max-width 440px（超宽屏防摊薄）
  · 全屏态（app.fullscreen）：左右列/趋势带隐藏，地图 cell 铺满
  · 槽位：left / map / right / trend（left、right 有默认业务组件）
-->
<template>
  <div class="screen">
    <main class="grid" :class="{ fullscreen }">
      <div v-show="!fullscreen" class="col col-l fs-out fs-out-l">
        <slot name="left">
          <CockpitPanel />
        </slot>
      </div>

      <section class="cell-map">
        <slot name="map" />
      </section>

      <div v-show="!fullscreen" class="col col-r fs-out fs-out-r">
        <slot name="right">
          <AlertList />
          <MonitorPanel />
        </slot>
      </div>

      <section v-show="!fullscreen" class="cell-trend fs-out fs-out-t">
        <slot name="trend" />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '@stores/app';
import CockpitPanel from './pipe-network/CockpitPanel.vue';
import AlertList from './pipe-network/AlertList.vue';
import MonitorPanel from './pipe-network/MonitorPanel.vue';

const app = useAppStore();
const fullscreen = computed(() => app.fullscreen);
</script>

<style scoped>
.screen {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--well-deep);
  overflow: hidden;
}

.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 5fr) minmax(0, 14fr) minmax(300px, 5fr);
  grid-template-rows: 1fr clamp(140px, 14vh, 176px);
  gap: var(--panel-gap);
  padding: var(--panel-gap);
  transition: grid-template-columns 0.28s cubic-bezier(0.33, 1, 0.68, 1);
}

/* 全屏态：地图 cell 独占全部行列 */
.grid.fullscreen {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
}
.grid.fullscreen .cell-map {
  grid-row: 1;
  grid-column: 1;
}

.col {
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
  min-height: 0;
  min-width: 0;
  grid-row: 1;
}
.col-l { grid-column: 1; }
.col-r { grid-column: 3; }

/* 左右列子项：超宽屏防摊薄 */
.col > * {
  width: 100%;
  max-width: 440px;
  min-height: 0;
}

/* 中央一张图（地图即主角 §1） */
.cell-map {
  grid-row: 1;
  grid-column: 2;
  position: relative;
  overflow: hidden;
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  background: radial-gradient(
    ellipse 70% 60% at 50% 45%,
    #0e2a4a 0%,
    var(--surface-blue) 45%,
    var(--well-deep) 100%
  );
  transition: border-color 0.28s ease, border-radius 0.28s ease;
}
/* 全屏态地图去边框圆角，真正满幅 */
.grid.fullscreen .cell-map {
  border-color: transparent;
  border-radius: 0;
}

/* 底部趋势带通栏 */
.cell-trend {
  grid-row: 2;
  grid-column: 1 / -1;
  min-height: 0;
  display: flex;
}
.cell-trend > :deep(*) { flex: 1; min-width: 0; }

/* 全屏离场过渡（v-show 前的 280ms 退场由父级 v-show 延迟处理不可行 →
   采用「显隐 + grid 列宽过渡」组合：列宽动画承担主要过渡感知） */
.fs-out {
  transition: opacity 0.28s cubic-bezier(0.33, 1, 0.68, 1), transform 0.28s cubic-bezier(0.33, 1, 0.68, 1);
}
</style>
