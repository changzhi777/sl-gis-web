<!--
  water-quality/Dashboard.vue — 水质管理大屏（需求 §五 水质安全管理 · T1 弹性布局壳）
  · 顶栏/侧栏职责已上收全局 AppShell/AppTopbar
  · 顶部 KPI 条：水质合格率 / 余氯均值 / 浊度均值 / pH 均值 / 超标次数
  · 左列：监测点水质指标（浊度/余氯/pH，超标红色）；中列：24h 浊度·余氯 + pH 趋势（TrendLine）
  · 右列：采样计划完成率（MiniRings）+ 超标事件与处置状态
  · 底部带：苏木达标率 / 监测点状态（StatusBars）/ 三级检测达标率（MiniRings）
  · 数据源（v8.3 真化）：/api/monitors?type=quality 真值（余氯/pH 按 id 确定性衍生）+ /api/alerts 水质事件
    + /api/monitors/{code}/history 真时序（焦点监测点）+ monitor 频道 SSE 实时跳动；后端不可达回落 mock
-->
<template>
  <div class="screen">
    <!-- 顶部 KPI 条 -->
      <div class="kpi-strip">
        <div class="kpi-cell">
          <KpiCard :value="kpi.qualifiedRate" unit="%" label="水质合格率" glow />
        </div>
        <div class="kpi-cell">
          <KpiCard :value="kpi.chlorine" unit="mg/L" label="余氯均值" :decimals="2" />
        </div>
        <div class="kpi-cell">
          <KpiCard :value="kpi.turbidity" unit="NTU" label="浊度均值" :decimals="2" />
        </div>
        <div class="kpi-cell">
          <KpiCard :value="kpi.ph" label="pH 均值" :decimals="2" />
        </div>
        <div class="kpi-cell">
          <KpiCard :value="kpi.exceed" unit="次" label="今日超标" />
        </div>
      </div>

      <!-- 主栅格 -->
      <main class="grid">
        <!-- 左列：监测点水质指标 -->
        <Panel class="col-monitors" title="监测点水质指标" :sub="`${qualityRows.length} 个水质监测点`">
          <div class="mon-list">
            <div
              v-for="row in qualityRows"
              :key="row.id"
              class="mon-item"
              :class="{ bad: row.bad.length > 0 }"
            >
              <div class="mon-head">
                <span class="mon-place">{{ row.place }}</span>
                <span class="mon-id num dim">{{ row.id }}</span>
              </div>
              <div class="mon-vals">
                <span class="ind" :class="{ over: row.turbidity > TURBIDITY_LIMIT }">
                  浊度 <b class="num">{{ row.turbidity.toFixed(2) }}</b>
                </span>
                <span class="ind" :class="{ over: row.chlorine < CHLORINE_MIN || row.chlorine > CHLORINE_MAX }">
                  余氯 <b class="num">{{ row.chlorine.toFixed(2) }}</b>
                </span>
                <span class="ind" :class="{ over: row.ph < PH_MIN || row.ph > PH_MAX }">
                  pH <b class="num">{{ row.ph.toFixed(2) }}</b>
                </span>
                <span v-if="row.bad.length" class="mon-flag">超标 · {{ row.bad.join('/') }}</span>
              </div>
            </div>
          </div>
        </Panel>

        <!-- 中列：24h 趋势（浊度·余氯 + pH） -->
        <div class="col-center">
          <Panel title="24h 浊度 · 余氯趋势" sub="国标：浊度 ≤1 NTU · 余氯 0.3–1.0 mg/L">
            <template #sub>
              <i class="dot d1" aria-hidden="true"></i>浊度 <b class="num tail">{{ tailValues.turbidity.toFixed(2) }}</b>
              <i class="dot d2" aria-hidden="true"></i>余氯 <b class="num tail">{{ tailValues.chlorine.toFixed(2) }}</b>
            </template>
            <TrendLine
              :series="turbidityChlorineSeries"
              :x-labels="hourLabels"
              :height="316"
              :show-legend="false"
              smooth
            />
          </Panel>
          <Panel title="24h pH 趋势" :sub="`限值 6.5–8.5 · 当前 ${tailValues.ph.toFixed(2)}`">
            <TrendLine
              :series="phSeries"
              :x-labels="hourLabels"
              :height="236"
              :show-legend="false"
              smooth
            />
          </Panel>
        </div>

        <!-- 右列：采样计划 + 超标事件 -->
        <div class="col-right">
          <Panel title="采样计划完成率" sub="本月">
            <div class="rings-host">
              <MiniRings :items="sampleRings" />
            </div>
          </Panel>
          <Panel class="events-panel" variant="alarm" title="水质超标事件" :sub="`${events.length} 条`">
            <div class="dispose-chips">
              <span v-for="c in disposeChips" :key="c.label" class="chip" :style="{ color: c.color, borderColor: c.color }">
                {{ c.label }} <b class="num">{{ c.value }}</b>
              </span>
            </div>
            <div class="event-list">
              <div v-for="ev in events" :key="ev.id" class="event-item">
                <div class="ev-head">
                  <span class="ev-time num dim">{{ ev.time }}</span>
                  <span class="ev-place">{{ ev.place }}</span>
                  <span class="ev-state" :style="{ color: DISPOSE_COLOR[ev.status], borderColor: DISPOSE_COLOR[ev.status] }">
                    {{ ev.status }}
                  </span>
                </div>
                <div class="ev-desc dim">{{ ev.desc }}</div>
              </div>
            </div>
          </Panel>
        </div>

        <!-- 底部趋势带 -->
        <div class="trend-band">
          <Panel title="各苏木乡镇水质达标率" sub="按主体工程数前 5">
            <div class="band-host">
              <MicroBar
                v-for="t in suMuRates"
                :key="t.name"
                :label="t.name"
                :value="t.rate"
                unit="%"
                :color="t.rate >= 92 ? 'var(--spring-green)' : 'var(--steppe-amber)'"
              />
            </div>
          </Panel>
          <Panel title="水质监测点状态" sub="8 点口径">
            <div class="band-host center">
              <StatusBars :items="monitorStatusItems" :total="qualityRows.length" />
            </div>
          </Panel>
          <Panel title="三级检测达标率" sub="水源 · 出厂 · 末梢">
            <div class="band-host center">
              <MiniRings :items="stageRings" />
            </div>
          </Panel>
        </div>
      </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Panel from '@ui/Panel.vue';
import KpiCard from '@ui/KpiCard.vue';
import TrendLine from '@charts/TrendLine.vue';
import StatusBars from '@charts/StatusBars.vue';
import MicroBar from '@charts/MicroBar.vue';
import MiniRings from '@charts/MiniRings.vue';
import { mockData } from '@mock/index';
import { realtime, onRealtime, apiFetch } from '@/composables/realtime';
import { mapMonitor, unpackItems } from '@shared/backend';
import type { EmergencyEvent, MonitorPoint } from '@shared/types';

/* ---------- live 数据（mock 起步 → /api/* 水合覆盖） ---------- */
const liveMonitors = ref<MonitorPoint[]>(mockData.monitors);
const liveAlerts = ref<EmergencyEvent[]>(mockData.alerts);
const INITIAL_MOCK_IDS = new Set(mockData.alerts.map((a) => a.id));
/** 焦点监测点真时序（24h） */
const liveHistory = ref<number[]>([]);
const offs: Array<() => void> = [];

/* ---------- 国标限值 ---------- */
const TURBIDITY_LIMIT = 1;    // NTU
const CHLORINE_MIN = 0.3;     // mg/L
const CHLORINE_MAX = 1.0;     // mg/L
const PH_MIN = 6.5;
const PH_MAX = 8.5;

/* ---------- 确定性 PRNG ---------- */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const p2 = (n: number) => String(n).padStart(2, '0');

/* ---------- 水质监测点（mockData.type=quality）+ 余氯/pH 确定性衍生 ---------- */
interface QualityRow {
  id: string;
  place: string;
  turbidity: number;   // NTU（= monitor.value）
  chlorine: number;    // mg/L
  ph: number;
  bad: string[];       // 超标指标名
}

function buildRow(m: MonitorPoint): QualityRow {
  const rand = mulberry32(hashStr(m.id));
  const proj = mockData.projects.find((p) => p.id === m.projectId);
  const turbidity = +m.value.toFixed(2);
  const chlorine = +(CHLORINE_MIN + rand() * 0.65).toFixed(2);
  const ph = +(6.8 + rand() * 1.4).toFixed(2);
  const bad: string[] = [];
  if (turbidity > TURBIDITY_LIMIT) bad.push('浊度');
  if (chlorine < CHLORINE_MIN || chlorine > CHLORINE_MAX) bad.push('余氯');
  if (ph < PH_MIN || ph > PH_MAX) bad.push('pH');
  return {
    id: m.id,
    place: proj ? `${proj.suMu} · ${proj.name.split('·')[1] ?? proj.name}` : m.id,
    turbidity,
    chlorine,
    ph,
    bad,
  };
}

const qualityRows = computed<QualityRow[]>(() =>
  liveMonitors.value.filter((m) => m.type === 'quality').map(buildRow),
);

/* ---------- 顶部 KPI ---------- */
function avg(list: number[]): number {
  if (list.length === 0) return 0;
  return list.reduce((s, v) => s + v, 0) / list.length;
}

const kpi = computed(() => {
  const rows = qualityRows.value;
  const ok = rows.filter((r) => r.bad.length === 0).length;
  return {
    qualifiedRate: rows.length ? +((ok / rows.length) * 100).toFixed(1) : mockData.cockpit.quality.qualifiedRate,
    chlorine: +avg(rows.map((r) => r.chlorine)).toFixed(2),
    turbidity: +avg(rows.map((r) => r.turbidity)).toFixed(2),
    ph: +avg(rows.map((r) => r.ph)).toFixed(2),
    exceed: rows.reduce((s, r) => s + r.bad.length, 0),
  };
});

/* ---------- 24h 序列（浊度取告警监测点 history，余氯/pH 确定性衍生） ---------- */
const hourLabels = computed(() =>
  Array.from({ length: 24 }, (_, h) => `${p2(h)}:00`),
);

function sample24(history: number[]): number[] {
  return Array.from({ length: 24 }, (_, i) => +(history[i * 6] ?? history[history.length - 1]).toFixed(2));
}

/** 趋势焦点：首个超标点（无则第一个），随真数据响应式 */
const focusRow = computed(() => qualityRows.value.find((r) => r.bad.length > 0) ?? qualityRows.value[0]);
const focusId = computed(() => focusRow.value?.id ?? '');

const turbidityChlorineSeries = computed(() => {
  const chlorine = Array.from({ length: 24 }, (_, i) => {
    const phase = (i / 24) * Math.PI * 2;
    return +(0.55 + 0.1 * Math.sin(phase - Math.PI / 2) + (i % 4 - 1.5) * 0.012).toFixed(2);
  });
  // 浊度：真时序（水合后）优先，回落 mock history
  const hist = liveHistory.value.length
    ? sample24(liveHistory.value)
    : sample24(liveMonitors.value.find((m) => m.id === focusId.value)?.history ?? []);
  return [
    { name: '浊度', data: hist },
    { name: '余氯', data: chlorine },
  ];
});

/** 末端当前值（设计稿「末端标注 0.58/0.47」的等价呈现） */
const tailValues = computed(() => {
  const s = turbidityChlorineSeries.value;
  return {
    turbidity: s[0]?.data.at(-1) ?? 0,
    chlorine: s[1]?.data.at(-1) ?? 0,
    ph: phSeries.value[0]?.data.at(-1) ?? 0,
  };
});

const phSeries = computed(() => {
  const ph = Array.from({ length: 24 }, (_, i) => {
    const phase = (i / 24) * Math.PI * 2;
    return +(7.4 + 0.15 * Math.sin(phase - Math.PI / 2) + (i % 5 - 2) * 0.01).toFixed(2);
  });
  return [{ name: 'pH', data: ph }];
});

/* ---------- 采样计划完成率 ---------- */
const sampleRings = computed(() => [
  { name: '月度采样计划', value: 92, target: 100 },
  { name: '出厂水月检', value: 100, target: 100 },
  { name: '末梢水月检', value: 87, target: 90 },
]);

/* ---------- 超标事件与处置状态 ---------- */
interface QualityEvent {
  id: string;
  time: string;
  place: string;
  desc: string;
  status: '未签收' | '已派单' | '已签收' | '已销号';
}

const DISPOSE_COLOR: Record<QualityEvent['status'], string> = {
  未签收: 'var(--status-alarm)',
  已派单: 'var(--steppe-amber)',
  已签收: 'var(--flood-teal)',
  已销号: 'var(--spring-green)',
};

function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 5);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

const events = computed<QualityEvent[]>(() => {
  const list: QualityEvent[] = [];

  // 1) 后端告警（真数据 · 仅水质类型）
  liveAlerts.value
    .filter((a) => a.type === 'water_quality')
    .forEach((a) => {
      list.push({
        id: a.id,
        time: hhmm(a.time),
        place: a.location,
        desc: a.description,
        status: a.status as QualityEvent['status'],
      });
    });

  // 2) 监测点实时超标衍生事件
  qualityRows.value
    .filter((r) => r.bad.length > 0)
    .forEach((r, i) => {
      const rand = mulberry32(hashStr(r.id));
      const minutesAgo = 12 + Math.floor(rand() * 120);
      const d = new Date(Date.now() - minutesAgo * 60_000);
      list.push({
        id: `QE-${r.id}`,
        time: hhmm(d.toISOString()),
        place: r.place,
        desc: `${r.bad.join('、')} 超标（浊度 ${r.turbidity.toFixed(2)} NTU），已推送县级统管单位核查`,
        status: i === 0 ? '未签收' : '已派单',
      });
    });

  return list.sort((a, b) => (a.time < b.time ? 1 : -1));
});

const disposeChips = computed(() => {
  const order: QualityEvent['status'][] = ['未签收', '已派单', '已签收', '已销号'];
  return order.map((label) => ({
    label,
    value: events.value.filter((e) => e.status === label).length,
    color: DISPOSE_COLOR[label],
  }));
});

/* ---------- 生命周期：水合 + monitor 频道实时跳动 ---------- */
async function hydrateMonitors(): Promise<void> {
  const items = unpackItems(await apiFetch('/api/monitors?type=quality'));
  if (!items?.length) return;
  // 只覆盖水质类；其余类型保留 mock（本页不消费）
  const quality = items.map(mapMonitor);
  liveMonitors.value = [
    ...mockData.monitors.filter((m) => m.type !== 'quality'),
    ...quality,
  ];
}

async function hydrateAlerts(): Promise<void> {
  const items = unpackItems(await apiFetch('/api/alerts'));
  if (!items?.length) return;
  const stock = new Set(items.map((a) => String(a.id)));
  const pending = liveAlerts.value.filter((a) => !stock.has(a.id) && !INITIAL_MOCK_IDS.has(a.id));
  liveAlerts.value = [...pending, ...items.map((a) => ({
    id: String(a.id), type: String(a.type) as EmergencyEvent['type'],
    level: String(a.level) as EmergencyEvent['level'],
    suMu: String(a.suMu ?? ''), location: String(a.location ?? ''),
    description: String(a.description ?? ''), status: String(a.status) as EmergencyEvent['status'],
    projectId: a.projectId ? String(a.projectId) : undefined,
    time: String(a.time ?? new Date().toISOString()),
    receivedBy: a.receivedBy ? String(a.receivedBy) : undefined,
  }))];
}

async function hydrateHistory(): Promise<void> {
  if (!focusId.value) return;
  const data = await apiFetch<{ total: number; items: Array<{ ts: string; value: number }> }>(
    `/api/monitors/${focusId.value}/history`,
  );
  if (!data?.items?.length) return;
  liveHistory.value = data.items.map((h) => +h.value.toFixed(2));
}

onMounted(() => {
  realtime.start({ monitors: mockData.monitors, alertPool: mockData.alerts });
  void hydrateMonitors().then(hydrateHistory);
  void hydrateAlerts();

  // 实时值跳动（monitor 频道）：更新水质点 → KPI/超标标记/末端值联动
  offs.push(onRealtime('monitor', (evt) => {
    const points = evt.data.points as Array<{ id: string; value: number }>;
    const hit = points.find((pt) => pt.id === focusId.value);
    if (hit) {
      liveHistory.value = [...liveHistory.value.slice(-143), +hit.value.toFixed(2)];
    }
    liveMonitors.value = liveMonitors.value.map((m) => {
      const p = points.find((pt) => pt.id === m.id);
      return p ? { ...m, value: p.value } : m;
    });
  }));
});

onBeforeUnmount(() => {
  realtime.stop();
  offs.forEach((off) => off());
});

/* ---------- 底部带：苏木达标率 / 监测点状态 / 三级达标 ---------- */
const suMuRates = computed(() => {
  const rand = mulberry32(152524);
  // 主体工程（A/B/C）按苏木计数，取前 5
  const count = new Map<string, number>();
  for (const p of mockData.projects) {
    if (p.grade === 'D') continue;
    count.set(p.suMu, (count.get(p.suMu) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => ({
      name,
      rate: +(88 + rand() * 11).toFixed(1),
    }));
});

const monitorStatusItems = computed(() => {
  const rows = qualityRows.value;
  return [
    { label: '达标', value: rows.filter((r) => r.bad.length === 0).length, status: 'normal' },
    { label: '超标', value: rows.filter((r) => r.bad.length > 0).length, status: 'alarm' },
    { label: '待复检', value: 0, status: 'repair' },
  ];
});

const stageRings = computed(() => [
  { name: '水源水', value: 95, target: 95 },
  { name: '出厂水', value: 98, target: 98 },
  { name: '末梢水', value: 91, target: 92 },
]);
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

/* ===== KPI 条 ===== */
.kpi-strip {
  flex: none;
  height: 72px;
  margin: 0 20px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--panel-gap);
  border-bottom: var(--border-w) solid var(--line-vein);
}
.kpi-cell {
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-left: 2px solid rgba(0, 194, 255, 0.35);
}
.kpi-cell:first-child {
  border-left-color: var(--spring-green);
}

/* ===== 主栅格 ===== */
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 5fr) minmax(0, 14fr) minmax(300px, 5fr);
  grid-template-rows: 1fr 176px;
  gap: var(--panel-gap);
  padding: var(--panel-gap) 20px 20px;
}

.col-monitors {
  grid-row: 1;
  grid-column: 1;
  overflow: hidden;
}
.col-center {
  grid-row: 1;
  grid-column: 2;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
}
.col-center > .panel:first-child { flex: 1.3; }
.col-center > .panel:last-child { flex: 1; }
.col-right {
  grid-row: 1;
  grid-column: 3;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
}
.col-right > .panel:first-child { flex: none; }
.col-right > .events-panel { flex: 1; min-height: 0; overflow: hidden; }

/* ===== 左列：监测点列表 ===== */
.mon-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mon-item {
  flex: none;
  padding: 8px 12px;
  background: rgba(12, 35, 64, 0.55);
  border-left: 3px solid var(--spring-green);
  border-radius: 1px;
}
.mon-item.bad {
  border-left-color: var(--status-alarm);
}
.mon-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.mon-place {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.mon-vals {
  margin-top: 4px;
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 12px;
  color: var(--text-dim);
}
.ind b {
  font-size: 15px;
  margin-left: 3px;
  color: var(--spring-green);
}
.ind.over b {
  color: var(--status-alarm);
}
.mon-flag {
  margin-left: auto;
  font-size: 12px;
  color: var(--status-alarm);
}
.dim {
  color: var(--text-dim);
}

/* ===== 图例 dot ===== */
.dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 3px;
  vertical-align: -1px;
}
.dot + .dot {
  margin-left: 10px;
}
.dot.d1 { background: var(--chart-1); }
.dot.d2 { background: var(--chart-2); }
.num.tail {
  font-size: 13px;
  color: var(--spring-green);
  margin: 0 8px 0 2px;
}

/* ===== 右列 ===== */
.rings-host {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}
.dispose-chips {
  flex: none;
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.chip {
  flex: 1;
  text-align: center;
  font-size: 12px;
  padding: 3px 0;
  border: 1px solid;
  border-radius: 1px;
}
.chip b {
  font-size: 15px;
  margin-left: 3px;
}
.event-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.event-item {
  flex: none;
  padding: 8px 12px;
  background: rgba(12, 35, 64, 0.5);
  border-left: 3px solid var(--status-alarm);
  border-radius: 1px;
}
.ev-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.ev-time {
  flex: none;
  font-size: 13px;
}
.ev-place {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.ev-state {
  flex: none;
  font-size: 12px;
  padding: 1px 8px;
  border: 1px solid;
  border-radius: 1px;
}
.ev-desc {
  margin-top: 3px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 底部趋势带 ===== */
.trend-band {
  grid-row: 2;
  grid-column: 1 / -1;
  min-height: 0;
  display: flex;
  gap: var(--panel-gap);
}
.trend-band > .panel {
  flex: 1;
  min-width: 0;
}
.band-host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  overflow: hidden;
}
.band-host.center {
  justify-content: center;
}
.trend-band :deep(.micro-bar) {
  padding: 2px 0;
  font-size: 12px;
}
.trend-band :deep(.mb-label) {
  flex-basis: 96px;
}
</style>
