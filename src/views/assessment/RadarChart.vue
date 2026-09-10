<!--
  RadarChart.vue — 考核六维雷达图（views/assessment 页内小组件）
  封装模式与 @charts/TrendLine.vue 一致：tree-shake 注册 + water-tech 主题
  + ResizeObserver resize + onBeforeUnmount dispose + watch 数据重渲染
  主题色：flood-teal #00C2FF（描线）/ spring-green #00FFE0（顶点与数值）
-->
<template>
  <div ref="root" class="radar-chart" :style="containerStyle" :data-theme="theme"></div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { RadarChart as EChartsRadar } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  registerWaterTechTheme,
  WATER_TECH_THEME_NAME,
} from '@charts/theme/water-tech';

// 一次性 tree-shake 友好注册（radar 图 install 自带雷达坐标系）
echarts.use([EChartsRadar, TooltipComponent, CanvasRenderer]);
registerWaterTechTheme(echarts);

interface RadarIndicator {
  /** 维度名 */
  name: string;
  /** 刻度上限 */
  max: number;
}

const props = withDefaults(
  defineProps<{
    /** 各维度定义 */
    indicators: RadarIndicator[];
    /** 各维度得分（与 indicators 一一对应） */
    values: number[];
    /** 系列名（tooltip 标题） */
    name?: string;
    /** 容器高度（像素） */
    height?: number;
    /** ECharts 主题名，默认 water-tech */
    theme?: string;
  }>(),
  {
    name: '本期得分',
    height: 250,
    theme: WATER_TECH_THEME_NAME,
  },
);

const root = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let ro: ResizeObserver | null = null;

const containerStyle = computed(() => ({
  width: '100%',
  height: `${props.height}px`,
}));

function buildOption(): echarts.EChartsCoreOption {
  return {
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: 'rgba(3, 8, 18, .92)',
      borderColor: 'rgba(0, 194, 255, .18)',
      borderWidth: 1,
      textStyle: { color: '#E8F1F8', fontSize: 12 },
    },
    radar: {
      indicator: props.indicators,
      shape: 'polygon' as const,
      radius: '62%',
      center: ['50%', '52%'],
      splitNumber: 4,
      axisName: {
        color: '#9DB2C6',
        fontSize: 12,
        fontFamily: "'Noto Sans SC', sans-serif",
      },
      axisLine: { lineStyle: { color: 'rgba(0, 194, 255, .22)' } },
      splitLine: {
        lineStyle: {
          color: [
            'rgba(0, 194, 255, .08)',
            'rgba(0, 194, 255, .12)',
            'rgba(0, 194, 255, .16)',
            'rgba(0, 194, 255, .22)',
          ],
        },
      },
      splitArea: {
        areaStyle: {
          color: [
            'rgba(12, 35, 64, 0)',
            'rgba(12, 35, 64, .45)',
            'rgba(12, 35, 64, 0)',
            'rgba(12, 35, 64, .35)',
          ],
        },
      },
    },
    series: [
      {
        type: 'radar' as const,
        name: props.name,
        symbol: 'circle' as const,
        symbolSize: 5,
        data: [
          {
            value: props.values,
            name: props.name,
            lineStyle: { color: '#00C2FF', width: 2 },
            itemStyle: { color: '#00FFE0', borderColor: '#030812', borderWidth: 1.5 },
            areaStyle: { color: 'rgba(0, 194, 255, .22)' },
            label: {
              show: true,
              color: '#00FFE0',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'Rajdhani',
              formatter: (p: { value: number }) => String(p.value),
            },
          },
        ],
      },
    ],
  };
}

function render(): void {
  if (!chart) return;
  chart.setOption(buildOption(), { notMerge: true });
}

onMounted(() => {
  if (!root.value) return;
  chart = echarts.init(root.value, props.theme);
  render();
  ro = new ResizeObserver(() => chart?.resize());
  ro.observe(root.value);
});

onBeforeUnmount(() => {
  if (ro) {
    ro.disconnect();
    ro = null;
  }
  if (chart) {
    chart.dispose();
    chart = null;
  }
});

watch(
  () => [props.indicators, props.values, props.name, props.height, props.theme],
  () => render(),
  { deep: true },
);
</script>

<style scoped>
.radar-chart {
  position: relative;
}
</style>
