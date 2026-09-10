<!--
  pipe-network/Dashboard.vue — 旗县供水统管大屏主视图（1920×1080）
  视觉标准：preview.html + design-system §5 / §11
  · 中央：WebGL Stage（Track A）+ Legend/CityToggle 浮层
  · 左列：CockpitPanel · 右列：AlertList + MonitorPanel
  · 趋势带：左 TrendLine（取/供/售 24h）/ 右 SparkLine（瞬时流量·压力）
  · 点位点击 → ModelViewer 浮窗（仅 A 级；其他级别静默）
  · 全部数据从 mockData 取（1 期 USE_MOCK 恒 true）
-->
<template>
  <DashboardLayout>
    <!-- 中央 WebGL 一张图 -->
    <template #map>
      <div ref="stageRef" class="stage-host" aria-label="工程一张图">
        <!-- Stage 容器；createStage 在 onMounted 注入 canvas -->
        <div v-if="!stageReady" class="stage-placeholder">
          <div class="ph-grid" aria-hidden="true"></div>
          <span class="ph-text">WebGL 渲染中 · 等待 Stage 初始化</span>
        </div>

        <!-- 地图左下：图例浮层 -->
        <div class="overlay legend-slot">
          <Legend
            :projects="legendProjects"
            :alarms="legendAlarms"
            @toggle-grade="onToggleGrade"
            @toggle-status="onToggleStatus"
          />
        </div>

        <!-- 地图右上：镇区建筑群控件 + 一键复位视角 -->
        <div class="overlay city-slot">
          <CityToggle
            v-model:enabled="cityOn"
            v-model:density="cityDensity"
          />
          <button
            class="reset-view"
            title="复位视角（回初始 25° 俯仰 + 旗县居中）"
            @click="resetCamera"
          >⌖ 复位视角</button>
        </div>
      </div>
    </template>

    <!-- 右列：实时告警（alert 频道置顶）+ 水质/运维微条 -->
    <template #right>
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

    <!-- 3D 详情浮窗（A 级才打开） -->
    <ModelViewer
      v-model:open="viewerOpen"
      :project="viewerProject"
      :origin="viewerOrigin"
    />
  </DashboardLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import DashboardLayout from '@/views/DashboardLayout.vue';
import Panel from '@ui/Panel.vue';
import Legend from '@ui/Legend.vue';
import CityToggle from '@ui/CityToggle.vue';
import ModelViewer from '@ui/ModelViewer.vue';
import TrendLine from '@charts/TrendLine.vue';
import SparkLine from '@charts/SparkLine.vue';
import createStage from '@canvas/Stage';
import type { Stage } from '@canvas/Stage';
import { mockData } from '@mock/index';
import { realtime, onRealtime, apiFetch } from '@/composables/realtime';
import AlertList from './AlertList.vue';
import MonitorPanel from './MonitorPanel.vue';
import type { Project, Status, Grade, EmergencyEvent } from '@shared/types';

type CityDensity = 'low' | 'mid' | 'high';
const STATUS_ORDER: Status[] = ['normal', 'alarm', 'repair', 'stop', 'offline'];

/* ---------- Stage 引用 ---------- */
const stageRef = ref<HTMLDivElement | null>(null);
let stage: Stage | null = null;
const stageReady = ref(false);

/* ---------- 全局状态（Track A 图层显隐/密度，1 期由本视图持有）---------- */
const cityOn = ref(true);
const cityDensity = ref<CityDensity>('mid');
const hiddenGrades = ref<Set<Grade>>(new Set());

/* ---------- ModelViewer 状态 ---------- */
const viewerOpen = ref(false);
const viewerProject = ref<Project | null>(null);
const viewerOrigin = ref<{ x: number; y: number } | null>(null);
const kpiOnlineRate = ref(91.6);

/* ---------- 工程数据（mock 起步 → 后端 /api/projects 水合覆盖） ---------- */
const liveProjects = ref<Project[]>(mockData.projects);

/* ---------- 派生：Legend 计数 ---------- */
const legendProjects = computed(() => {
  const cnt: Partial<Record<Grade, number>> = { A: 0, B: 0, C: 0, D: 0 };
  for (const p of liveProjects.value) cnt[p.grade] = (cnt[p.grade] ?? 0) + 1;
  return cnt;
});
const legendAlarms = computed(() => {
  const cnt: Partial<Record<Status, number>> = {};
  for (const s of STATUS_ORDER) cnt[s] = mockData.cockpit.statusBreakdown[s] ?? 0;
  return cnt;
});

/* ---------- 派生：趋势带（24h 序列）---------- */
const trendLabels = computed(() => {
  // 24 个整点标签
  const arr: string[] = [];
  for (let h = 0; h < 24; h++) arr.push(`${String(h).padStart(2, '0')}:00`);
  return arr;
});
/** 取/供/售水量 — 基于 mockData.cockpit.todaySupply 按日曲线缩放（确定性） */
const trendSeries = computed(() => {
  const base = mockData.cockpit.water.todaySupply * 1000; // 万 m³ → m³
  // 日内 24h 形状：早 8 / 晚 8 双峰（与 monitors.ts genHistory 同源）
  const take = (i: number) => {
    const phase = (i / 24) * Math.PI * 2;
    return base * (0.06 + 0.05 * Math.sin(phase - Math.PI / 2));
  };
  // 供水略低于取水（漏损 18.1%），售水再低 8%
  const supply = (i: number) => take(i) * 0.819;
  const sold = (i: number) => supply(i) * 0.92;
  const takeData = Array.from({ length: 24 }, (_, i) => Math.round(take(i)));
  const supplyData = Array.from({ length: 24 }, (_, i) => Math.round(supply(i)));
  const soldData = Array.from({ length: 24 }, (_, i) => Math.round(sold(i)));
  return [
    { name: '取水量', data: takeData },
    { name: '供水量', data: supplyData },
    { name: '售水量', data: soldData },
  ];
});

/* ---------- 实时状态（realtime 引擎驱动） ---------- */
const liveAlerts = ref<EmergencyEvent[]>([...mockData.alerts]);
const offs: Array<() => void> = [];

/* ---------- 派生：右侧 SparkLine（瞬时流量 / 压力） ---------- */
/** 初始 24 点形态：类型中位数 + 双峰（与 monitors.ts genHistory 同源），实时值由 monitor 频道滚动追加 */
function buildFlowSeries(): number[] {
  const flows = mockData.monitors
    .filter((m) => m.type === 'flow')
    .map((m) => m.value)
    .sort((a, b) => a - b);
  const mid = flows[Math.floor(flows.length / 2)] ?? 80;
  return Array.from({ length: 24 }, (_, i) => {
    const phase = (i / 24) * Math.PI * 2;
    return Math.max(40, Math.round(mid + 18 * Math.sin(phase - Math.PI / 2) + (i % 5 - 2) * 4));
  });
}
function buildPressureSeries(): number[] {
  const pres = mockData.monitors
    .filter((m) => m.type === 'pressure')
    .map((m) => m.value)
    .sort((a, b) => a - b);
  const mid = pres[Math.floor(pres.length / 2)] ?? 0.3;
  return Array.from({ length: 24 }, (_, i) => {
    const phase = (i / 24) * Math.PI * 2;
    return Math.max(0.15, +(mid + 0.06 * Math.sin(phase - Math.PI / 2) + (i % 4 - 1.5) * 0.012).toFixed(3));
  });
}
const flowSeries = ref<number[]>(buildFlowSeries());
const pressureSeries = ref<number[]>(buildPressureSeries());

/* ---------- 高度：趋势带可用高度 ≈ 176 - 顶栏 48 - panel 标题 ≈ 110 ---------- */
const trendHeight = 110;
const sparkHeight = 48;

/** 一键复位视角：回初始 25° 俯仰 + 旗县居中 + 默认缩放（模板可调） */
function resetCamera(): void {
  stage?.setCityBBoxFromBase();
}

/* ---------- Stage 接线 ---------- */
onMounted(() => {
  if (!stageRef.value) return;
  stage = createStage(stageRef.value);

  // 实时数据引擎（1 期 mock 模拟 · 2 期切 SSE）
  realtime.start({ monitors: mockData.monitors, alertPool: mockData.alerts });

  offs.push(onRealtime('kpi', (evt) => {
    const d = evt.data as Record<string, number>;
    if (d.onlineRate) kpiOnlineRate.value = d.onlineRate;
  }));

  // 新告警置顶（上限 12 条，与滚动列表容量匹配）
  offs.push(onRealtime('alert', (evt) => {
    liveAlerts.value = [evt.data as unknown as EmergencyEvent, ...liveAlerts.value].slice(0, 12);
  }));

  // 瞬时流量/压力曲线滚动追加（24 点窗口）
  offs.push(onRealtime('monitor', (evt) => {
    const points = evt.data.points as Array<{ type: string; value: number }>;
    for (const pt of points) {
      if (pt.type === 'flow') {
        flowSeries.value.push(Math.round(pt.value));
        flowSeries.value.shift();
      } else if (pt.type === 'pressure') {
        pressureSeries.value.push(+pt.value.toFixed(3));
        pressureSeries.value.shift();
      }
    }
  }));

  // 喂入业务数据（mock 起步；真数据由 hydrateProjects 异步覆盖）
  stage.setProjects(liveProjects.value);
  stage.setPipes(mockData.pipes);
  stage.setMonitors(mockData.monitors);
  stage.setAlerts(mockData.alerts);
  void hydrateProjects();

  // 城市场景需要 base bbox（Track A 在 BaseMap init 时异步拿 banner.json）
  // 安排一个微任务重试，确保首次拿到 bbox
  // banner 异步加载完成后飞相机 — 轮询直到成功（fetch 时序不确定，固定延时不可靠）
  const flyTimer = setInterval(() => {
    if (stage?.setCityBBoxFromBase()) {
      clearInterval(flyTimer);
    }
  }, 400);
  setTimeout(() => clearInterval(flyTimer), 15000); // 15s 兜底停表

  // 飞线（流量监测点 → 任一 A 级水厂工厂）
  const flowMonitors = mockData.monitors.filter((m) => m.type === 'flow');
  const factory = liveProjects.value.find((p) => p.grade === 'A' && p.status === 'normal') ?? liveProjects.value[0];
  if (factory) stage.setFlyLines(flowMonitors.slice(0, 6), factory);

  // 城市密度同步
  stage.setCityDensity(cityDensity.value);

  // 点击事件 → 打开 ModelViewer（仅 A 级）
  stage.on('layer:click', (payload) => {
    const id = String(payload ?? '');
    const proj = liveProjects.value.find((p) => p.id === id);
    if (!proj) return;
    if (proj.grade !== 'A') return; // §11.2 仅 A 级进入 3D
    viewerProject.value = proj;
    viewerOrigin.value = null; // 1 期默认中心；如需锚点可读取 pointer 位置
    viewerOpen.value = true;
  });

  stageReady.value = true;
});

/** 后端 /api/projects 水合：真工程覆盖 mock（失败静默保留 mock） */
async function hydrateProjects(): Promise<void> {
  const data = await apiFetch<{ total: number; items: Array<Record<string, unknown>> }>('/api/projects');
  if (!data?.items?.length || !stage) return;
  const projects: Project[] = data.items.map((p) => ({
    id: String(p.code),
    name: String(p.name),
    grade: p.grade as Grade,
    status: p.status as Status,
    coord: [Number(p.lon), Number(p.lat)],
    suMu: String(p.su_mu),
    responsible: String(p.responsible ?? ''),
    metrics: {},
  }));
  liveProjects.value = projects;
  stage.setProjects(projects); // 图层可重入（PlantLayer 先清旧再建）
  // 飞线终点随真厂归位
  const flowMonitors = mockData.monitors.filter((m) => m.type === 'flow');
  const factory = projects.find((p) => p.grade === 'A' && p.status === 'normal') ?? projects[0];
  if (factory) stage.setFlyLines(flowMonitors.slice(0, 6), factory);
}

onBeforeUnmount(() => {
  realtime.stop();
  offs.forEach((off) => off());
  if (stage) {
    stage.dispose();
    stage = null;
  }
});

/* ---------- 联动：cityOn / cityDensity / Legend 显隐 ---------- */
watch(cityOn, (v) => {
  if (!stage) return;
  stage.setLayerVisible('City', v);
});
watch(cityDensity, (v) => {
  if (!stage) return;
  stage.setCityDensity(v);
});

function onToggleGrade(grade: Grade, visible: boolean) {
  if (!stage) return;
  // ProjectLayer 内部按 grade 过滤：这里重新 setProjects，但只切可见性
  // 简化：直接 setLayerVisible（全部 Project 显隐）；如需更细可调 Track A 扩展
  const next = new Set(hiddenGrades.value);
  if (visible) next.delete(grade);
  else next.add(grade);
  hiddenGrades.value = next;
  // 当前简化：只要隐藏集合非空就关掉 Project 层（避免做精细过滤）
  stage.setLayerVisible('Project', next.size === 0);
}
function onToggleStatus(_status: Status, _visible: boolean) {
  // ProjectLayer 的状态着色由 setProjects 决定；隐藏状态通过视觉重渲染由 Stage 内部处理
  // 此处保留入口，1 期 no-op
}
</script>

<style scoped>
/* ===== 中央 WebGL 容器 ===== */
.stage-host {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.stage-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    ellipse 70% 60% at 50% 45%,
    #0e2a4a 0%,
    var(--surface-blue) 45%,
    var(--well-deep) 100%
  );
}
.stage-placeholder .ph-grid {
  position: absolute;
  inset: 8% 6%;
  background:
    repeating-linear-gradient(0deg, rgba(0, 194, 255, 0.07) 0 1px, transparent 1px 64px),
    repeating-linear-gradient(90deg, rgba(0, 194, 255, 0.07) 0 1px, transparent 1px 64px);
  mask-image: radial-gradient(ellipse 80% 70% at 50% 50%, #000 30%, transparent 80%);
  pointer-events: none;
}
.ph-text {
  position: relative;
  color: var(--text-dim);
  font-size: 13px;
  letter-spacing: 1px;
}

/* ===== 浮层：图例 + 镇区建筑群 ===== */
.overlay {
  position: absolute;
  z-index: 3;
  pointer-events: auto;
}
.legend-slot {
  left: 16px;
  bottom: 16px;
}
.city-slot {
  right: 16px;
  top: 16px;
}

/* ===== 趋势带内 ===== */
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

<style scoped>
.reset-view {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 5px 0;
  font-size: 12px;
  color: var(--spring-green, #00ffe0);
  background: rgba(7, 21, 37, 0.85);
  border: 1px solid rgba(0, 255, 224, 0.4);
  border-radius: 2px;
  cursor: pointer;
}
.reset-view:hover {
  background: rgba(0, 255, 224, 0.12);
}
</style>
