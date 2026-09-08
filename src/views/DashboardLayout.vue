<!--
  DashboardLayout.vue — 1920×1080 九宫格骨架
  视觉标准：preview.html `main` 栅格 + design-system §5
  · v-scale-screen 等比缩放（不自研）
  · 3 列（左 400 / 中 flex / 右 400）× 2 行（中央 1fr / 趋势带 176px 通栏）
  · 槽位：top / left / map / right / trend（left、right、top 有默认业务组件）
-->
<template>
  <VScaleScreen
    :width="1920"
    :height="1080"
    :full-screen="false"
    :box-style="{ background: '#030812' }"
  >
    <div class="screen">
      <slot name="top">
        <TopBar />
      </slot>

      <main class="grid">
        <div class="col col-l">
          <slot name="left">
            <CockpitPanel />
          </slot>
        </div>

        <section class="cell-map">
          <slot name="map" />
        </section>

        <div class="col col-r">
          <slot name="right">
            <AlertList />
            <MonitorPanel />
          </slot>
        </div>

        <section class="cell-trend">
          <slot name="trend" />
        </section>
      </main>
    </div>
  </VScaleScreen>
</template>

<script setup lang="ts">
import VScaleScreen from 'v-scale-screen';
import TopBar from '@ui/TopBar.vue';
import CockpitPanel from './pipe-network/CockpitPanel.vue';
import AlertList from './pipe-network/AlertList.vue';
import MonitorPanel from './pipe-network/MonitorPanel.vue';
</script>

<style scoped>
.screen {
  width: 1920px;
  height: 1080px;
  display: flex;
  flex-direction: column;
  background: var(--well-deep);
  overflow: hidden;
}

.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 400px 1fr 400px;
  grid-template-rows: 1fr 176px;
  gap: var(--panel-gap);
  padding: var(--panel-gap);
}

.col {
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
  min-height: 0;
  grid-row: 1;
}
.col-l { grid-column: 1; }
.col-r { grid-column: 3; }

/* 中央 WebGL 一张图（地图即主角 §1） */
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
}

/* 底部趋势带通栏 */
.cell-trend {
  grid-row: 2;
  grid-column: 1 / -1;
  min-height: 0;
  display: flex;
}
.cell-trend > :deep(*) { flex: 1; min-width: 0; }
</style>
