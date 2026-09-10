<!--
  patrol/Dashboard.vue — 巡检工单大屏（需求 §七 巡检养护与工单闭环）
  · v-scale-screen 1920×1080
  · 顶部 KPI 条：巡检完成率 / 工单办结率 / 平均修复时间 / 重复故障率
  · 左列：今日巡检计划 + 本周巡检完成；中列：工单看板（待接单/处理中/已完成）
  · 右列：巡检覆盖率（按苏木乡镇）+ 工单类型分布
  · 底部带：近7日巡检·办结趋势（TrendLine）+ 维修人员工作量（MicroBar）
  · 工单 mock：mockData.alerts 映射（未签收→待接单 / 已派单·已签收→处理中）+ 现场确定性衍生
-->
<template>
  <VScaleScreen
    :width="1920"
    :height="1080"
    :full-screen="false"
    :box-style="{ background: '#030812' }"
  >
    <div class="screen">
      <TopBar />

      <!-- 顶部 KPI 条 -->
      <div class="kpi-strip">
        <div class="kpi-cell">
          <KpiCard :value="kpi.patrolRate" unit="%" label="巡检完成率" glow />
        </div>
        <div class="kpi-cell">
          <KpiCard :value="kpi.closeRate" unit="%" label="工单办结率" glow />
        </div>
        <div class="kpi-cell">
          <KpiCard :value="kpi.avgFixHours" unit="h" label="平均修复时间" :decimals="1" />
        </div>
        <div class="kpi-cell">
          <KpiCard :value="kpi.repeatRate" unit="%" label="重复故障率" :decimals="1" />
        </div>
      </div>

      <!-- 主栅格 -->
      <main class="grid">
        <!-- 左列：巡检计划 -->
        <div class="col-left">
          <Panel class="plans-panel" title="今日巡检计划" :sub="`${plans.length} 条线路`">
            <div class="plan-list">
              <div v-for="pl in plans" :key="pl.name" class="plan-item">
                <div class="plan-head">
                  <span class="plan-name">{{ pl.name }}</span>
                  <span class="plan-state" :style="{ color: PLAN_STATE_COLOR[pl.state], borderColor: PLAN_STATE_COLOR[pl.state] }">
                    {{ pl.state }}
                  </span>
                </div>
                <div class="plan-bar">
                  <i class="plan-fill" :style="{ width: `${pl.pct}%`, background: PLAN_STATE_COLOR[pl.state] }"></i>
                </div>
                <div class="plan-foot dim">
                  <span>巡检点 <b class="num">{{ pl.done }}</b>/{{ pl.tasks }}</span>
                  <span class="num">{{ pl.pct }}%</span>
                </div>
              </div>
            </div>
          </Panel>
          <Panel title="本周巡检完成" sub="按日">
            <div class="week-host">
              <MicroBar
                v-for="d in weekRates"
                :key="d.name"
                :label="d.name"
                :value="d.rate"
                unit="%"
                :color="d.rate >= 90 ? 'var(--spring-green)' : 'var(--steppe-amber)'"
              />
            </div>
          </Panel>
        </div>

        <!-- 中列：工单看板 -->
        <Panel class="board-panel" hero title="实时工单看板" :sub="`在单 ${orders.length - doneOrders.length} · 已完成 ${doneOrders.length}`">
          <div class="board">
            <div v-for="col in board" :key="col.state" class="board-col">
              <div class="bc-head" :style="{ borderColor: STATE_COLOR[col.state] }">
                <span class="bc-name">{{ col.state }}</span>
                <span class="bc-count num" :style="{ color: STATE_COLOR[col.state] }">{{ col.items.length }}</span>
              </div>
              <div class="bc-list">
                <div v-for="o in col.items" :key="o.id" class="wo-card">
                  <div class="wo-head">
                    <span class="wo-id num dim">{{ o.id }}</span>
                    <span class="wo-type" :style="{ color: TYPE_COLOR[o.type], borderColor: TYPE_COLOR[o.type] }">{{ o.type }}</span>
                  </div>
                  <div class="wo-project">{{ o.project }}</div>
                  <div class="wo-desc dim">{{ o.desc }}</div>
                  <div class="wo-foot dim">
                    <span class="num">{{ o.time }}</span>
                    <span>{{ o.person }}</span>
                  </div>
                </div>
                <div v-if="col.items.length === 0" class="bc-empty dim">暂无工单</div>
              </div>
            </div>
          </div>
        </Panel>

        <!-- 右列：覆盖率 + 类型分布 -->
        <div class="col-right">
          <Panel title="巡检覆盖率 · 苏木乡镇" sub="月度口径">
            <div class="cover-host">
              <MicroBar
                v-for="t in coverage"
                :key="t.name"
                :label="t.name"
                :value="t.rate"
                unit="%"
                :color="t.rate >= 85 ? 'var(--spring-green)' : 'var(--steppe-amber)'"
              />
            </div>
          </Panel>
          <Panel title="工单类型分布" :sub="`本月 ${orders.length} 单`">
            <div class="cover-host">
              <MicroBar
                v-for="t in typeDist"
                :key="t.type"
                :label="t.type"
                :value="t.count"
                :max="maxTypeCount"
                unit="单"
                :color="TYPE_COLOR[t.type]"
                :decimals="0"
              />
            </div>
          </Panel>
        </div>

        <!-- 底部趋势带 -->
        <div class="trend-band">
          <Panel class="trend-main" title="近7日巡检完成 · 工单办结" sub="趋势">
            <template #sub>
              <i class="dot d1" aria-hidden="true"></i>巡检完成率
              <i class="dot d2" aria-hidden="true"></i>工单办结率
            </template>
            <TrendLine
              :series="trendSeries"
              :x-labels="dayLabels"
              :height="110"
              :show-legend="false"
              smooth
            />
          </Panel>
          <Panel title="维修人员工作量" sub="本月接单">
            <div class="band-host">
              <MicroBar
                v-for="w in staffLoad"
                :key="w.name"
                :label="w.name"
                :value="w.count"
                :max="maxStaffCount"
                unit="单"
                color="var(--flood-teal)"
                :decimals="0"
              />
            </div>
          </Panel>
        </div>
      </main>
    </div>
  </VScaleScreen>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VScaleScreen from 'v-scale-screen';
import TopBar from '@ui/TopBar.vue';
import Panel from '@ui/Panel.vue';
import KpiCard from '@ui/KpiCard.vue';
import TrendLine from '@charts/TrendLine.vue';
import MicroBar from '@charts/MicroBar.vue';
import { mockData } from '@mock/index';
import { SUMU_CENTERS } from '@shared/sumu-anchors';
import type { EmergencyEvent } from '@shared/types';

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

/* ---------- 顶部 KPI ---------- */
const kpi = {
  patrolRate: 92.4,                              // 本月巡检完成率（行业基准 90+）
  closeRate: mockData.cockpit.ops.workOrderCloseRate, // 87.5
  avgFixHours: 4.2,
  repeatRate: 6.8,
};

/* ---------- 工单 mock：告警映射 + 现场确定性衍生 ---------- */
const ORDER_TYPES = ['管道抢修', '水泵维修', '水质处置', '设备更换', '冻堵处理', '例行保养'] as const;
type OrderType = (typeof ORDER_TYPES)[number];

const TYPE_COLOR: Record<OrderType, string> = {
  管道抢修: 'var(--status-alarm)',
  水泵维修: 'var(--steppe-amber)',
  水质处置: '#7EE081',
  设备更换: 'var(--flood-teal)',
  冻堵处理: '#8FA8FF',
  例行保养: 'var(--spring-green)',
};

type OrderState = '待接单' | '处理中' | '已完成';
const STATE_COLOR: Record<OrderState, string> = {
  待接单: 'var(--steppe-amber)',
  处理中: 'var(--flood-teal)',
  已完成: 'var(--spring-green)',
};

function alertType(t: EmergencyEvent['type']): OrderType {
  if (t === 'burst') return '管道抢修';
  if (t === 'equipment') return '水泵维修';
  if (t === 'water_quality') return '水质处置';
  if (t === 'frost') return '冻堵处理';
  return '设备更换';
}

function alertState(s: EmergencyEvent['status']): OrderState {
  if (s === '未签收') return '待接单';
  if (s === '已销号') return '已完成';
  return '处理中';
}

const p2 = (n: number) => String(n).padStart(2, '0');

interface WorkOrder {
  id: string;
  type: OrderType;
  project: string;
  desc: string;
  time: string;
  person: string;
  state: OrderState;
}

const SYNTH_DESCS = [
  '水泵盘根漏水，更换机械密封',
  'DN110 支管冻堵，蒸汽融通处理',
  '消毒药剂余量不足，现场补投加',
  '远传水表通信异常，更换通信模块',
  '变频器散热风扇异响，除尘紧固',
  '高位水池浮球阀卡滞，检修复位',
  '井房门锁损坏，更换并加装防护',
  '压力表读数漂移，重新校验',
];

const SYNTH_PERSONS = ['巴特尔', '朝鲁', '哈斯', '乌力吉', '苏乙拉', '其木德'];

function buildOrders(): WorkOrder[] {
  const list: WorkOrder[] = [];

  // 1) 告警引擎事件映射
  mockData.alerts.forEach((a) => {
    list.push({
      id: `WO-${a.id.replace('ALERT-', '')}`,
      type: alertType(a.type),
      project: a.location,
      desc: a.description,
      time: hhmm(a.time),
      person: a.receivedBy ?? '待派单',
      state: alertState(a.status),
    });
  });

  // 2) 现场衍生（巡检发现 / 报修转单），时间由近及远
  const rand = mulberry32(20260910);
  const main = mockData.projects.filter((p) => p.grade !== 'D');
  const baseMinutes = 8 * 60; // 08:00 起往回排
  for (let i = 0; i < 10; i++) {
    const proj = main[Math.floor(rand() * main.length)];
    const state: OrderState = i < 2 ? '待接单' : i < 6 ? '处理中' : '已完成';
    const minutes = baseMinutes + i * 27 + Math.floor(rand() * 20);
    list.push({
      id: `WO-${String(100 + i)}`,
      type: ORDER_TYPES[Math.floor(rand() * ORDER_TYPES.length)],
      project: proj.name,
      desc: SYNTH_DESCS[Math.floor(rand() * SYNTH_DESCS.length)],
      time: `${p2(Math.floor(minutes / 60) % 24)}:${p2(minutes % 60)}`,
      person: state === '待接单' ? '待派单' : SYNTH_PERSONS[Math.floor(rand() * SYNTH_PERSONS.length)],
      state,
    });
  }

  return list.sort((a, b) => (a.time < b.time ? 1 : -1));
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 5);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

const orders = buildOrders();
const doneOrders = orders.filter((o) => o.state === '已完成');

const board = computed(() => {
  const stateOrder: OrderState[] = ['待接单', '处理中', '已完成'];
  return stateOrder.map((state) => ({
    state,
    items: orders.filter((o) => o.state === state),
  }));
});

/* ---------- 工单类型分布 ---------- */
const typeDist = computed(() =>
  ORDER_TYPES.map((type) => ({
    type,
    count: orders.filter((o) => o.type === type).length,
  })).filter((t) => t.count > 0),
);
const maxTypeCount = computed(() => Math.max(1, ...typeDist.value.map((t) => t.count)));

/* ---------- 今日巡检计划（按苏木线路） ---------- */
type PlanState = '已完成' | '进行中' | '未开始';
const PLAN_STATE_COLOR: Record<PlanState, string> = {
  已完成: 'var(--spring-green)',
  进行中: 'var(--flood-teal)',
  未开始: 'var(--status-stop)',
};

const plans = computed(() => {
  const rand = mulberry32(15252401);
  return SUMU_CENTERS.slice(0, 6).map((c) => {
    const tasks = 6 + Math.floor(rand() * 9);
    const done = Math.floor(rand() * (tasks + 1));
    const state: PlanState = done === 0 ? '未开始' : done === tasks ? '已完成' : '进行中';
    return {
      name: `${c.name}供水设施例行巡检`,
      tasks,
      done,
      pct: Math.round((done / tasks) * 100),
      state,
    };
  });
});

/* ---------- 本周巡检完成 / 近7日趋势 ---------- */
const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const weekRates = computed(() => {
  const rand = mulberry32(7701);
  return DAY_NAMES.map((name, i) => ({
    name,
    rate: i === 6 ? 0 : Math.round(78 + rand() * 22),
  }));
});

const dayLabels = DAY_NAMES.map((d) => d.replace('周', ''));

const trendSeries = computed(() => {
  const rand = mulberry32(7702);
  const patrol = DAY_NAMES.map((_, i) => (i === 6 ? 0 : Math.round(78 + rand() * 22)));
  const close = DAY_NAMES.map((_, i) => (i === 6 ? 0 : Math.round(74 + rand() * 24)));
  return [
    { name: '巡检完成率', data: patrol },
    { name: '工单办结率', data: close },
  ];
});

/* ---------- 覆盖率 / 人员工作量 ---------- */
const coverage = computed(() => {
  const rand = mulberry32(8801);
  return SUMU_CENTERS.map((c) => ({
    name: c.name,
    rate: Math.round(72 + rand() * 27),
  }));
});

const staffLoad = computed(() => {
  const rand = mulberry32(9902);
  return SYNTH_PERSONS.map((name) => ({
    name,
    count: Math.round(8 + rand() * 14),
  }));
});
const maxStaffCount = computed(() => Math.max(1, ...staffLoad.value.map((s) => s.count)));
</script>

<style scoped>
.screen {
  width: 1920px;
  height: 1080px;
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
  grid-template-columns: repeat(4, 1fr);
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
  grid-template-columns: 400px 1fr 420px;
  grid-template-rows: 1fr 176px;
  gap: var(--panel-gap);
  padding: var(--panel-gap) 20px 20px;
}

.col-left {
  grid-row: 1;
  grid-column: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
}
.col-left > .plans-panel { flex: 1.2; min-height: 0; overflow: hidden; }
.col-left > .panel:last-child { flex: 1; min-height: 0; overflow: hidden; }

.board-panel {
  grid-row: 1;
  grid-column: 2;
  min-width: 0;
  overflow: hidden;
}

.col-right {
  grid-row: 1;
  grid-column: 3;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
}
.col-right > .panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ===== 左列：巡检计划 ===== */
.plan-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.plan-item {
  flex: none;
  padding: 8px 12px;
  background: rgba(12, 35, 64, 0.55);
  border-radius: 1px;
}
.plan-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.plan-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.plan-state {
  flex: none;
  font-size: 12px;
  padding: 1px 8px;
  border: 1px solid;
  border-radius: 1px;
}
.plan-bar {
  margin-top: 6px;
  height: 5px;
  background: var(--surface-blue);
  border-radius: 1px;
  overflow: hidden;
}
.plan-fill {
  display: block;
  height: 100%;
  transition: width 0.4s ease;
}
.plan-foot {
  margin-top: 4px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.plan-foot b {
  font-size: 14px;
  color: var(--spring-green);
}
.dim {
  color: var(--text-dim);
}

.week-host,
.cover-host,
.band-host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  overflow: hidden;
}
.week-host :deep(.micro-bar),
.cover-host :deep(.micro-bar) {
  padding: 3px 0;
  font-size: 12px;
}
.week-host :deep(.mb-label),
.cover-host :deep(.mb-label) {
  flex-basis: 96px;
}

/* ===== 中列：工单看板 ===== */
.board {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--panel-gap);
}
.board-col {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.bc-head {
  flex: none;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 6px 12px;
  border-left: 3px solid;
  background: rgba(12, 35, 64, 0.7);
}
.bc-name {
  font-size: 14px;
  font-weight: 600;
}
.bc-count {
  font-size: 20px;
  font-weight: 700;
}
.bc-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 2px 2px;
}
.bc-empty {
  text-align: center;
  font-size: 12px;
  padding: 24px 0;
}
.wo-card {
  flex: none;
  padding: 8px 12px;
  background: rgba(12, 35, 64, 0.55);
  border: 1px solid rgba(0, 194, 255, 0.1);
  border-radius: 1px;
  cursor: default;
  transition: background 0.14s ease, border-color 0.14s ease;
}
.wo-card:hover {
  background: rgba(0, 194, 255, 0.08);
  border-color: rgba(0, 194, 255, 0.35);
}
.wo-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.wo-id {
  font-size: 13px;
}
.wo-type {
  flex: none;
  font-size: 12px;
  padding: 1px 8px;
  border: 1px solid;
  border-radius: 1px;
}
.wo-project {
  margin-top: 4px;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wo-desc {
  margin-top: 2px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wo-foot {
  margin-top: 5px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
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
.trend-band > .trend-main {
  flex: 1.6;
}

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
</style>
