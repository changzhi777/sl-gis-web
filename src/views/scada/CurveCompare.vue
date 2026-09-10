<!--
  CurveCompare.vue — 多测点 24h 曲线对比（SCADA 中列上）
  · 同类型测点叠加（最多 4 条，选择逻辑在父级 Dashboard）
  · 网格线（water-tech 主题 valueAxis splitLine）+ 末点当前值标注 + 阈值虚线（markLine dashed）
  · 不复用 TrendLine：其 series 样式内建、无 markLine 阈值线能力；本组件直用 echarts/core
    并注册同一 water-tech 主题，视觉与 @charts 体系同源
  · 阈值口径：压力越上限 0.45 MPa · 流量 180 m³/h · 浊度国标 ≤1 NTU · 液位 4.5 m
-->
<template>
  <div class="cc">
    <div ref="hostEl" class="chart-host">
      <div ref="chartEl" class="chart"></div>
    </div>
    <div v-if="points.length === 0" class="empty">
      请在左侧「测点选择」中点选测点<br />
      <span class="empty-sub">同类测点最多叠加 4 条，跨类型点击将切换对比组</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  registerWaterTechTheme,
  WATER_TECH_PALETTE,
  WATER_TECH_THEME_NAME,
} from '@charts/theme/water-tech';
import type { MonitorPoint } from '@shared/types';

// 一次性 tree-shake 友好注册（与 TrendLine 同套件）
echarts.use([LineChart, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, CanvasRenderer]);
registerWaterTechTheme(echarts);

const props = defineProps<{
  /** 已选测点（同一类型，由父级保证；最多 4） */
  points: MonitorPoint[];
}>();

/** 类型元数据：单位 / 阈值 / 小数位 */
const TYPE_META = {
  pressure: { unit: 'MPa', threshold: 0.45, decimals: 3 },
  flow: { unit: 'm³/h', threshold: 180, decimals: 1 },
  quality: { unit: 'NTU', threshold: 1, decimals: 2 },
  level: { unit: 'm', threshold: 4.5, decimals: 2 },
} as const;

const meta = computed(() => TYPE_META[props.points[0] ? props.points[0].type : 'pressure']);

/** MON-PRESSURE-007 → P-007（曲线图例短名） */
function shortId(m: MonitorPoint): string {
  const seg = m.id.split('-');
  return `${seg[1].charAt(0)}-${seg[2]}`;
}

const p2 = (n: number) => String(n).padStart(2, '0');
/** 144 个 10min 采样 → 00:00 … 23:50 */
const X_LABELS: string[] = Array.from({ length: 144 }, (_, i) => {
  const t = i * 10;
  return `${p2(Math.floor(t / 60))}:${p2(t % 60)}`;
});

const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let ro: ResizeObserver | null = null;

function buildOption(): echarts.EChartsCoreOption {
  const pts = props.points;
  const m = meta.value;
  const all: number[] = pts.flatMap((p) => p.history);
  const dataMax = all.length ? Math.max(...all) : m.threshold;
  const dataMin = all.length ? Math.min(...all) : 0;
  const yMax = +(Math.max(dataMax, m.threshold) * 1.12).toFixed(m.decimals);
  const yMin = +Math.max(0, dataMin * 0.85).toFixed(m.decimals);

  const series = pts.map((p, i) => {
    const color = WATER_TECH_PALETTE[i % WATER_TECH_PALETTE.length];
    const base = {
      name: shortId(p),
      type: 'line' as const,
      data: p.history,
      showSymbol: false,
      lineStyle: { color, width: 2 },
      itemStyle: { color, borderColor: '#030812', borderWidth: 1.5 },
      emphasis: { focus: 'series' as const },
      // 末点当前值标注
      label: {
        show: true,
        position: 'top' as const,
        distance: 6,
        color,
        fontFamily: 'Rajdhani',
        fontWeight: 600,
        fontSize: 13,
        formatter: (params: { dataIndex: number }) =>
          params.dataIndex === p.history.length - 1 ? String(p.value) : '',
      },
    };
    // 阈值虚线只挂在第一条系列，避免重复绘制
    if (i === 0) {
      return {
        ...base,
        markLine: {
          silent: true,
          symbol: 'none',
          data: [{ yAxis: m.threshold }],
          lineStyle: { color: '#FF5C5C', type: 'dashed' as const, width: 1.5 },
          label: {
            formatter: `阈值 ${m.threshold}`,
            position: 'insideEndTop' as const,
            color: '#FF5C5C',
            fontSize: 11,
            fontFamily: 'Rajdhani',
          },
        },
      };
    }
    return base;
  });

  return {
    grid: { left: 8, right: 24, top: 32, bottom: 4, containLabel: true },
    legend: {
      top: 2,
      left: 8,
      itemWidth: 10,
      itemHeight: 4,
      itemGap: 16,
      icon: 'rect',
      textStyle: { color: '#9DB2C6', fontSize: 12 },
    },
    tooltip: { trigger: 'axis' as const },
    xAxis: {
      type: 'category' as const,
      data: X_LABELS,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      // 144 点每 24 个显示一个刻度（每 4h）
      axisLabel: {
        interval: (i: number) => i % 24 === 0,
        color: '#9DB2C6',
        fontSize: 11,
        fontFamily: 'Rajdhani',
        margin: 10,
      },
    },
    yAxis: {
      type: 'value' as const,
      min: yMin,
      max: yMax,
      name: m.unit,
      nameTextStyle: { color: '#9DB2C6', fontSize: 11, align: 'right' as const, padding: [0, 4, 0, 0] },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#9DB2C6',
        fontSize: 11,
        fontFamily: 'Rajdhani',
        formatter: (v: number) => v.toFixed(m.decimals > 1 ? 1 : m.decimals),
      },
      // 网格线（water-tech 同源淡青）
      splitLine: { show: true, lineStyle: { color: 'rgba(0, 194, 255, 0.08)' } },
    },
    series,
  };
}

function render() {
  if (!chart) return;
  chart.setOption(buildOption(), { notMerge: true });
}

onMounted(() => {
  if (!chartEl.value) return;
  chart = echarts.init(chartEl.value, WATER_TECH_THEME_NAME);
  render();
  ro = new ResizeObserver(() => chart?.resize());
  ro.observe(chartEl.value);
});

onBeforeUnmount(() => {
  ro?.disconnect();
  ro = null;
  if (chart) {
    chart.dispose();
    chart = null;
  }
});

watch(() => props.points, () => render(), { deep: true });
</script>

<style scoped>
.cc {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}
.chart-host {
  position: relative;
  flex: 1;
  min-height: 0;
}
.chart {
  position: absolute;
  inset: 0;
}
.empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: var(--text-dim);
  font-size: 14px;
  line-height: 1.6;
  pointer-events: none;
}
.empty-sub {
  font-size: 12px;
  opacity: 0.75;
}
</style>
