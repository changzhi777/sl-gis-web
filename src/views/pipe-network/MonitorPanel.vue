<!--
  MonitorPanel.vue — 右列下半：水质·在线 / 运维效能
  视觉标准：preview.html `.micro` 两块面板
  · 每块 3 条微型条（Track D MicroBar）+ 同比 delta 按「好坏」着色
-->
<template>
  <div class="monitor">
    <Panel title="水质 · 在线" sub="24h">
      <div class="rows">
        <div v-for="it in quality" :key="it.label" class="mrow">
          <MicroBar
            class="bar"
            :label="it.label"
            :value="it.value"
            :color="it.color"
            unit="%"
          />
          <span v-if="it.delta !== undefined" class="delta num" :class="it.good ? 'good' : 'bad'">
            {{ it.delta >= 0 ? '↑' : '↓' }}{{ Math.abs(it.delta).toFixed(1) }}
          </span>
        </div>
      </div>
    </Panel>

    <Panel title="运维效能" sub="本月">
      <div class="rows">
        <div v-for="it in ops" :key="it.label" class="mrow">
          <MicroBar
            class="bar"
            :label="it.label"
            :value="it.value"
            :color="it.color"
            unit="%"
          />
          <span v-if="it.delta !== undefined" class="delta num" :class="it.good ? 'good' : 'bad'">
            {{ it.delta >= 0 ? '↑' : '↓' }}{{ Math.abs(it.delta).toFixed(1) }}
          </span>
        </div>
      </div>
    </Panel>
  </div>
</template>

<script setup lang="ts">
import Panel from '@ui/Panel.vue';
import MicroBar from '@charts/MicroBar.vue';

interface MicroItem {
  label: string;
  value: number;
  color: string;
  /** 同比变化（正=上升）；good 决定着色而非涨跌 */
  delta?: number;
  good?: boolean;
}

withDefaults(
  defineProps<{
    quality?: MicroItem[];
    ops?: MicroItem[];
  }>(),
  {
    quality: () => [
      { label: '水质合格率', value: 98.2, color: 'var(--spring-green)', delta: 0.4, good: true },
      { label: '设备在线率', value: 91.6, color: 'var(--flood-teal)', delta: -1.2, good: false },
      { label: '数据完整率', value: 96.4, color: '#7EE081', delta: 0.8, good: true },
    ],
    ops: () => [
      { label: '工单办结率', value: 87.5, color: 'var(--flood-teal)', delta: 2.6, good: true },
      { label: '水费收缴率', value: 76.3, color: 'var(--steppe-amber)', delta: -0.9, good: false },
      // 产销差率下降是好事 → 好坏着色与涨跌解耦
      { label: '产销差率', value: 18.1, color: '#FF7A9E', delta: -1.5, good: true },
    ],
  },
);
</script>

<style scoped>
.monitor {
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
  flex: 1.6;
  min-height: 0;
}
.monitor > .panel { flex: 1; }

.rows {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  min-height: 0;
}
.mrow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bar { flex: 1; min-width: 0; }
.delta {
  flex: none;
  width: 40px;
  text-align: right;
  font-size: 12px;
  font-weight: 600;
}
.delta.good { color: var(--spring-green); }
.delta.bad { color: var(--status-alarm); }
</style>
