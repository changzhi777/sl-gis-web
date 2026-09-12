<!--
  LiquidGauge.vue — 水球达标率（echarts-liquidfill · 深底配方）
  · 多波纹 data:[v, v-.08, v-.15, v-.25] · amplitude 4% · rich label · opacity .55
  用法：<LiquidGauge :value="0.98" label="水质达标率" color="#00C2FF" />
-->
<template>
  <div ref="root" class="gauge" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import 'echarts-liquidfill';

const props = withDefaults(defineProps<{ value: number; label?: string; color?: string }>(), {
  label: '',
  color: '#00C2FF',
});

const root = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function buildOption(): echarts.EChartsOption {
  const v = Math.min(1, Math.max(0, props.value));
  const c = props.color;
  const option = {
    series: [
      {
        type: 'liquidFill',
        data: [v, v - 0.08, v - 0.15, v - 0.25],
        amplitude: '4%',
        waveLength: '80%',
        period: 3000,
        direction: 'right',
        color: [c, `${c}cc`, `${c}99`, `${c}66`],
        itemStyle: { opacity: 0.55 },
        backgroundStyle: { color: 'rgba(3, 8, 18, 0.5)' },
        outline: { show: false },
        radius: '70%',
        center: ['50%', '50%'],
        label: {
          formatter: () => `{a|${(v * 100).toFixed(0)}%}\n{b|${props.label}}`,
          rich: {
            a: { fontSize: 26, fontWeight: 'bold', color: '#E8F1F8' },
            b: { fontSize: 12, color: 'rgba(232,241,248,.6)', padding: [4, 0, 0, 0] },
          },
        },
      },
    ],
  };
  return option as unknown as echarts.EChartsOption;
}

function render(): void {
  chart?.setOption(buildOption(), { notMerge: true });
}

onMounted(() => {
  if (!root.value) return;
  chart = echarts.init(root.value);
  render();
  const ro = new ResizeObserver(() => chart?.resize());
  ro.observe(root.value);
  watch(() => props.value, render);
});

onBeforeUnmount(() => {
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.gauge {
  width: 100%;
  height: 100%;
}
</style>
