<!--
  scada/Dashboard.vue — SCADA 运行监控大屏主视图（T1 弹性布局壳，全局 AppShell 供顶栏/侧栏）
  路由 /scada（router 已注册，本模块不改 router）
  · 顶栏/告警灯职责已上收 AppTopbar（全局）
  · KPI 条：在线率 / 数据完整率 / 告警数 / 平均压力 / 总流量（KpiCard block）
  · 左列：测点选择（按类型分组，点选→曲线联动）+ 泵站状态（运行/备用/故障三态卡）
  · 中列：实时曲线对比（CurveCompare）+ 工艺流程图（ProcessFlow SVG）
  · 右列：告警等级表（AlarmTable，可签收）+ 数据完整率（StatusBars 到达率）
  · 数据全部来自 @mock/index（monitors 50 + alerts 6 + cockpit KPI），1 期无后端
-->
<template>
  <div class="screen">
    <!-- 顶部 KPI 条 -->
      <div class="kpi-strip" role="group" aria-label="SCADA 关键指标">
        <div
          v-for="k in stripKpis"
          :key="k.label"
          class="kpi-cell"
          :class="{ 'is-alarm': k.alarm && k.value > 0 }"
        >
          <KpiCard layout="block" :value="k.value" :unit="k.unit" :label="k.label" />
        </div>
      </div>

      <main class="grid">
        <!-- ============ 左列 ============ -->
        <div class="col">
          <Panel title="测点选择" :sub="`已选 ${selectedIds.length}/4 · 同类对比`" class="f16">
            <div class="picker" role="listbox" aria-label="监测点列表" aria-multiselectable="true">
              <template v-for="g in groupsData" :key="g.type">
                <div class="ghead" role="presentation">
                  <i class="gd" :style="{ background: MONITOR_COLOR[g.type] }" aria-hidden="true"></i>
                  <span>{{ g.label }}</span>
                  <b class="num">{{ g.items.length }}</b>
                </div>
                <button
                  v-for="m in g.items"
                  :key="m.id"
                  type="button"
                  class="mon"
                  role="option"
                  :aria-selected="selectedIds.includes(m.id)"
                  :class="{ active: selectedIds.includes(m.id) }"
                  @click="toggle(m)"
                >
                  <i class="sd" :style="{ background: STATUS_COLOR[m.status] }" aria-hidden="true"></i>
                  <span class="mid num">{{ shortId(m) }}</span>
                  <span class="mproj num">{{ projShort(m.projectId) }}</span>
                  <span class="mval num" :class="{ bad: m.status === 'alarm' }">
                    {{ m.value }}<small class="mu">{{ UNITS[m.type] }}</small>
                  </span>
                </button>
              </template>
            </div>
          </Panel>

          <Panel title="泵站状态" sub="A 级主力站" class="f10">
            <div class="pumps">
              <div
                v-for="s in pumpStations"
                :key="s.id"
                class="pump-card"
                :class="`st-${s.status}`"
              >
                <div class="phead">
                  <span class="pname num">{{ s.short }}</span>
                  <span class="pst" :class="`stc-${s.status}`">{{ s.statusText }}</span>
                </div>
                <div class="psu">{{ s.suMu }}</div>
                <div class="chips">
                  <span
                    v-for="p in s.pumps"
                    :key="p.tag"
                    class="chip"
                    :class="`chip-${p.state}`"
                  >
                    <i class="led" aria-hidden="true"></i>{{ p.tag }} {{ PUMP_CN[p.state] }}
                  </span>
                </div>
                <div class="pfoot num">电流 {{ s.current.toFixed(1) }} A · 管压 {{ s.pressure.toFixed(2) }} MPa</div>
              </div>
            </div>
          </Panel>
        </div>

        <!-- ============ 中列 ============ -->
        <div class="col">
          <Panel title="实时曲线对比" :sub="curveSub" class="f12" hero>
            <CurveCompare :points="selectedMonitors" />
          </Panel>

          <Panel title="工艺流程图" sub="取水 → 供水管网 · 红闪 = 越限" class="f10" hero>
            <ProcessFlow />
          </Panel>
        </div>

        <!-- ============ 右列 ============ -->
        <div class="col">
          <Panel variant="alarm" title="告警等级表" :sub="`未签收 ${unsignedLive} 条`" class="f16" hero>
            <AlarmTable :alerts="liveAlerts" @unsigned-change="unsignedLive = $event" />
          </Panel>

          <Panel title="数据完整率" sub="24h 到达率 · %" class="f10">
            <div class="complete">
              <StatusBars :items="overallItems" class="sb" />
              <div class="c-cap">缺数重点测点（最低 4）</div>
              <StatusBars :items="worstItems" class="sb" />
            </div>
          </Panel>
        </div>
      </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import KpiCard from '@ui/KpiCard.vue';
import Panel from '@ui/Panel.vue';
import StatusBars from '@charts/StatusBars.vue';
import CurveCompare from './CurveCompare.vue';
import ProcessFlow from './ProcessFlow.vue';
import AlarmTable from './AlarmTable.vue';
import { mockData } from '@mock/index';
import { realtime, onRealtime, apiFetch } from '@/composables/realtime';
import { mapMonitor, mapAlert, unpackItems } from '@shared/backend';
import { MONITOR_COLOR, STATUS_COLOR } from '@shared/types';
import type { EmergencyEvent, MonitorPoint, Project, Status } from '@shared/types';

/* ---------- 常量 ---------- */
/** 类型中文 + 单位（单位口径与 CurveCompare.TYPE_META.unit 保持一致） */
const UNITS: Record<MonitorPoint['type'], string> = {
  pressure: 'MPa',
  flow: 'm³/h',
  quality: 'NTU',
  level: 'm',
};
const TYPE_LABELS: Record<MonitorPoint['type'], string> = {
  pressure: '压力',
  flow: '流量',
  quality: '水质',
  level: '液位',
};
const GROUP_ORDER: MonitorPoint['type'][] = ['pressure', 'flow', 'quality', 'level'];

const PUMP_CN = { run: '运行', standby: '备用', fault: '故障' } as const;
type PumpState = keyof typeof PUMP_CN;

const STATUS_CN: Record<Status, string> = {
  normal: '运行正常',
  alarm: '告警',
  repair: '检修中',
  stop: '停用',
  offline: '离线',
};

/* ---------- 实时状态（realtime 引擎驱动 · 初始值 = mock 基线） ---------- */
const liveMonitors = ref<MonitorPoint[]>([...mockData.monitors]);

/** 后端 /api/monitors 水合：真监测点覆盖 mock（值/坐标真 · history 按 value 合成兜底） */
async function hydrateMonitors(): Promise<void> {
  const items = unpackItems(await apiFetch('/api/monitors'));
  if (!items?.length) return;
  liveMonitors.value = items.map(mapMonitor);
}
const liveAlerts = ref<EmergencyEvent[]>([...mockData.alerts]);
/** 初始 mock id 集合：真存量水合时丢弃 mock，仅保留 SSE 真增量 */
const INITIAL_MOCK_IDS = new Set(mockData.alerts.map((a) => a.id));

/** 后端 /api/alerts 水合：真存量覆盖 mock（置顶保留已到的 SSE 增量防竞态） */
async function hydrateAlerts(): Promise<void> {
  const items = unpackItems(await apiFetch('/api/alerts'));
  if (!items?.length) return;
  const stock = new Set(items.map((a) => String(a.id)));
  const pending = liveAlerts.value.filter((a) => !stock.has(a.id) && !INITIAL_MOCK_IDS.has(a.id));
  liveAlerts.value = [...pending, ...items.map(mapAlert)].slice(0, 12);
}
/** pump 频道快照：projectId → 泵组/电流/管压 */
interface PumpSnapshot {
  projectId: string;
  current: number;
  pressure: number;
  pumps: Array<{ tag: string; running: boolean; freq: number }>;
}
const pumpLive = ref<Record<string, PumpSnapshot>>({});
/** kpi 频道在线率（初始取 cockpit 基线） */
const liveOnlineRate = ref(mockData.cockpit.quality.deviceOnlineRate);
const offs: Array<() => void> = [];

/* ---------- KPI（顶栏 + KPI 条，随 monitor 频道滚动） ---------- */
const avgPressure = computed(() => {
  const vals = liveMonitors.value.filter((m) => m.type === 'pressure').map((m) => m.value);
  return vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : 0;
});
const totalFlow = computed(() =>
  Math.round(liveMonitors.value.filter((m) => m.type === 'flow').reduce((s, m) => s + m.value, 0)),
);

const unsignedCount = computed(() => liveAlerts.value.filter((a) => a.status === '未签收').length);

/** 签收操作后的实时未签收数（AlarmTable 回传，顶栏告警灯 + 面板标题联动） */
const unsignedLive = ref(unsignedCount.value);

const stripKpis = computed(() => [
  { value: liveOnlineRate.value, unit: '%', label: '设备在线率', alarm: false },
  { value: mockData.cockpit.quality.dataCompleteRate, unit: '%', label: '数据完整率', alarm: false },
  { value: liveAlerts.value.length, unit: '条', label: '实时告警', alarm: true },
  { value: avgPressure.value, unit: 'MPa', label: '平均压力', alarm: false },
  { value: totalFlow.value, unit: 'm³/h', label: '实时总流量', alarm: false },
]);

/* ---------- 测点选择（联动曲线） ---------- */
const monitorsById = computed(() =>
  new Map<string, MonitorPoint>(liveMonitors.value.map((m) => [m.id, m])),
);

/** 默认选前 3 个压力测点，进屏即有对比曲线 */
const selectedIds = ref<string[]>(
  mockData.monitors
    .filter((m) => m.type === 'pressure')
    .slice(0, 3)
    .map((m) => m.id),
);

const MAX_SELECTED = 4;

const selectedMonitors = computed<MonitorPoint[]>(() =>
  selectedIds.value
    .map((id) => monitorsById.value.get(id))
    .filter((m): m is MonitorPoint => m !== undefined),
);

/**
 * 点选逻辑：取消已选；跨类型点击 → 重置为该点（同类对比）；同类型最多 4 个（满员挤掉最旧）
 */
function toggle(m: MonitorPoint): void {
  const idx = selectedIds.value.indexOf(m.id);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
    return;
  }
  const curType = selectedMonitors.value[0] ? selectedMonitors.value[0].type : undefined;
  if (curType && curType !== m.type) {
    selectedIds.value = [m.id];
    return;
  }
  if (selectedIds.value.length >= MAX_SELECTED) selectedIds.value.shift();
  selectedIds.value.push(m.id);
}

const groupsData = computed(() =>
  GROUP_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: liveMonitors.value.filter((m) => m.type === type),
  })),
);

const curveSub = computed(() => {
  const first = selectedMonitors.value[0];
  if (!first) return '未选择';
  return `${TYPE_LABELS[first.type]} · ${UNITS[first.type]} · 24h`;
});

/** MON-PRESSURE-007 → P-007 */
function shortId(m: MonitorPoint): string {
  const seg = m.id.split('-');
  return `${seg[1].charAt(0)}-${seg[2]}`;
}
/** PRJ-A-01 → A-01 */
function projShort(id: string): string {
  return id.replace('PRJ-', '');
}

/* ---------- 泵站状态（A 级主力站，告警优先展示，取 6 站） ---------- */
interface PumpChip {
  tag: string;
  state: PumpState;
}
interface PumpStation {
  id: string;
  short: string;
  suMu: string;
  status: Status;
  statusText: string;
  pumps: PumpChip[];
  current: number;
  pressure: number;
}

const STATUS_WEIGHT: Record<Status, number> = {
  alarm: 0,
  repair: 1,
  stop: 2,
  offline: 3,
  normal: 4,
};

/** 站状态 → 三泵态（运行/备用/故障） */
function pumpsFor(p: Project): PumpChip[] {
  const states: Record<Status, PumpState[]> = {
    normal: ['run', 'run', 'standby'],
    alarm: ['run', 'fault', 'standby'],
    repair: ['standby', 'run', 'fault'],
    stop: ['fault', 'standby', 'standby'],
    offline: ['fault', 'fault', 'standby'],
  };
  const arr = states[p.status];
  return [
    { tag: '1#', state: arr[0] },
    { tag: '2#', state: arr[1] },
    { tag: '3#', state: arr[2] },
  ];
}

/** 站非运行态 → 泵态（pump 频道只给 running 布尔，停机态按站状态语义解释） */
const IDLE_STATE: Record<Status, PumpState> = {
  normal: 'standby',
  alarm: 'standby',
  repair: 'standby',
  stop: 'fault',
  offline: 'fault',
};

const pumpStations = computed<PumpStation[]>(() =>
  [...mockData.projects]
    .filter((p) => p.grade === 'A')
    .sort((a, b) => STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status])
    .slice(0, 6)
    .map((p) => {
      const live = pumpLive.value[p.id];
      const chips: PumpChip[] = live
        ? live.pumps.map((q) => ({ tag: q.tag, state: q.running ? 'run' : IDLE_STATE[p.status] }))
        : pumpsFor(p);
      return {
        id: p.id,
        short: p.id.replace('PRJ-', ''),
        suMu: p.suMu,
        status: p.status,
        statusText: STATUS_CN[p.status],
        pumps: chips,
        current: live?.current ?? p.metrics.pumpCurrent ?? 0,
        pressure: live?.pressure ?? p.metrics.pressure ?? 0,
      };
    }),
);

/* ---------- 数据完整率（确定性推导：id 哈希基率，alarm 点按缺数加重） ---------- */
function avg(a: number[]): number {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}

function pointRate(m: MonitorPoint): number {
  let h = 0;
  for (const c of m.id) h = (h * 31 + c.charCodeAt(0)) % 997;
  const base = 88 + (h % 11); // 88 – 98
  const v = m.status === 'alarm' ? base - 5 : base;
  return Math.round(v * 10) / 10;
}
function band(v: number): 'normal' | 'repair' | 'alarm' {
  if (v >= 96) return 'normal';
  if (v >= 92) return 'repair';
  return 'alarm';
}

const typeRates = computed(() =>
  GROUP_ORDER.map((type) => {
    const items = liveMonitors.value.filter((m) => m.type === type);
    const v = items.length ? avg(items.map((m) => pointRate(m))) : 100;
    return { label: TYPE_LABELS[type], value: Math.round(v * 10) / 10, type };
  }),
);

const overallItems = computed(() => [
  {
    label: '总体',
    value: mockData.cockpit.quality.dataCompleteRate,
    status: band(mockData.cockpit.quality.dataCompleteRate) as Status,
  },
  ...typeRates.value.map((r) => ({
    label: r.label,
    value: r.value,
    status: band(r.value) as Status,
  })),
]);

const worstItems = computed(() =>
  [...liveMonitors.value]
    .sort((a, b) => pointRate(a) - pointRate(b))
    .slice(0, 4)
    .map((m) => ({ label: shortId(m), value: pointRate(m), status: band(pointRate(m)) as Status })),
);

/* ---------- realtime 引擎接线（1 期 mock · 2 期切 SSE） ---------- */
onMounted(() => {
  void hydrateMonitors();
  void hydrateAlerts();
  realtime.start({
    monitors: mockData.monitors,
    alertPool: mockData.alerts,
    aProjects: mockData.projects.filter((p) => p.grade === 'A'),
  });

  offs.push(onRealtime('monitor', (evt) => {
    const points = evt.data.points as Array<{ id: string; value: number }>;
    liveMonitors.value = liveMonitors.value.map((m) => {
      const hit = points.find((pt) => pt.id === m.id);
      return hit ? { ...m, value: hit.value } : m;
    });
  }));

  offs.push(onRealtime('alert', (evt) => {
    liveAlerts.value = [evt.data as unknown as EmergencyEvent, ...liveAlerts.value].slice(0, 12);
  }));

  offs.push(onRealtime('pump', (evt) => {
    const stations = evt.data.stations as PumpSnapshot[];
    const next: Record<string, PumpSnapshot> = { ...pumpLive.value };
    for (const s of stations) next[s.projectId] = s;
    pumpLive.value = next;
  }));

  offs.push(onRealtime('kpi', (evt) => {
    const d = evt.data as { onlineRate?: number };
    if (d.onlineRate) liveOnlineRate.value = d.onlineRate;
  }));
});

onBeforeUnmount(() => {
  realtime.stop();
  offs.forEach((off) => off());
});
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
  height: 76px;
  margin: 12px 12px 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: var(--night-navy);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  overflow: hidden;
}
.kpi-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: var(--border-w) solid var(--line-vein);
  position: relative;
}
.kpi-cell:last-child { border-right: none; }
.kpi-cell.is-alarm {
  background: rgba(255, 92, 92, 0.06);
}
.kpi-cell.is-alarm::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--status-alarm);
}

/* ===== 主栅格：3 列（400 / flex / 400） ===== */
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 400px 1fr 400px;
  gap: var(--panel-gap);
  padding: var(--panel-gap);
}
.col {
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
  min-height: 0;
  min-width: 0;
}
.f16 { flex: 1.6 1 0; min-height: 0; }
.f12 { flex: 1.2 1 0; min-height: 0; }
.f10 { flex: 1 1 0; min-height: 0; }

/* ===== 测点选择 ===== */
.picker {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}
.picker::-webkit-scrollbar { width: 4px; }
.picker::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.25); border-radius: 2px; }

.ghead {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
  padding: 6px 2px 4px;
}
.ghead b {
  margin-left: auto;
  font-weight: 600;
  font-size: 12px;
  color: var(--text);
}
.gd {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.mon {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  margin-bottom: 3px;
  font-size: 13px;
  color: var(--text);
  background: rgba(12, 35, 64, 0.4);
  border: var(--border-w) solid transparent;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease;
}
.mon:hover { background: rgba(0, 194, 255, 0.1); }
.mon.active {
  background: rgba(0, 194, 255, 0.14);
  border-color: rgba(0, 194, 255, 0.55);
}
.mon:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: 1px;
}
.sd {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.mid {
  flex: 0 0 58px;
  font-weight: 600;
  font-size: 13px;
}
.mproj {
  flex: 1;
  min-width: 0;
  color: var(--text-dim);
  font-size: 12px;
  text-align: left;
}
.mval {
  flex: none;
  font-weight: 600;
  font-size: 13px;
  text-align: right;
}
.mval .mu {
  font-family: var(--cn);
  font-weight: 400;
  font-size: 11px;
  color: var(--text-dim);
  margin-left: 2px;
}
.mval.bad { color: var(--status-alarm); }

/* ===== 泵站状态 ===== */
.pumps {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: minmax(0, 1fr);
  gap: 8px;
}
.pump-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: rgba(12, 35, 64, 0.5);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
}
.pump-card.st-alarm { border-color: rgba(255, 92, 92, 0.55); }
.phead {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pname {
  font-weight: 700;
  font-size: 15px;
}
.psu {
  font-size: 11px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pst {
  margin-left: auto;
  font-size: 11px;
}
.stc-normal { color: var(--spring-green); }
.stc-alarm { color: var(--status-alarm); }
.stc-repair { color: var(--steppe-amber); }
.stc-stop,
.stc-offline { color: var(--text-dim); }

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 1px;
  border: var(--border-w) solid transparent;
}
.chip .led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.chip-run {
  color: var(--spring-green);
  border-color: rgba(0, 255, 224, 0.35);
  background: rgba(0, 255, 224, 0.07);
}
.chip-run .led { background: var(--spring-green); }
.chip-standby {
  color: var(--flood-teal);
  border-color: rgba(0, 194, 255, 0.3);
  background: rgba(0, 194, 255, 0.06);
}
.chip-standby .led { background: var(--flood-teal); }
.chip-fault {
  color: var(--status-alarm);
  border-color: rgba(255, 92, 92, 0.5);
  background: rgba(255, 92, 92, 0.1);
}
.chip-fault .led {
  background: var(--status-alarm);
  animation: led-blink 1s infinite;
}
@keyframes led-blink {
  50% { opacity: 0.25; }
}

.pfoot {
  margin-top: auto;
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
}

/* ===== 数据完整率 ===== */
.complete {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  gap: 4px;
}
.complete .sb :deep(.sb-label) { flex: 0 0 84px; }
.complete .sb :deep(.sb-value) { flex: 0 0 48px; font-size: 14px; }
.c-cap {
  font-size: 12px;
  color: var(--text-dim);
  padding: 4px 0 2px;
  border-top: var(--border-w) solid var(--line-vein);
}

@media (prefers-reduced-motion: reduce) {
  .chip-fault .led { animation: none; }
}
</style>
