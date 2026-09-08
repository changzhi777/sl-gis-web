<!--
  CockpitPanel.vue — 左列三面板（工程总览 / 供水保障 / 当日水量·电耗）
  视觉标准：preview.html 左列 + design-system §5
  · 工程总览：5 态横条 + 刻度纹理（Track D StatusBars）
  · 供水保障：2 大 KPI + 3 环图 + 目标刻度（Track D MiniRings）
  · 水量电耗：2 大 KPI + 双系列曲线（水量实线清泉绿 / 电耗虚线草原金）+ dot 图例
-->
<template>
  <div class="cockpit">
    <!-- 1 · 工程总览 -->
    <Panel title="工程总览" :sub="`${total} 处集中供水`">
      <StatusBars :items="statusItems" :total="total" />
    </Panel>

    <!-- 2 · 供水保障 -->
    <Panel title="供水保障" sub="覆盖情况">
      <div class="bigkpi">
        <KpiCard :value="population" unit="万人" label="供水人口" />
        <KpiCard :value="centralRate" unit="%" label="集中供水率" />
      </div>
      <div class="cap">
        覆盖 {{ villagesCovered }}/{{ villagesTotal }} 嘎查村 · {{ herderPoints }} 牧户网点
      </div>
      <div class="rings">
        <MiniRings :items="rings" />
      </div>
    </Panel>

    <!-- 3 · 当日水量 · 电耗 -->
    <Panel title="当日水量 · 电耗">
      <template #sub>
        <i class="dot solid" aria-hidden="true"></i>水量
        <i class="dot dashed" aria-hidden="true"></i>电耗
      </template>
      <div class="bigkpi">
        <KpiCard
          :value="supply"
          unit="万m³"
          label="供水量"
          :delta="supplyDelta"
          delta-direction="up"
          :is-good="true"
        />
        <KpiCard
          :value="power"
          unit="kWh"
          label="用电量"
          :delta="powerDelta"
          delta-direction="down"
          :is-good="true"
        />
      </div>
      <svg class="mini" viewBox="0 0 340 120" preserveAspectRatio="none" role="img" aria-label="水量电耗 24h 曲线">
        <line x1="0" y1="30" x2="330" y2="30" stroke="rgba(0,194,255,.08)" />
        <line x1="0" y1="65" x2="330" y2="65" stroke="rgba(0,194,255,.08)" />
        <text x="2" y="26" fill="var(--text-dim)" font-size="11">峰值 {{ peak }}</text>
        <polyline :points="waterPoly" fill="none" stroke="var(--spring-green)" stroke-width="2" />
        <polyline
          :points="powerPoly"
          fill="none"
          stroke="var(--steppe-amber)"
          stroke-width="1.5"
          stroke-dasharray="4 3"
        />
        <line x1="0" y1="110" x2="330" y2="110" stroke="rgba(0,194,255,.25)" />
      </svg>
      <div class="axis num">
        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
      </div>
    </Panel>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Status } from '@shared/types';
import Panel from '@ui/Panel.vue';
import KpiCard from '@ui/KpiCard.vue';
import StatusBars from '@charts/StatusBars.vue';
import MiniRings from '@charts/MiniRings.vue';

interface StatusItem {
  label: string;
  value: number;
  status: Status;
}
interface RingItem {
  name: string;
  value: number;
  target?: number;
  color?: string;
}

const props = withDefaults(
  defineProps<{
    statusItems?: StatusItem[];
    total?: number;
    population?: number;
    centralRate?: number;
    villagesCovered?: number;
    villagesTotal?: number;
    herderPoints?: number;
    rings?: RingItem[];
    supply?: number;
    supplyDelta?: number;
    power?: number;
    powerDelta?: number;
    /** 24h 供水量序列（m³/h） */
    waterSeries?: number[];
    /** 24h 用电序列（kWh） */
    powerSeries?: number[];
  }>(),
  {
    statusItems: () => [
      { label: '正常', value: 35, status: 'normal' },
      { label: '异常', value: 3, status: 'alarm' },
      { label: '检修', value: 2, status: 'repair' },
      { label: '停运', value: 1, status: 'stop' },
      { label: '离线', value: 5, status: 'offline' },
    ],
    total: 46,
    population: 5.8,
    centralRate: 68,
    villagesCovered: 71,
    villagesTotal: 73,
    herderPoints: 142,
    rings: () => [
      { name: '入户率', value: 81 },
      { name: '收缴率 · 目标85%', value: 76, target: 85 },
      { name: '巡检完成率', value: 72, color: 'var(--flood-teal)' },
    ],
    supply: 1.42,
    supplyDelta: 2.1,
    power: 3860,
    powerDelta: 1.4,
    waterSeries: () => [34, 38, 36, 45, 43, 52, 50, 58, 55, 61, 59, 63],
    powerSeries: () => [120, 128, 126, 140, 137, 150, 147, 158, 155, 166, 163, 170],
  },
);

const VB_W = 330;

/** 序列 → polyline（min-max 归一到 [bottom, top] 带内） */
function poly(data: number[], top: number, bottom: number): string {
  const n = data.length;
  if (n === 0) return '';
  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  return data
    .map((v, i) => {
      const x = n === 1 ? VB_W / 2 : (i / (n - 1)) * VB_W;
      const y = bottom - ((v - min) / span) * (bottom - top);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

const waterPoly = computed(() => poly(props.waterSeries, 30, 95));
const powerPoly = computed(() => poly(props.powerSeries, 68, 105));
const peak = computed(() =>
  props.waterSeries.length ? Math.max(...props.waterSeries) : 0,
);
</script>

<style scoped>
.cockpit {
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
  flex: 1;
  min-height: 0;
}
.cockpit > .panel:nth-child(1) { flex: 0.9; }
.cockpit > .panel:nth-child(2) { flex: 1; }
.cockpit > .panel:nth-child(3) { flex: 1; }

.bigkpi {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  flex: none;
}
.cap {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 6px;
  flex: none;
}
.rings {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: 0;
}

/* 标题内 dot 图例（实线=水量 / 虚线=电耗） */
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 2px;
  vertical-align: -1px;
}
.dot.solid { background: var(--spring-green); }
.dot.dashed { background: transparent; border: 1.5px dashed var(--steppe-amber); }
.dot + .dot { margin-left: 8px; }

.mini {
  width: 100%;
  flex: 1;
  min-height: 0;
}
.axis {
  display: flex;
  justify-content: space-between;
  color: var(--text-dim);
  font-size: 12px;
  padding: 0 2px;
  flex: none;
}
</style>
