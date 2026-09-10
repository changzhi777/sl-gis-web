<template>
  <div ref="root" class="trend-line" :style="containerStyle" :data-theme="themeName"></div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  registerWaterTechTheme,
  WATER_TECH_THEME_NAME,
} from './theme/water-tech';

// 一次性 tree-shake 友好的注册
echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);
registerWaterTechTheme(echarts);

interface TrendSeries {
  name: string;
  data: number[];
}

const props = withDefaults(
  defineProps<{
    /** 多系列数据 */
    series: TrendSeries[];
    /** x 轴刻度标签 */
    xLabels: string[];
    /** 容器高度（像素） */
    height?: number;
    /** ECharts 主题名，默认 water-tech */
    theme?: string;
    /** 是否平滑曲线 */
    smooth?: boolean;
    /** 是否填充 area（默认不填充，留给调用方） */
    area?: boolean;
    /** 是否显示图例 */
    showLegend?: boolean;
  }>(),
  {
    height: 200,
    theme: WATER_TECH_THEME_NAME,
    smooth: false,
    area: false,
    showLegend: true,
  },
);

const root = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

/** AppShell 提供的全局 resize 信号（侧栏折叠/窗口变化后 +150ms 自增） */
const contentResizeTick = inject<Ref<number>>('contentResizeTick', ref(0));

const containerStyle = computed(() => ({
  width: '100%',
  height: `${props.height}px`,
}));

const themeName = computed(() => props.theme);

/** 计算每个系列的端点标注（最后一个数据） */
function endPointAnnotations() {
  const result: Record<string, { value: number; seriesIndex: number }> = {};
  props.series.forEach((s, i) => {
    if (!s.data.length) return;
    result[s.name] = { value: s.data[s.data.length - 1], seriesIndex: i };
  });
  return result;
}

function buildOption(): echarts.EChartsCoreOption {
  const palette = ['#00C2FF', '#00FFE0', '#7EE081', '#FFB454', '#FF7A9E', '#8FA8FF'];
  const ends = endPointAnnotations();

  const seriesData = props.series.map((s, i) => {
    const color = palette[i % palette.length];
    return {
      name: s.name,
      type: 'line' as const,
      data: s.data,
      smooth: props.smooth,
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 5,
      itemStyle: {
        color,
        borderColor: '#030812',
        borderWidth: 1.5,
      },
      lineStyle: { color, width: 2 },
      emphasis: {
        focus: 'series' as const,
        lineStyle: { width: 3 },
      },
      ...(props.area
        ? {
            areaStyle: {
              color: {
                type: 'linear' as const,
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: color + '55' },
                  { offset: 1, color: color + '00' },
                ],
              },
            },
          }
        : {}),
      // 端点 label
      label: {
        show: true,
        position: 'top' as const,
        distance: 4,
        color,
        fontFamily: 'Rajdhani',
        fontSize: 12,
        fontWeight: 600,
        formatter: (params: { dataIndex: number; value: number }) => {
          // 仅最后一个点显示
          if (params.dataIndex === s.data.length - 1) {
            return String(params.value);
          }
          return '';
        },
      },
      endMeta: ends[s.name],
    };
  });

  return {
    grid: {
      left: 8,
      right: 16,
      top: props.showLegend ? 36 : 16,
      bottom: 24,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: {
        type: 'line' as const,
        lineStyle: { color: '#00C2FF', width: 1, type: 'dashed' as const },
      },
      formatter: (params: unknown) => {
        const list = params as Array<{ seriesName: string; value: number; color: string }>;
        if (!Array.isArray(list)) return '';
        const head = `<div style="font-size:11px;color:#9DB2C6;margin-bottom:4px">${list[0]?.seriesName ?? ''}</div>`;
        const body = list
          .map((p) => `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${p.color};margin-right:6px;vertical-align:middle"></span>${p.seriesName}：<b style="color:${p.color}">${p.value}</b>`)
          .join('<br/>');
        return head + body;
      },
    },
    legend: props.showLegend
      ? {
          show: true,
          top: 4,
          right: 8,
          itemWidth: 8,
          itemHeight: 8,
          itemGap: 14,
          textStyle: { color: '#9DB2C6', fontSize: 12 },
          icon: 'roundRect',
          data: props.series.map((s) => s.name),
        }
      : { show: false },
    xAxis: {
      type: 'category' as const,
      data: props.xLabels,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#9DB2C6', fontSize: 12, fontFamily: 'Rajdhani', margin: 8 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#9DB2C6',
        fontSize: 11,
        fontFamily: 'Rajdhani',
      },
      // 2-3 条水平网格线（自动由 splitNumber 控制）
      splitNumber: 3,
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(0, 194, 255, .08)', type: 'solid' as const },
      },
    },
    series: seriesData,
  };
}

function render() {
  if (!chart || !root.value) return;
  chart.setOption(buildOption(), { notMerge: true });
}

/** 防抖 resize：侧栏 200ms 过渡期间 ResizeObserver 连发，只在静止 100ms 后调一次 */
let roTimer: ReturnType<typeof setTimeout> | null = null;

function init() {
  if (!root.value) return;
  chart = echarts.init(root.value, props.theme);
  render();
  const ro = new ResizeObserver(() => {
    if (roTimer) clearTimeout(roTimer);
    roTimer = setTimeout(() => chart?.resize(), 100);
  });
  ro.observe(root.value);
  onBeforeUnmount(() => {
    ro.disconnect();
    if (roTimer) clearTimeout(roTimer);
  });
}

onMounted(() => {
  init();
});

onBeforeUnmount(() => {
  if (chart) {
    chart.dispose();
    chart = null;
  }
});

// 侧栏折叠/窗口 resize 完成 → 补一次 resize（兜底 ResizeObserver 未触发的场景）
watch(contentResizeTick, () => chart?.resize());

watch(
  () => [props.series, props.xLabels, props.height, props.theme, props.showLegend, props.area, props.smooth],
  () => render(),
  { deep: true },
);
</script>

<style scoped>
.trend-line {
  position: relative;
}
</style>