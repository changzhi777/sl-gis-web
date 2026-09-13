<!--
  cockpit/DashboardClassic.vue — 数据驾驶舱·经典数据总览版（v9 布局 · /cockpit-classic）
  布局：L1 翻牌带 ×5 ｜ 左列 营收三率+凹凸榜 ｜ 中轴 缩略 MapCanvas ｜ 右列 事件流+处置漏斗 ｜ 底部 效能带
  与 /cockpit（厂区孪生版）通过页面内「厂区孪生 / 数据总览」按钮互切
  视觉：数据墨水风（局部 #0A1220 底 · 面板 #0F1A2B · 珊瑚 #FF6F52 异常 · 珊瑚≤15% 配比）
  数据：assessment/summary + billing/overview + alerts/repairs + SSE（mock 起步 · 水合覆盖 · 失败回落）
  下钻：KPI→SCADA · 排名→考核 · 漏斗→应急 · 效能→收费 · 地图工程点→mapFocus 一张图
-->
<template>
  <div class="screen cockpit">
    <!-- 生成式背景装饰（边缘粒子 + 底部水波 · 中央留白被面板覆盖） -->
    <div class="bg-deco" aria-hidden="true" />
    <!-- L1 翻牌带 ×5 -->
    <div class="kpi-band ed" style="--d: 0">
      <FlipNumber :value="kpiBand.totalFlow" :decimals="2" unit="万m³" label="当日供水量" color="#00FFE0" />
      <FlipNumber :value="kpiBand.onlineRate" :decimals="1" unit="%" label="设备在线率" color="#00C2FF" />
      <FlipNumber :value="kpiBand.qualityRate" :decimals="1" unit="%" label="水质合格率" color="#7EE081" />
      <FlipNumber
        :value="kpiBand.alarm"
        unit="条"
        label="未签收告警"
        :color="kpiBand.alarm > 0 ? '#FF6F52' : '#00C2FF'"
      />
      <FlipNumber :value="kpiBand.collectionRate" :decimals="1" unit="%" label="水费收缴率" color="#FFB454" />
    </div>

    <main class="grid">
      <!-- 左列：营收健康三率 + 苏木排名 -->
      <div class="col ed" style="--d: 240ms">
        <Panel title="营收健康" sub="三率 · 统管口径">
          <div class="rates">
            <div v-for="r in rates" :key="r.label" class="rate-row">
              <span class="rl">{{ r.label }}</span>
              <span class="rv num" :style="{ color: r.color }">
                {{ r.value.toFixed(1) }}%
                <i class="tri" :class="[r.up ? 'up' : 'down', r.good ? 'good' : 'bad']" />
              </span>
            </div>
          </div>
        </Panel>
        <Panel title="苏木乡镇综合排名" sub="按工程正常率" class="rank-panel drill" @click="drill('/assessment')">
          <span class="drill-mark">↗</span>
          <RankingBoard :rows="ranking" unit="分" />
        </Panel>
      </div>

      <!-- 中轴：缩略地图 -->
      <Panel
        class="mid ed drill"
        style="--d: 480ms"
        hero
        title="全域态势"
        sub="点击工程点下钻一张图"
        @click="drill('/dashboard')"
      >
        <span class="drill-mark">↗</span>
        <div class="map-host">
          <MapCanvas
            :projects="projects"
            :monitors="monitors"
            :pipes="pipes"
            :alerts="alerts.slice(0, 2)"
            :tilt="0"
            @project-click="onMapDrill"
          />
        </div>
      </Panel>

      <!-- 右列：事件流 + 处置漏斗 -->
      <div class="col ed" style="--d: 680ms">
        <div class="stream-wrap drill" @click="drill('/emergency')">
          <span class="drill-mark">↗</span>
          <AlertList :alerts="alerts" />
        </div>
        <Panel title="告警处置漏斗" sub="接入 → 办结" class="funnel-panel">
          <FunnelChart :stages="funnelStages" />
        </Panel>
      </div>

      <!-- 底部效能带 -->
      <div class="eff-band ed drill" style="--d: 880ms" @click="drill('/billing')">
        <span class="drill-mark">↗</span>
        <Panel class="trend-cell" title="产销差 · 供用差趋势" sub="近 6 期 %">
          <TrendLine :series="effSeries" :x-labels="effLabels" :height="132" smooth :show-legend="true" />
        </Panel>
        <Panel title="水质达标率" sub="实测口径" class="gauge-cell">
          <LiquidGauge :value="gaugeQuality" label="水质合格率" color="#00C2FF" />
        </Panel>
        <Panel title="管网覆盖率" sub="工程覆盖口径" class="gauge-cell">
          <LiquidGauge :value="gaugeCoverage" label="管网覆盖率" color="#00FFE0" />
        </Panel>
      </div>

      <!-- 版本切换：回数字孪生水厂版 -->
      <button class="twin-swap" type="button" title="切换到厂区孪生视图" @click.stop="drill('/cockpit')">
        ◈ 厂区孪生
      </button>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Panel from '@ui/Panel.vue';
import TrendLine from '@charts/TrendLine.vue';
import FlipNumber from '@/components/cockpit/FlipNumber.vue';
import RankingBoard from '@/components/cockpit/RankingBoard.vue';
import FunnelChart from '@/components/cockpit/FunnelChart.vue';
import LiquidGauge from '@/components/cockpit/LiquidGauge.vue';
import MapCanvas from '@/components/map/MapCanvas.vue';
import AlertList from '@/views/pipe-network/AlertList.vue';
import { mockData } from '@mock/index';
import { realtime, onRealtime, apiFetch } from '@/composables/realtime';
import { mapProject, mapMonitor, mapAlert, mapPipe } from '@shared/backend';
import { useRoute } from 'vue-router';
import type { EmergencyEvent, MonitorPoint, PipeSegment, Project } from '@shared/types';

const router = useRouter();
const route = useRoute();
const offs: Array<() => void> = [];

/* ---------- live 数据（mock 起步 → 水合覆盖） ---------- */
const projects = ref<Project[]>(mockData.projects);
const monitors = ref<MonitorPoint[]>(mockData.monitors);
const pipes = ref<PipeSegment[]>(mockData.pipes);
const alerts = ref<EmergencyEvent[]>(mockData.alerts);

/* ---------- KPI 翻牌带 ---------- */
const kpiBand = ref({
  totalFlow: 1.42,
  onlineRate: 91.6,
  qualityRate: 98.2,
  alarm: 0,
  collectionRate: 76.3,
});

/* ---------- 营收三率 ---------- */
const rates = ref([
  { label: '水费收缴率', value: 76.3, color: '#FFB454', up: false, good: false },
  { label: '欠费户数率', value: 29.5, color: '#FF6F52', up: false, good: false },
  { label: '抄表到户率', value: 92.4, color: '#00FFE0', up: true, good: true },
]);

/* ---------- 苏木排名 ---------- */
const ranking = ref<Array<{ name: string; value: number }>>([]);

/* ---------- 漏斗（告警→处置 · 从 alerts 状态推导） ---------- */
const funnelStages = computed(() => {
  const a = alerts.value;
  const n = (status: string) => a.filter((x) => x.status === status).length;
  const unsigned = n('未签收');
  const dispatched = n('已派单');
  const signed = n('已签收');
  const closed = a.filter((x) => x.status === '已销号').length;
  return [
    { name: '告警接入', value: a.length },
    { name: '确认派单', value: dispatched + unsigned },
    { name: '到场处置', value: dispatched + signed },
    { name: '办结归档', value: closed },
  ].map((s) => ({ ...s, value: Math.max(s.value, 1) }));
});

/* ---------- 效能带（确定性形态 · 产销差/供用差） ---------- */
const effLabels = ['4月', '5月', '6月', '7月', '8月', '9月'];
const effSeries = [
  { name: '产销差率', data: [21.2, 20.5, 19.8, 19.1, 18.6, 18.1] },
  { name: '供用差率', data: [12.5, 12.0, 11.4, 10.8, 10.2, 9.8] },
];

const gaugeQuality = ref(0.982);
const gaugeCoverage = ref(0.87);

/* ---------- 下钻 ---------- */
function drill(path: string): void {
  if (route.path !== path) router.push(path);
}
function onMapDrill(): void {
  router.push('/dashboard');
}

/* ---------- 水合 ---------- */
async function hydrate(): Promise<void> {
  // 并行拉五源
  const [sum, billing, projItems, monItems, pipeItems] = await Promise.all([
    apiFetch<{ kpi: Record<string, number>; ranking: Array<{ name: string; score: number }> }>('/api/assessment/summary'),
    apiFetch<{ households: number; collectionRate: number; arrears: { count: number; amount: number; items: unknown[] }; monthly: Array<{ month: string; due: number; paid: number; rate: number }> }>('/api/billing/overview'),
    apiFetch<{ items: unknown[] }>('/api/projects'),
    apiFetch<{ items: unknown[] }>('/api/monitors'),
    apiFetch<{ items: unknown[] }>('/api/pipes'),
  ]);

  if (sum) {
    kpiBand.value.onlineRate = sum.kpi.onlineRate;
    kpiBand.value.collectionRate = sum.kpi.collectionRate;
    ranking.value = sum.ranking.map((r) => ({ name: r.name, value: r.score }));
  }
  if (billing) {
    kpiBand.value.collectionRate = billing.collectionRate;
    const unpaidRate = billing.households ? (billing.arrears.count / billing.households) * 100 : 0;
    rates.value = [
      { label: '水费收缴率', value: billing.collectionRate, color: tierColor(billing.collectionRate, [90, 76]), up: true, good: billing.collectionRate >= 76 },
      { label: '欠费户数率', value: +unpaidRate.toFixed(1), color: unpaidRate > 10 ? '#FF6F52' : unpaidRate > 5 ? '#FFB454' : '#00FFE0', up: false, good: unpaidRate <= 10 },
      { label: '抄表到户率', value: 92.4, color: '#00FFE0', up: true, good: true },
    ];
    gaugeCoverage.value = Math.min(1, billing.households ? 0.87 : 0.87);
  }
  if (projItems) projects.value = projItems.items.map((x) => mapProject(x as Record<string, unknown>));
  if (monItems) monitors.value = monItems.items.map((x) => mapMonitor(x as Record<string, unknown>));
  if (pipeItems) pipes.value = pipeItems.items.map((x) => mapPipe(x as Record<string, unknown>));

  const alertItems = await apiFetch<{ items: unknown[] }>('/api/alerts');
  if (alertItems) {
    const stock = new Set(alertItems.items.map((a) => String((a as Record<string, unknown>).id)));
    const pending = alerts.value.filter((a) => !stock.has(a.id) && !INITIAL_MOCK_IDS.has(a.id));
    alerts.value = [...pending, ...alertItems.items.map((a) => mapAlert(a as Record<string, unknown>))].slice(0, 12);
    kpiBand.value.alarm = alertItems.items.filter((a) => (a as Record<string, unknown>).status === '未签收').length;
  }
}

const INITIAL_MOCK_IDS = new Set(mockData.alerts.map((a) => a.id));

function tierColor(v: number, [hi, mid]: [number, number]): string {
  return v >= hi ? '#00FFE0' : v >= mid ? '#FFB454' : '#FF6F52';
}

/* ---------- 生命周期 ---------- */
onMounted(() => {
  realtime.start({ monitors: mockData.monitors, alertPool: mockData.alerts });

  // kpi 频道 → 翻牌带
  offs.push(onRealtime('kpi', (evt) => {
    const d = evt.data as Record<string, number>;
    if (d.totalFlow) kpiBand.value.totalFlow = d.totalFlow;
    if (d.onlineRate) kpiBand.value.onlineRate = d.onlineRate;
    if (d.qualityRate) kpiBand.value.qualityRate = d.qualityRate;
  }));

  // alert 频道 → 事件流置顶 + 告警翻牌
  offs.push(onRealtime('alert', (evt) => {
    const a = evt.data as unknown as EmergencyEvent;
    alerts.value = [a, ...alerts.value].slice(0, 12);
    kpiBand.value.alarm += a.status === '未签收' ? 1 : 0;
  }));

  void hydrate();
});

onBeforeUnmount(() => {
  realtime.stop();
  offs.forEach((off) => off());
});
</script>

<style scoped>
.bg-deco {
  position: absolute;
  inset: 0;
  background: url('/img/cockpit-bg.webp') center / cover no-repeat;
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}
.cockpit {
  /* 数据墨水风局部覆盖（避开全局 tokens） */
  --night-navy: #0f1a2b;
  --well-deep: #0a1220;
  --line-vein: rgba(0, 194, 255, 0.14);
  --ck-coral: #ff6f52;

  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: var(--well-deep);
  overflow: hidden;
}
.cockpit > :not(.bg-deco) {
  position: relative;
  z-index: 1;
}

/* ===== 入场编排（420ms cubic · L1 0 → 240 → 480 → 680 → 880） ===== */
.ed {
  animation: ed-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--d, 0ms);
}
@keyframes ed-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .ed { animation: none; }
}

/* ===== L1 翻牌带 ===== */
.kpi-band {
  flex: none;
  height: 96px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: center;
  background: var(--night-navy);
  border: 1px solid var(--line-vein);
  border-radius: 2px;
}
.kpi-band > :deep(*) {
  border-left: 1px solid rgba(232, 241, 248, 0.08);
  height: 100%;
  justify-content: center;
}
.kpi-band > :deep(*:first-child) { border-left: none; }

/* ===== 主栅格 ===== */
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr) 420px;
  gap: 12px;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

/* ===== 面板下钻暗示 ===== */
.drill { position: relative; cursor: pointer; }
.drill-mark {
  position: absolute;
  top: 12px;
  right: 14px;
  z-index: 2;
  font-size: 12px;
  color: rgba(157, 178, 198, 0.6);
  transition: color 0.18s ease, transform 0.18s ease;
}
.drill:hover .drill-mark {
  color: #00ffe0;
  transform: translate(1px, -1px);
}
.drill:hover { border-color: rgba(0, 194, 255, 0.32); }

/* ===== 左列 ===== */
.col > .panel:first-child { flex: none; height: 270px; }
.rank-panel { flex: 1; min-height: 0; overflow: hidden; }
.rates {
  display: flex;
  flex-direction: column;
}
.rate-row {
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(232, 241, 248, 0.07);
}
.rl { font-size: 13px; color: var(--text-dim); }
.rv {
  font-size: 30px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tri {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
}
.tri.up { border-bottom: 7px solid currentColor; }
.tri.down { border-top: 7px solid currentColor; }
.tri.good { color: #7ee081; }
.tri.bad { color: var(--ck-coral); }

/* ===== 中轴 ===== */
.mid { min-width: 0; display: flex; flex-direction: column; }
.map-host {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  border-radius: 2px;
}

/* ===== 右列 ===== */
.stream-wrap { flex: 1.1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; position: relative; }
.stream-wrap > :deep(*) { flex: 1; min-height: 0; }
.funnel-panel { flex: 1; min-height: 0; }

/* ===== 底部效能带 ===== */
.eff-band {
  grid-column: 1 / -1;
  flex: none;
  height: 200px;
  display: flex;
  gap: 12px;
}
.trend-cell { flex: 1; min-width: 0; }
.gauge-cell { flex: none; width: 220px; }

/* ===== 版本切换浮钮（右下 · 回厂区孪生版） ===== */
.twin-swap {
  position: absolute;
  right: 22px;
  bottom: 22px;
  z-index: 20;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--spring-green);
  background: rgba(0, 255, 224, 0.08);
  border: 1px solid rgba(0, 255, 224, 0.4);
  border-radius: 999px;
  cursor: pointer;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}
.twin-swap:hover {
  background: rgba(0, 255, 224, 0.16);
  border-color: rgba(0, 255, 224, 0.7);
  transform: translateY(-1px);
}
</style>
