<!--
  FunnelChart.vue — 告警→处置漏斗（ECharts funnel · 深底配方）
  · minSize 24% 防尖三角 · 每层 LinearGradient 青渐变 · 转化率 inside 闭包
  用法：<FunnelChart :stages="[{name:'告警接入',value:12},...]" />
-->
<template>
  <div ref="root" class="funnel" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps<{ stages: Array<{ name: string; value: number }> }>();

const root = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const TEAL = ['#00FFE0', '#00C2FF', '#0090D0', '#0068A0'];

function buildOption(): echarts.EChartsOption {
  const max = Math.max(...props.stages.map((s) => s.value), 1);
  return {
    animationDuration: 1000,
    animationDurationUpdate: 800,
    tooltip: { show: false },
    series: [
      {
        type: 'funnel',
        left: '8%',
        right: '8%',
        top: 8,
        bottom: 8,
        width: '84%',
        sort: 'descending',
        gap: 2,
        minSize: '24%',
        funnelAlign: 'center',
        label: {
          show: true,
          position: 'inside',
          formatter: (p: { dataIndex: number; name: string; value: number }) => {
            const prev = p.dataIndex > 0 ? props.stages[p.dataIndex - 1].value : 0;
            const rate = p.dataIndex > 0 && prev ? `${((p.value / prev) * 100).toFixed(0)}%` : '';
            return `{n|${p.name} ${p.value}}{r|  ${rate}}`;
          },
          rich: {
            n: { fontSize: 13, color: '#E8F1F8' },
            r: { fontSize: 11, color: 'rgba(232,241,248,.6)' },
          },
        },
        data: props.stages.map((s, i) => ({
          name: s.name,
          value: Math.max(s.value, max * 0.24),
          realValue: s.value,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: TEAL[Math.min(i, 3)] },
              { offset: 1, color: 'rgba(0,194,255,.15)' },
            ]),
          },
        })),
      },
    ],
  } as echarts.EChartsOption;
}

function render(): void {
  if (!chart) return;
  chart.setOption(buildOption(), { notMerge: true });
}

onMounted(() => {
  if (!root.value) return;
  chart = echarts.init(root.value);
  render();
  const ro = new ResizeObserver(() => chart?.resize());
  ro.observe(root.value);
  watch(() => props.stages, render, { deep: true });
});

onBeforeUnmount(() => {
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.funnel {
  width: 100%;
  height: 100%;
}
</style>
