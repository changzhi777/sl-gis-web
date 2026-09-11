<!--
  assessment/Dashboard.vue — 统计考核大屏（需求 §十一 报表 + §十二 考核六维 · T1 弹性布局壳）
  · 顶栏/侧栏职责已上收全局 AppShell/AppTopbar
  · 顶部 KPI 条：规模化供水覆盖率 / 工程正常运行率 / 设备在线率 / 水质合格率 / 收费率 / 工单办结率
  · 左列：考核六维雷达（RadarChart）+ 六维得分列表
  · 中列：报表中心（日报/月报/年报 tab，指标名/本期值/上期值/同比/达标）+ 苏木乡镇排名（CSS 条，前三高亮）
  · 右列：成本分析（千吨水电耗/药耗/人工/维修 4 项 MicroBar）+ 年度更新改造项目库（优先级降序，≥80 红色）
  · 数据源（v8.3 真化）：KPI 条/六维雷达·得分/苏木排名 ← /api/assessment/summary 实测聚合
    （规模化覆盖率后端无口径保留 mock 原值）；报表中心/成本分析/项目库保留页内确定性 mock；后端不可达回落 mock
-->
<template>
  <div class="screen">
    <!-- 顶部 KPI 条：考核核心六率 -->
      <div class="kpi-strip" role="group" aria-label="考核核心指标">
        <div
          v-for="(k, i) in kpiStrip"
          :key="k.label"
          class="kpi-cell"
          :class="{ lead: i === 0 }"
        >
          <KpiCard
            :value="k.value"
            :unit="k.unit"
            :label="k.label"
            :decimals="k.decimals"
            :delta="k.delta"
            :glow="i === 0"
          />
        </div>
      </div>

      <!-- 主栅格 -->
      <main class="grid">
        <!-- ============ 左列：六维雷达 + 得分列表 ============ -->
        <div class="col-left">
          <Panel title="考核六维雷达" :sub="`本期综合 ${overallScore.toFixed(1)} 分`">
            <RadarChart
              :indicators="radarIndicators"
              :values="radarValues"
              name="本期得分"
              :height="252"
            />
          </Panel>
          <Panel class="dim-panel" title="六维得分" :sub="dimSub">
            <div class="dim-list">
              <div v-for="d in liveDimensions" :key="d.name" class="dim-item">
                <span class="dim-name">{{ d.name }}</span>
                <div class="dim-track">
                  <i :style="{ width: d.score + '%', background: scoreColor(d.score) }"></i>
                </div>
                <b class="num dim-score" :style="{ color: scoreColor(d.score) }">
                  {{ d.score.toFixed(1) }}
                </b>
              </div>
            </div>
          </Panel>
        </div>

        <!-- ============ 中列：报表中心 + 苏木排名 ============ -->
        <div class="col-center">
          <Panel class="rep-panel" title="报表中心" sub="工程运行 · 水质 · 取供水 · 能耗 · 收费 · 维修 · 应急">
            <template #extra>
              <div class="tabs" role="tablist" aria-label="报表周期切换">
                <button
                  v-for="t in REPORT_TABS"
                  :key="t"
                  type="button"
                  role="tab"
                  :aria-selected="activeTab === t"
                  class="tab"
                  :class="{ active: activeTab === t }"
                  @click="activeTab = t"
                >
                  {{ t }}
                </button>
              </div>
            </template>

            <div class="rep">
              <div class="rep-head">
                <span class="c-name">指标名称</span>
                <span class="c-cur">本期值</span>
                <span class="c-prev">上期值</span>
                <span class="c-yoy">同比</span>
                <span class="c-ok">达标</span>
              </div>
              <div class="rep-body">
                <div v-for="r in activeReport" :key="r.name" class="rep-row">
                  <span class="c-name" :title="r.name">{{ r.name }}</span>
                  <span class="c-cur num">
                    {{ r.current.toFixed(r.decimals) }}<small class="u">{{ r.unit }}</small>
                  </span>
                  <span class="c-prev num">{{ r.previous.toFixed(r.decimals) }}</span>
                  <span class="c-yoy num" :class="yoyGood(r) ? 'good' : 'bad'">{{ yoyText(r) }}</span>
                  <span class="c-ok">
                    <i class="ok-chip" :class="met(r.current, r.target, r.betterWhen) ? 'is-met' : 'is-miss'">
                      {{ met(r.current, r.target, r.betterWhen) ? '达标' : '未达标' }}
                    </i>
                  </span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="苏木乡镇考核排名" sub="综合得分 · 前三高亮 · 条长按 80-100 分归一">
            <div class="rank-list">
              <div
                v-for="(t, i) in liveRanks"
                :key="t.name"
                class="rank-item"
                :class="{ top: i < 3 }"
              >
                <i class="rk num">{{ i + 1 }}</i>
                <span class="rk-name" :title="t.name">{{ t.name }}</span>
                <div class="rk-track">
                  <i :style="{ width: rankWidth(t.score) + '%' }"></i>
                </div>
                <b class="num rk-score">{{ t.score.toFixed(1) }}</b>
              </div>
            </div>
          </Panel>
        </div>

        <!-- ============ 右列：成本分析 + 项目库 ============ -->
        <div class="col-right">
          <Panel title="成本分析" sub="千吨水电耗 · 药耗 · 人工 · 维修">
            <div class="cost-list">
              <MicroBar
                v-for="c in COST_ITEMS"
                :key="c.label"
                :label="c.label"
                :value="c.value"
                :max="c.max"
                :unit="c.unit"
                :decimals="c.decimals"
                :color="c.color"
              />
            </div>
            <p class="cost-note dim">{{ COST_YOY }}</p>
            <p class="cost-note">
              <span class="dim">单位供水成本</span>
              <b class="num">{{ UNIT_WATER_COST.value.toFixed(2) }}</b>
              <span class="dim">元/m³（目标 ≤{{ UNIT_WATER_COST.target.toFixed(2) }} · 同比 {{ UNIT_WATER_COST.yoy }}%）</span>
            </p>
          </Panel>

          <Panel
            class="proj-panel"
            title="年度更新改造项目库"
            :sub="`共 ${RENOVATION_PROJECTS.length} 项 · 资金需求 ${RENOVATION_FUND_TOTAL} 万元`"
          >
            <div class="proj">
              <div class="proj-head">
                <span class="c-proj">工程</span>
                <span class="c-reason">改造原因</span>
                <span class="c-pri">优先级</span>
                <span class="c-fund">资金(万元)</span>
              </div>
              <div class="proj-body">
                <div v-for="p in RENOVATION_PROJECTS" :key="p.name" class="proj-row">
                  <span class="c-proj" :title="p.name">{{ p.name }}</span>
                  <span class="c-reason dim" :title="p.reason">{{ p.reason }}</span>
                  <b class="num c-pri" :style="{ color: priorityColor(p.priority) }">{{ p.priority }}</b>
                  <span class="num c-fund">{{ p.fund }}</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Panel from '@ui/Panel.vue';
import KpiCard from '@ui/KpiCard.vue';
import MicroBar from '@charts/MicroBar.vue';
import RadarChart from './RadarChart.vue';
import { apiFetch } from '@/composables/realtime';
import {
  ASSESS_KPIS,
  REPORTS,
  TOWNSHIP_RANKS,
  COST_ITEMS,
  COST_YOY,
  UNIT_WATER_COST,
  RENOVATION_PROJECTS,
  RENOVATION_FUND_TOTAL,
  FALLBACK_DIM_SCORES,
  met,
  yoy,
  yoyGood,
} from './mock';
import type { AssessKpi, AssessmentSummary, DimScore, ReportKind, ReportRow } from './mock';

/* ---------- live 数据（mock 起步 → /api/assessment/summary 水合覆盖） ---------- */
const liveSummary = ref<AssessmentSummary | null>(null);
const liveDimensions = ref<DimScore[]>(FALLBACK_DIM_SCORES);
const liveRanks = ref(TOWNSHIP_RANKS);

async function hydrateSummary(): Promise<void> {
  const data = await apiFetch<AssessmentSummary>('/api/assessment/summary');
  if (!data?.kpi || !data.dims) return;
  liveSummary.value = data;
  const dims = Object.entries(data.dims).map(([name, score]) => ({ name, score: +score }));
  if (dims.length) liveDimensions.value = dims;
  if (data.ranking?.length) {
    liveRanks.value = data.ranking.map((r) => ({ name: String(r.name), score: +r.score }));
  }
}

onMounted(() => {
  void hydrateSummary();
});

/* ---------- KPI 条：mock 形态起步；水合后五格换真值（不带同比箭头） ---------- */
const kpiStrip = computed<AssessKpi[]>(() => {
  const s = liveSummary.value;
  if (!s) return ASSESS_KPIS;
  const real = (base: AssessKpi, value: number): AssessKpi => ({ ...base, value, delta: undefined });
  return [
    ASSESS_KPIS[0], // 规模化供水覆盖率：后端无此口径，保留 mock 原值（含同比）
    real(ASSESS_KPIS[1], s.kpi.normalRate),                      // 工程正常运行率
    real(ASSESS_KPIS[2], s.kpi.onlineRate),                      // 设备在线率
    real(ASSESS_KPIS[3], s.dims['水质安全'] ?? ASSESS_KPIS[3].value), // 水质合格率
    real(ASSESS_KPIS[4], s.kpi.collectionRate),                  // 收费率
    real(ASSESS_KPIS[5], s.dims['服务监督'] ?? ASSESS_KPIS[5].value), // 工单办结率
  ];
});

/* ---------- 报表中心：日报 / 月报 / 年报 ---------- */
const REPORT_TABS: ReportKind[] = ['日报', '月报', '年报'];
const activeTab = ref<ReportKind>('日报');
const activeReport = computed<ReportRow[]>(() => REPORTS[activeTab.value]);

/** 同比文案：带符号 + 1 位小数 */
function yoyText(r: ReportRow): string {
  const d = yoy(r);
  return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
}

/* ---------- 六维雷达 + 得分列表（live：水合后为后端六维实测） ---------- */
const radarIndicators = computed(() => liveDimensions.value.map((d) => ({ name: d.name, max: 100 })));
const radarValues = computed(() => liveDimensions.value.map((d) => d.score));

/** 旗县综合得分 = 各维得分均值 */
const overallScore = computed(() => {
  const dims = liveDimensions.value;
  if (!dims.length) return 0;
  return +(dims.reduce((sum, d) => sum + d.score, 0) / dims.length).toFixed(1);
});

/** 得分列表副标题：水合后带纳入考核工程数 */
const dimSub = computed(() =>
  liveSummary.value ? `纳入工程 ${liveSummary.value.kpi.projectTotal} 座 · 满分 100` : '满分 100',
);

/** 得分着色：≥90 青绿 / ≥86 主蓝 / 其余草原琥珀 */
function scoreColor(score: number): string {
  if (score >= 90) return 'var(--spring-green)';
  if (score >= 86) return 'var(--flood-teal)';
  return 'var(--steppe-amber)';
}

/* ---------- 苏木乡镇排名：条长按 80-100 分归一 ---------- */
function rankWidth(score: number): number {
  return Math.max(6, Math.min(100, ((score - 80) / 20) * 100));
}

/* ---------- 项目库优先级：≥80 红（紧迫）/ ≥70 琥珀 / 其余暗色 ---------- */
function priorityColor(p: number): string {
  if (p >= 80) return 'var(--status-alarm)';
  if (p >= 70) return 'var(--steppe-amber)';
  return 'var(--text-dim)';
}
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
.dim {
  color: var(--text-dim);
}

/* ===== KPI 条 ===== */
.kpi-strip {
  flex: none;
  height: 72px;
  margin: 0 20px;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--panel-gap);
  border-bottom: var(--border-w) solid var(--line-vein);
}
.kpi-cell {
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-left: 2px solid rgba(0, 194, 255, 0.35);
}
.kpi-cell.lead {
  border-left-color: var(--spring-green);
}

/* ===== 主栅格：左 400 / 中 flex / 右 400 ===== */
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 5fr) minmax(0, 14fr) minmax(300px, 5fr);
  gap: var(--panel-gap);
  padding: var(--panel-gap) 20px 20px;
}
.col-left,
.col-center,
.col-right {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
}
.col-left > .dim-panel { flex: 1; }
.col-center > .rep-panel { flex: 1.2; }
.col-center > .panel:last-child { flex: 1; }
.col-right > .proj-panel { flex: 1; min-height: 0; overflow: hidden; }

/* ===== 左列：六维得分列表 ===== */
.dim-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
}
.dim-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.dim-name {
  flex: 0 0 64px;
  color: var(--text);
  white-space: nowrap;
}
.dim-track {
  flex: 1;
  height: 6px;
  background: var(--surface-blue);
  border-radius: 1px;
  overflow: hidden;
}
.dim-track i {
  display: block;
  height: 100%;
  transition: width 0.4s ease;
}
.dim-score {
  flex: 0 0 44px;
  text-align: right;
  font-size: 15px;
  font-weight: 600;
}
.dim-met {
  flex: 0 0 40px;
  text-align: right;
  font-size: 12px;
  color: var(--text-dim);
}
.dim-met.full {
  color: var(--spring-green);
}

/* ===== 中列：报表中心 ===== */
.tabs {
  display: flex;
  gap: 6px;
}
.tab {
  padding: 3px 14px;
  font-size: 12px;
  color: var(--text-dim);
  background: transparent;
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  cursor: pointer;
  transition: color 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}
.tab:hover {
  color: var(--text);
  border-color: rgba(0, 194, 255, 0.45);
}
.tab.active {
  color: var(--spring-green);
  border-color: rgba(0, 194, 255, 0.55);
  background: rgba(0, 194, 255, 0.12);
}

.rep {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.rep-head,
.rep-row {
  display: grid;
  grid-template-columns: 1.6fr 1.1fr 0.9fr 0.7fr 0.85fr;
  align-items: baseline;
  gap: 0 8px;
  padding: 7px 8px;
}
.rep-head {
  flex: none;
  font-size: 12px;
  color: var(--text-dim);
  border-bottom: var(--border-w) solid var(--line-vein);
}
.rep-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.rep-row {
  font-size: 13px;
  border-bottom: 1px solid rgba(0, 194, 255, 0.06);
}
.rep-row:nth-child(odd) {
  background: rgba(12, 35, 64, 0.35);
}
.c-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.c-cur {
  font-weight: 600;
  color: var(--text);
}
.c-cur .u {
  font-family: var(--cn);
  font-size: 12px;
  color: var(--text-dim);
  margin-left: 2px;
  font-weight: 400;
}
.c-prev {
  color: var(--text-dim);
}
.c-yoy {
  font-weight: 600;
  font-size: 13px;
}
.c-yoy.good { color: var(--spring-green); }
.c-yoy.bad { color: var(--status-alarm); }
.ok-chip {
  display: inline-block;
  font-style: normal;
  font-size: 12px;
  line-height: 1.4;
  padding: 1px 8px;
  border: 1px solid;
  border-radius: 1px;
}
.ok-chip.is-met {
  color: var(--spring-green);
  border-color: rgba(0, 255, 224, 0.5);
}
.ok-chip.is-miss {
  color: var(--steppe-amber);
  border-color: rgba(255, 180, 84, 0.55);
}

/* ===== 中列：苏木排名 ===== */
.rank-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 3px 0;
}
.rk {
  flex: none;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-dim);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
}
.rank-item.top .rk {
  color: var(--spring-green);
  border-color: rgba(0, 255, 224, 0.55);
  background: rgba(0, 255, 224, 0.08);
}
.rk-name {
  flex: 0 0 104px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rk-track {
  flex: 1;
  height: 8px;
  background: var(--surface-blue);
  border-radius: 1px;
  overflow: hidden;
}
.rk-track i {
  display: block;
  height: 100%;
  background: var(--flood-teal);
  opacity: 0.8;
  transition: width 0.4s ease;
}
.rank-item.top .rk-track i {
  background: linear-gradient(90deg, var(--flood-teal), var(--spring-green));
  opacity: 1;
}
.rk-score {
  flex: 0 0 44px;
  text-align: right;
  font-size: 15px;
  font-weight: 600;
}
.rank-item.top .rk-score {
  color: var(--spring-green);
}

/* ===== 右列：成本分析 ===== */
.cost-list {
  display: flex;
  flex-direction: column;
}
.cost-list :deep(.mb-value) {
  min-width: 96px;
}
.cost-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text);
}
.cost-note b {
  color: var(--spring-green);
  font-size: 15px;
  margin: 0 3px;
}

/* ===== 右列：项目库 ===== */
.proj {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.proj-head,
.proj-row {
  display: grid;
  grid-template-columns: 1.3fr 1.3fr 44px 76px;
  align-items: baseline;
  gap: 0 8px;
  padding: 6px 8px;
}
.proj-head {
  flex: none;
  font-size: 12px;
  color: var(--text-dim);
  border-bottom: var(--border-w) solid var(--line-vein);
}
.proj-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.proj-row {
  font-size: 12px;
  border-bottom: 1px solid rgba(0, 194, 255, 0.06);
}
.proj-row:nth-child(odd) {
  background: rgba(12, 35, 64, 0.35);
}
.c-proj,
.c-reason {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.c-proj {
  color: var(--text);
  font-size: 13px;
}
.c-pri {
  text-align: right;
  font-weight: 700;
  font-size: 14px;
}
.c-fund {
  text-align: right;
  font-weight: 600;
  font-size: 13px;
}
</style>
