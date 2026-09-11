<!--
  pipe-network/Dashboard.vue — 工程一张图（v8 · SVG MapCanvas 版）
  视觉标准：tokens.css + 事件地图同款技术栈（T2 轨道产出）
  · 中央：MapCanvas 九层 SVG（双线边界/choropleth 在线率/管线 DN/工程点形状编码/告警脉冲/扫光/入场编排）
  · 右上：图层开关 chip 组（数据过滤驱动）· 复位按钮
  · 左列：CockpitPanel · 右列：详情卡（工程/告警）+ AlertList + MonitorPanel
  · 趋势带：TrendLine（取/供/售 24h）/ SparkLine（瞬时流量·压力）
  · 数据：mock 起步 → /api/* 水合覆盖（projects/monitors/pipes/alerts）+ realtime 四频道
-->
<template>
  <DashboardLayout>
    <!-- 中央 SVG 一张图 -->
    <template #map>
      <div class="map-host">
        <MapCanvas
          ref="mapRef"
          :tilt="tiltDeg"
          :projects="liveProjects"
          :monitors="layerFiltered.monitors"
          :pipes="layerFiltered.pipes"
          :alerts="layerFiltered.alerts"
          :selected-project-id="selectedProject?.id ?? null"
          :selected-monitor-id="selectedMonitor?.id ?? null"
          :selected-event-id="selectedAlert?.id ?? null"
          @project-click="onProjectClick"
          @alert-click="onAlertClick"
          @monitor-click="onMonitorClick"
        />

        <!-- 全屏态：未签收浮标（点击唤出告警抽屉） -->
        <button
          v-if="app.fullscreen"
          class="fs-alarm-fab num"
          :class="{ warn: fabCount > 0 }"
          type="button"
          @click="drawerOpen = true"
        >
          <i class="fab-dot" aria-hidden="true"></i>未签收 <b>{{ fabCount }}</b>
        </button>

        <!-- 告警抽屉（全屏态） -->
        <Teleport to="body">
          <div v-if="drawerOpen" class="fs-drawer-mask" @click="drawerOpen = false">
            <aside class="fs-drawer" @click.stop>
              <div class="fs-drawer-head">
                <span>实时告警</span>
                <button class="fs-drawer-close" type="button" @click="drawerOpen = false">✕</button>
              </div>
              <AlertList :alerts="liveAlerts" />
            </aside>
          </div>
        </Teleport>

        <!-- 右上：图层开关 chip 组 + 复位 -->
        <div class="overlay chips-slot">
          <button
            v-for="c in LAYER_CHIPS"
            :key="c.key"
            type="button"
            class="chip"
            :class="{ off: !layers[c.key] }"
            :style="{ '--chip-c': c.color }"
            @click="layers[c.key] = !layers[c.key]"
          >{{ c.label }}</button>
          <button class="chip reset" title="复位视角" @click="mapRef?.reset()">⌖ 复位</button>
          <div class="tilt-group" role="group" aria-label="视角角度">
            <button
              v-for="a in TILT_STEPS"
              :key="a"
              type="button"
              class="chip tilt"
              :class="{ on: tiltDeg === a }"
              @click="tiltDeg = a"
            >{{ a === 0 ? '2D' : a + '°' }}</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 右列：详情卡（工程/告警互斥）+ 实时告警 + 水质/运维微条 -->
    <template #right>
      <Panel
        v-if="detail"
        :variant="detail.kind === 'alert' ? 'alarm' : 'default'"
        :title="detail.kind === 'alert' ? '告警详情' : detail.kind === 'monitor' ? '监测点详情' : '工程详情'"
        :sub="detail.id"
        class="detail-card"
      >
        <div class="dfields">
          <div class="df"><span class="k">{{ detail.kind === 'monitor' ? '所属工程' : detail.kind === 'alert' ? '位置' : '所属' }}</span><span class="v2" :title="detail.rows.location">{{ detail.rows.location }}</span></div>
          <div class="df"><span class="k">{{ detail.kind === 'monitor' ? '类型' : detail.kind === 'alert' ? '等级' : '分级' }}</span><span class="v2">{{ detail.rows.grade }}</span></div>
          <div class="df"><span class="k">状态</span><span class="v2">{{ detail.rows.status }}</span></div>
          <div class="df"><span class="k">{{ detail.kind === 'monitor' ? '实时值' : '责任人' }}</span><span class="v2">{{ detail.rows.owner }}</span></div>
        </div>
        <div class="ddesc">{{ detail.rows.desc }}</div>
      </Panel>
      <AlertList :alerts="liveAlerts" />
      <MonitorPanel />
    </template>

    <!-- 底部趋势带：左 TrendLine / 右 SparkLine -->
    <template #trend>
      <Panel title="取·供·售水量 24h" sub="趋势">
        <template #sub>
          <i class="dot c1" aria-hidden="true"></i>取水
          <i class="dot c2" aria-hidden="true"></i>供水
          <i class="dot c3" aria-hidden="true"></i>售水
        </template>
        <TrendLine
          :series="trendSeries"
          :x-labels="trendLabels"
          :height="trendHeight"
          :show-legend="false"
        />
      </Panel>
      <Panel title="瞬时流量 · 压力" sub="实时">
        <template #sub>
          <i class="dot c2" aria-hidden="true"></i>流量 m³/h
          <i class="dot c1" aria-hidden="true"></i>压力 MPa
        </template>
        <div class="spark">
          <SparkLine
            :data="flowSeries"
            :height="sparkHeight"
            unit=" m³/h"
            color="var(--spring-green)"
            :threshold="80"
            threshold-color="var(--status-alarm)"
          />
          <SparkLine
            :data="pressureSeries"
            :height="sparkHeight"
            unit=" MPa"
            color="var(--flood-teal)"
            :threshold="0.42"
            threshold-color="var(--status-alarm)"
          />
        </div>
      </Panel>
    </template>
  </DashboardLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import DashboardLayout from '@/views/DashboardLayout.vue';
import Panel from '@ui/Panel.vue';
import TrendLine from '@charts/TrendLine.vue';
import SparkLine from '@charts/SparkLine.vue';
import MapCanvas from '@/components/map/MapCanvas.vue';
import { mockData } from '@mock/index';
import { realtime, onRealtime, apiFetch } from '@/composables/realtime';
import { mapProject, mapMonitor, mapPipe, mapAlert, unpackItems } from '@shared/backend';
import { useMapFocusStore } from '@stores/mapFocus';
import { useAppStore } from '@stores/app';
import AlertList from './AlertList.vue';
import MonitorPanel from './MonitorPanel.vue';
import type { EmergencyEvent, MonitorPoint, PipeSegment, Project } from '@shared/types';

/* ---------- 实时数据（mock 起步 → /api/* 水合覆盖；MapCanvas 响应式跟随） ---------- */
const liveProjects = ref<Project[]>(mockData.projects);
const liveMonitors = ref<MonitorPoint[]>(mockData.monitors);
const livePipes = ref<PipeSegment[]>(mockData.pipes);
const liveAlerts = ref<EmergencyEvent[]>([...mockData.alerts]);
const INITIAL_MOCK_IDS = new Set(mockData.alerts.map((a) => a.id));
const offs: Array<() => void> = [];

/* ---------- 图层开关（数据过滤驱动 · 工程点常显） ---------- */
const LAYER_CHIPS = [
  { key: 'pipes', label: '管网', color: 'var(--flood-teal)' },
  { key: 'monitors', label: '监测', color: 'var(--spring-green)' },
  { key: 'alerts', label: '告警', color: 'var(--status-alarm)' },
] as const;
type LayerKey = (typeof LAYER_CHIPS)[number]['key'];
const layers = ref<Record<LayerKey, boolean>>({ pipes: true, monitors: true, alerts: true });

const layerFiltered = computed(() => ({
  monitors: layers.value.monitors ? liveMonitors.value : [],
  pipes: layers.value.pipes ? livePipes.value : [],
  alerts: layers.value.alerts ? liveAlerts.value : [],
}));

/* ---------- 选中详情（工程/告警互斥） ---------- */
const mapRef = ref<InstanceType<typeof MapCanvas> | null>(null);
/** 视角多档：2D 俯视 ↔ 15/25/40° 伪 3D（默认 25°） */
const TILT_STEPS = [0, 15, 45, 55, 70, -85] as const;
const tiltDeg = ref<number>(45);
const app = useAppStore();
const drawerOpen = ref(false);
const fabCount = computed(() => liveAlerts.value.filter((a) => a.status === '未签收').length);
function onFsEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape') drawerOpen.value = false;
}
const selectedProject = ref<Project | null>(null);
const selectedAlert = ref<EmergencyEvent | null>(null);
const selectedMonitor = ref<MonitorPoint | null>(null);

interface DetailView {
  kind: 'project' | 'alert' | 'monitor';
  id: string;
  rows: { location: string; grade: string; status: string; owner: string; desc: string };
}
const detail = computed<DetailView | null>(() => {
  if (selectedMonitor.value) {
    const m = selectedMonitor.value;
    const over = m.status === 'alarm';
    return {
      kind: 'monitor', id: m.id,
      rows: {
        location: liveProjects.value.find((p) => p.id === m.projectId)?.name ?? m.projectId,
        grade: m.type,
        status: over ? '超标' : '正常',
        owner: `${m.value}`,
        desc: `${m.id} 实时监测值`,
      },
    };
  }
  if (selectedProject.value) {
    const p = selectedProject.value;
    return {
      kind: 'project', id: p.id,
      rows: { location: p.suMu, grade: `${p.grade} 级`, status: p.status, owner: p.responsible || '—', desc: p.name },
    };
  }
  if (selectedAlert.value) {
    const a = selectedAlert.value;
    return {
      kind: 'alert', id: a.id,
      rows: { location: a.location, grade: a.level, status: a.status, owner: a.receivedBy || '待派单', desc: a.description },
    };
  }
  return null;
});

function onProjectClick(p: Project): void {
  tiltDeg.value = 70;
  selectedProject.value = p;
  selectedAlert.value = null;
  selectedMonitor.value = null;
  mapRef.value?.focus(p.coord[0], p.coord[1]);
}

function onMonitorClick(m: MonitorPoint): void {
  tiltDeg.value = 70;
  selectedMonitor.value = selectedMonitor.value?.id === m.id ? null : m;
  selectedProject.value = null;
  selectedAlert.value = null;
  mapRef.value?.focus(m.coord[0], m.coord[1]);
}

function onAlertClick(a: EmergencyEvent): void {
  tiltDeg.value = 70;
  selectedAlert.value = a;
  selectedProject.value = null;
  selectedMonitor.value = null;
  // BX- 报修无工程坐标，仅选中不聚焦
  const coord = a.projectId ? liveProjects.value.find((p) => p.id === a.projectId)?.coord : undefined;
  if (coord) mapRef.value?.focus(coord[0], coord[1]);
}

/* ---------- 全局搜索定位：AppTopbar 请求 → 选中 + 聚焦 ---------- */
const focusStore = useMapFocusStore();
watch(
  () => focusStore.tick,
  (tick) => {
    if (!tick) return;
    const p = focusStore.pending;
    if (!p) return;
    // 工程若在水合后到达，按 id 补全为 live 数据
    const live = liveProjects.value.find((x) => x.id === p.id) ?? p;
    selectedProject.value = live;
    selectedAlert.value = null;
    mapRef.value?.focus(live.coord[0], live.coord[1]);
    focusStore.acknowledge();
  },
);

/* ---------- 派生：趋势带（24h 序列，确定性） ---------- */
const trendLabels = computed(() => {
  const arr: string[] = [];
  for (let h = 0; h < 24; h++) arr.push(`${String(h).padStart(2, '0')}:00`);
  return arr;
});
const trendSeries = computed(() => {
  const base = mockData.cockpit.water.todaySupply * 1000; // 万 m³ → m³
  const take = (i: number) => {
    const phase = (i / 24) * Math.PI * 2;
    return base * (0.06 + 0.05 * Math.sin(phase - Math.PI / 2));
  };
  const supply = (i: number) => take(i) * 0.819;
  const sold = (i: number) => supply(i) * 0.92;
  return [
    { name: '取水量', data: Array.from({ length: 24 }, (_, i) => Math.round(take(i))) },
    { name: '供水量', data: Array.from({ length: 24 }, (_, i) => Math.round(supply(i))) },
    { name: '售水量', data: Array.from({ length: 24 }, (_, i) => Math.round(sold(i))) },
  ];
});

/* ---------- 派生：SparkLine（瞬时流量 / 压力，monitor 频道滚动追加） ---------- */
function buildFlowSeries(): number[] {
  const flows = mockData.monitors.filter((m) => m.type === 'flow').map((m) => m.value).sort((a, b) => a - b);
  const mid = flows[Math.floor(flows.length / 2)] ?? 80;
  return Array.from({ length: 24 }, (_, i) => {
    const phase = (i / 24) * Math.PI * 2;
    return Math.max(40, Math.round(mid + 18 * Math.sin(phase - Math.PI / 2) + (i % 5 - 2) * 4));
  });
}
function buildPressureSeries(): number[] {
  const pres = mockData.monitors.filter((m) => m.type === 'pressure').map((m) => m.value).sort((a, b) => a - b);
  const mid = pres[Math.floor(pres.length / 2)] ?? 0.3;
  return Array.from({ length: 24 }, (_, i) => {
    const phase = (i / 24) * Math.PI * 2;
    return Math.max(0.15, +(mid + 0.06 * Math.sin(phase - Math.PI / 2) + (i % 4 - 1.5) * 0.012).toFixed(3));
  });
}
const flowSeries = ref<number[]>(buildFlowSeries());
const pressureSeries = ref<number[]>(buildPressureSeries());

const trendHeight = 110;
const sparkHeight = 48;

/* ---------- 生命周期：引擎 + 频道订阅 + 水合 ---------- */
onMounted(() => {
  realtime.start({ monitors: mockData.monitors, alertPool: mockData.alerts });

  offs.push(onRealtime('alert', (evt) => {
    liveAlerts.value = [evt.data as unknown as EmergencyEvent, ...liveAlerts.value].slice(0, 12);
  }));

  offs.push(onRealtime('monitor', (evt) => {
    const points = evt.data.points as Array<{ id: string; type: string; value: number }>;
    // 曲线滚动 + liveMonitors 值更新（MapCanvas 响应式跟随）
    for (const pt of points) {
      if (pt.type === 'flow') {
        flowSeries.value.push(Math.round(pt.value));
        flowSeries.value.shift();
      } else if (pt.type === 'pressure') {
        pressureSeries.value.push(+pt.value.toFixed(3));
        pressureSeries.value.shift();
      }
    }
    liveMonitors.value = liveMonitors.value.map((m) => {
      const hit = points.find((pt) => pt.id === m.id);
      return hit ? { ...m, value: hit.value } : m;
    });
  }));

  void hydrateProjects();
  void hydrateMonitors();
  void hydratePipes();
  void hydrateAlerts();
});

onMounted(() => {
  window.addEventListener('keydown', onFsEsc);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onFsEsc);
  realtime.stop();
  offs.forEach((off) => off());
});

/** 后端 /api/projects 水合（失败静默保留 mock） */
async function hydrateProjects(): Promise<void> {
  const items = unpackItems(await apiFetch('/api/projects'));
  if (!items?.length) return;
  liveProjects.value = items.map(mapProject);
}

/** 后端 /api/monitors 水合 */
async function hydrateMonitors(): Promise<void> {
  const items = unpackItems(await apiFetch('/api/monitors'));
  if (!items?.length) return;
  liveMonitors.value = items.map(mapMonitor);
}

/** 后端 /api/pipes 水合 */
async function hydratePipes(): Promise<void> {
  const items = unpackItems(await apiFetch('/api/pipes'));
  if (!items?.length) return;
  livePipes.value = items.map(mapPipe);
}

/** 后端 /api/alerts 水合（置顶保留 SSE 增量防竞态） */
async function hydrateAlerts(): Promise<void> {
  const items = unpackItems(await apiFetch('/api/alerts'));
  if (!items?.length) return;
  const stock = new Set(items.map((a) => String(a.id)));
  const pending = liveAlerts.value.filter((a) => !stock.has(a.id) && !INITIAL_MOCK_IDS.has(a.id));
  liveAlerts.value = [...pending, ...items.map(mapAlert)].slice(0, 12);
}
</script>

<style scoped>
.map-host {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* 图层开关 chip 组（右上常驻） */
.overlay.chips-slot {
  position: absolute;
  z-index: 3;
  bottom: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}
.chip {
  padding: 4px 12px;
  font-size: 12px;
  color: var(--chip-c, var(--flood-teal));
  background: rgba(3, 8, 18, 0.8);
  border: 1px solid var(--line-vein);
  border-left: 2px solid var(--chip-c, var(--flood-teal));
  border-radius: 2px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.chip.off {
  opacity: 0.45;
  color: var(--text-dim);
  border-left-color: var(--text-dim);
}
.chip.reset {
  color: var(--spring-green);
  border-left-color: var(--spring-green);
}
.tilt-group {
  display: flex;
  gap: 4px;
}
.chip.tilt {
  color: var(--flood-teal);
  border-left-color: var(--flood-teal);
  min-width: 36px;
  text-align: center;
  opacity: 0.55;
}
.chip.tilt.on {
  opacity: 1;
  background: rgba(0, 194, 255, 0.14);
  border-color: rgba(0, 194, 255, 0.55);
}
.chip:hover { opacity: 1; }

/* 详情卡（右列顶部） */
.detail-card { flex: none; }
.dfields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
  margin-bottom: 8px;
}
.df {
  display: flex;
  gap: 8px;
  font-size: 13px;
  min-width: 0;
  line-height: 1.5;
}
.df .k { flex: none; color: var(--text-dim); }
.df .v2 {
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ddesc {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.6;
  border-left: 3px solid var(--flood-teal);
  background: rgba(0, 194, 255, 0.06);
  padding: 5px 10px;
  border-radius: 0 var(--radius) var(--radius) 0;
}

/* ===== 全屏态：未签收浮标 + 告警抽屉 ===== */
.fs-alarm-fab {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  font-size: 13px;
  color: var(--text-dim);
  background: rgba(3, 8, 18, 0.78);
  backdrop-filter: blur(4px);
  border: var(--border-w) solid rgba(0, 194, 255, 0.25);
  border-radius: var(--radius);
  cursor: pointer;
}
.fs-alarm-fab b { font-size: 16px; color: var(--text); }
.fs-alarm-fab.warn {
  border-color: rgba(255, 92, 92, 0.55);
  color: #ff9e9e;
}
.fs-alarm-fab.warn b { color: var(--status-alarm); }
.fab-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(0, 194, 255, 0.5);
}
.fs-alarm-fab.warn .fab-dot {
  background: var(--status-alarm);
  box-shadow: 0 0 8px var(--status-alarm);
  animation: fab-pulse 1.2s infinite;
}
@keyframes fab-pulse {
  50% { opacity: 0.3; }
}

.fs-drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(3, 8, 18, 0.4);
}
.fs-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  display: flex;
  flex-direction: column;
  padding: 14px;
  background: rgba(3, 8, 18, 0.92);
  border-left: var(--border-w) solid var(--line-vein);
}
.fs-drawer-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text);
  border-bottom: var(--border-w) solid var(--line-vein);
}
.fs-drawer-close {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 14px;
  cursor: pointer;
}
.fs-drawer-close:hover { color: var(--spring-green); }
.fs-drawer .alerts { max-width: none; }

/* 全屏态地图满幅（去栅格 padding 后铺满） */
.mc-root {
  transition: transform 0.32s ease-out;
}
.mc-root.fs-breath {
  animation: fs-breath 0.32s ease-out;
}
@keyframes fs-breath {
  0% { transform: scale(1.02); }
  100% { transform: scale(1); }
}

/* 趋势带内 */
.dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 3px;
  vertical-align: -1px;
}
.dot.c1 { background: var(--chart-1); }
.dot.c2 { background: var(--chart-2); }
.dot.c3 { background: var(--chart-3); }
.dot + .dot { margin-left: 10px; }

.spark {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-height: 0;
  justify-content: center;
}
</style>
