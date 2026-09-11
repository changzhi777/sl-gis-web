<!--
  public-service/Dashboard.vue — 公众服务大屏主视图（需求 §十 · T1 弹性布局壳）
  · 顶栏/侧栏职责已上收全局 AppShell/AppTopbar
  · KPI 条：本月公告 / 在线报修 / 投诉建议 / 办结率 / 平均响应时长 / 满意度
  · 左列（400px）：信息公告（停水/限时供水/水质检测/恢复供水 × 公众号/小程序/热线）
  · 中列（flex）：报修投诉工单池 —— 三阶段进度管道（后端真三态）+ 近 7 日受理趋势 + 工单明细表
  · 右列（400px）：满意度评价（五星分布）+ 知识宣传 + 便民服务卡
  · 数据（v9 真化）：/api/portal/notices + /api/repairs 真值水合，后端不可达回落 ./mock
    满意度/知识宣传/便民服务/受理趋势保留 mock 口径（暂无对应接口）
-->
<template>
  <div class="screen">
    <!-- 顶部 KPI 条 -->
      <div class="kpi-strip" role="group" aria-label="公众服务关键指标">
        <div v-for="k in stripKpis" :key="k.label" class="kpi-cell">
          <KpiCard layout="block" :value="k.value" :unit="k.unit" :label="k.label" />
        </div>
      </div>

      <main class="grid">
        <!-- ============ 左列：信息公告 ============ -->
        <div class="col">
          <Panel title="信息公告" :sub="`${noticeCount} 条 · 三渠道同步发布`" class="f-full" hero>
            <div class="notice-list" role="list" aria-label="公告列表">
              <article
                v-for="n in noticeRows"
                :key="n.id"
                class="notice"
                role="listitem"
              >
                <div class="n-line1">
                  <span class="n-type" :style="{ background: NOTICE_TYPE_META[n.type].color }">{{ NOTICE_TYPE_META[n.type].label }}</span>
                  <span class="n-title" :title="n.title">{{ n.title }}</span>
                </div>
                <div class="n-line2">
                  <span class="n-channel" :style="{ borderColor: CHANNEL_META[n.channel].color, color: CHANNEL_META[n.channel].color }">
                    <i class="n-chicon" :style="{ background: CHANNEL_META[n.channel].color }">{{ CHANNEL_META[n.channel].icon }}</i>{{ CHANNEL_META[n.channel].label }}
                  </span>
                  <span class="n-scope" :title="n.scope">{{ n.scope }}</span>
                  <span class="n-time num">{{ n.publishAt }}</span>
                  <span class="n-status" :class="{ live: n.live }">
                    <i aria-hidden="true"></i>{{ n.live ? '已发布' : '已过期' }}
                  </span>
                </div>
              </article>
            </div>
          </Panel>
        </div>

        <!-- ============ 中列：报修与投诉工单池 ============ -->
        <div class="col">
          <!-- 进度管道：三阶段计数卡（对齐后端真三态） -->
          <Panel title="工单受理进度" sub="待受理 → 处理中 → 已办结">
            <div class="pipeline" role="group" aria-label="工单四阶段进度">
              <template v-for="(s, i) in stageCards" :key="s.stage">
                <div class="stage-card" :style="{ '--sc': s.color }">
                  <div class="s-head">
                    <span class="s-name">{{ s.stage }}</span>
                    <b class="s-count num">{{ s.count }}</b>
                  </div>
                  <div class="s-bar">
                    <i :style="{ width: s.width + '%' }"></i>
                  </div>
                </div>
                <span v-if="i < stageCards.length - 1" class="p-arrow num" aria-hidden="true">›</span>
              </template>
            </div>
          </Panel>

          <!-- 近 7 日受理趋势 -->
          <Panel title="近 7 日受理趋势" sub="报修 / 投诉 · 单">
            <TrendLine
              :series="trendSeries"
              :x-labels="weekTrend.xLabels"
              :height="168"
              smooth
              :show-legend="true"
            />
          </Panel>

          <!-- 工单明细表（行左侧色条按问题类型） -->
          <Panel title="报修与投诉工单" :sub="`共 ${ticketRows.length} 单 · 在办 ${openCount} 单`" class="f-full" variant="alarm">
            <div class="tk-head tk-grid" aria-hidden="true">
              <span>编号</span><span>类型</span><span>位置</span><span>内容摘要</span><span>当前阶段</span><span>受理人</span><span class="ta-r">时长</span>
            </div>
            <div class="tk-body" role="table" aria-label="工单明细">
              <div
                v-for="t in ticketRows"
                :key="t.id"
                class="tk-row tk-grid"
                :style="{ '--tc': typeColor(t.category) }"
                role="row"
              >
                <span class="tk-id num">{{ t.id }}</span>
                <span class="tk-type" :style="{ color: typeColor(t.category), borderColor: typeColor(t.category) }">{{ t.category }}</span>
                <span class="tk-village" :title="t.location">{{ t.location }}</span>
                <span class="tk-sum" :title="t.summary">{{ t.summary }}</span>
                <span class="tk-stage" :style="{ color: STAGE_COLORS[t.status], borderColor: STAGE_COLORS[t.status] }">{{ t.status }}</span>
                <span class="tk-handler">{{ t.handler }}</span>
                <span class="tk-elapsed num ta-r">{{ t.elapsed }}</span>
              </div>
            </div>
          </Panel>
        </div>

        <!-- ============ 右列 ============ -->
        <div class="col">
          <!-- 满意度评价 -->
          <Panel title="满意度评价" :sub="`办结工单回访 ${satisfaction.total} 人次`">
            <div class="sat">
              <div class="sat-top">
                <b class="sat-score num">{{ satisfaction.overall.toFixed(1) }}</b>
                <span class="sat-stars" :style="{ '--fill': STAR_FILL_PCT + '%' }" role="img" :aria-label="`综合 ${satisfaction.overall.toFixed(1)} 分（5 分制）`">
                  <span class="row dim" aria-hidden="true">★★★★★</span>
                  <span class="row lit" aria-hidden="true">★★★★★</span>
                </span>
                <span class="sat-unit">综合评分</span>
              </div>
              <div class="sat-bars">
                <MicroBar
                  v-for="r in starRows"
                  :key="r.level"
                  :label="`${r.level} 星`"
                  :value="r.pct"
                  unit="%"
                  :color="STAR_COLORS[r.level]"
                />
              </div>
            </div>
          </Panel>

          <!-- 知识宣传 -->
          <Panel title="知识宣传" sub="饮水安全 · 水源保护 · 冬季防冻 · 管护知识" class="f-full">
            <div class="art-list" role="list" aria-label="知识宣传列表">
              <article v-for="a in articles" :key="a.id" class="art" role="listitem">
                <div class="a-line1">
                  <span class="a-cat" :style="{ color: ARTICLE_META[a.category].color, borderColor: ARTICLE_META[a.category].color }">{{ a.category }}</span>
                  <span class="a-title" :title="a.title">{{ a.title }}</span>
                </div>
                <div class="a-line2">
                  <span class="a-reads num">阅读 {{ a.reads.toLocaleString('zh-CN') }}</span>
                  <span class="a-time num">{{ a.publishedAt }}</span>
                </div>
              </article>
            </div>
          </Panel>

          <!-- 便民服务卡 -->
          <Panel title="便民服务" sub="热线 · 营业时间 · 监督电话">
            <div class="svc">
              <div class="svc-hotline">
                <span class="svc-label">{{ serviceInfo.hotlineLabel }}</span>
                <b class="svc-num num">{{ serviceInfo.hotline }}</b>
              </div>
              <div class="svc-row">
                <span class="svc-label">{{ serviceInfo.superviseLabel }}</span>
                <b class="svc-val num">{{ serviceInfo.supervise }}</b>
              </div>
              <div class="svc-row">
                <span class="svc-label">营业时间</span>
                <b class="svc-val">{{ serviceInfo.hours }}</b>
              </div>
              <div class="svc-row">
                <span class="svc-label">在线渠道</span>
                <b class="svc-val">{{ serviceInfo.online }}</b>
              </div>
              <div class="svc-chips">
                <span v-for="it in serviceInfo.items" :key="it" class="svc-chip">{{ it }}</span>
              </div>
            </div>
          </Panel>
        </div>
      </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import KpiCard from '@ui/KpiCard.vue';
import Panel from '@ui/Panel.vue';
import TrendLine from '@charts/TrendLine.vue';
import MicroBar from '@charts/MicroBar.vue';
import { apiFetch } from '@/composables/realtime';
import { unpackItems } from '@shared/backend';
import {
  pageKpis,
  notices,
  tickets,
  STAGE_ORDER,
  STAGE_COLORS,
  TICKET_TYPE_COLORS,
  NOTICE_TYPE_META,
  CHANNEL_META,
  satisfaction,
  STAR_COLORS,
  articles,
  ARTICLE_META,
  serviceInfo,
  weekTrend,
} from './mock';
import type { NoticeApiRow, NoticeChannel, NoticeType, RepairApiRow } from './mock';

/* ---------- live 数据（mock 起步 → /api/portal/notices + /api/repairs 水合覆盖） ---------- */
const liveNotices = ref<NoticeApiRow[] | null>(null);
const liveNoticeTotal = ref(0);
const liveRepairs = ref<RepairApiRow[] | null>(null);

async function hydrateNotices(): Promise<void> {
  const data = await apiFetch<{ total: number; items: NoticeApiRow[] }>(
    '/api/portal/notices?limit=10',
  );
  if (!data?.items?.length) return;
  liveNotices.value = data.items;
  liveNoticeTotal.value = data.total;
}

async function hydrateRepairs(): Promise<void> {
  const items = unpackItems<RepairApiRow>(await apiFetch('/api/repairs'));
  if (items?.length) liveRepairs.value = items;
}

onMounted(() => {
  void hydrateNotices();
  void hydrateRepairs();
});

/* ---------- KPI 条（公告/报修计数 + 办结率 ← 真值；投诉/响应时长/满意度 ← mock） ---------- */
const doneRate = computed(() => {
  const rows = liveRepairs.value;
  if (!rows?.length) return pageKpis[3].value;
  const done = rows.filter((r) => r.status === '已办结').length;
  return +((done / rows.length) * 100).toFixed(1);
});

const stripKpis = computed(() => [
  { label: '本月公告', value: liveNoticeTotal.value || pageKpis[0].value, unit: '条' },
  { label: '在线报修', value: liveRepairs.value?.length ?? pageKpis[1].value, unit: '单' },
  { label: '投诉建议', value: pageKpis[2].value, unit: '条' },
  { label: '办结率', value: doneRate.value, unit: '%' },
  { label: '平均响应时长', value: pageKpis[4].value, unit: 'h' },
  { label: '群众满意度', value: pageKpis[5].value, unit: '分' },
]);

/* ---------- 信息公告（真值 → 统一展示行；mock 兜底沿用 id 作范围标识） ---------- */
interface NoticeView {
  id: number | string;
  type: NoticeType;
  title: string;
  /** 范围标识：真值=涉及苏木乡镇 · mock=编号 */
  scope: string;
  channel: NoticeChannel;
  publishAt: string;
  live: boolean;
}

/** "2026-09-10T18:26:12.27Z" → "09-10 18:26"（按库内时间原样展示，不做时区换算） */
function fmtStamp(iso: string): string {
  return iso.length >= 16 ? `${iso.slice(5, 10)} ${iso.slice(11, 16)}` : iso;
}

function normType(t: string): NoticeType {
  return (NOTICE_TYPE_META[t as NoticeType] ? t : '停水') as NoticeType;
}

function normChannel(c: string): NoticeChannel {
  return (CHANNEL_META[c as NoticeChannel] ? c : '公众号') as NoticeChannel;
}

const noticeRows = computed<NoticeView[]>(() => {
  const rows = liveNotices.value;
  if (rows) {
    return rows.map((n) => ({
      id: n.id,
      type: normType(n.type),
      title: n.title,
      scope: n.su_mu || '全域',
      channel: normChannel(n.channel),
      publishAt: fmtStamp(n.created),
      live: true,
    }));
  }
  return notices.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    scope: n.id,
    channel: n.channel,
    publishAt: n.publishAt,
    live: n.status === '已发布',
  }));
});

const noticeCount = computed(() => liveNoticeTotal.value || noticeRows.value.length);

/* ---------- 工单池（真三态 → 统一展示行；受理人后端暂无 → '—'） ---------- */
interface TicketView {
  id: string;
  category: string;
  location: string;
  summary: string;
  status: string;
  handler: string;
  elapsed: string;
}

/** 距受理/创建时长 → "Xh" / "X天Yh" */
function elapsedLabel(created: string): string {
  const t = new Date(created).getTime();
  if (Number.isNaN(t)) return '—';
  const h = Math.max(0, Math.round((Date.now() - t) / 3600_000));
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}天${h % 24}h`;
}

const ticketRows = computed<TicketView[]>(() => {
  const rows = liveRepairs.value;
  if (rows) {
    return rows.map((r) => ({
      id: r.ticket,
      category: r.category,
      location: r.location,
      summary: r.description || r.category,
      status: r.status,
      handler: '—',
      elapsed: elapsedLabel(r.created),
    }));
  }
  return tickets.map((t) => ({
    id: t.id,
    category: t.type,
    location: t.village,
    summary: t.summary,
    status: t.stage,
    handler: t.handler,
    elapsed: t.elapsed,
  }));
});

/** 问题类型 → 色板（未知类别兜底青蓝） */
function typeColor(c: string): string {
  return TICKET_TYPE_COLORS[c] ?? 'var(--flood-teal)';
}

/* ---------- 进度管道：按工单池推导三阶段计数（口径与明细表一致） ---------- */
const stageCards = computed(() => {
  const counts = STAGE_ORDER.map((stage) => ({
    stage,
    color: STAGE_COLORS[stage],
    count: ticketRows.value.filter((t) => t.status === stage).length,
  }));
  const max = Math.max(...counts.map((c) => c.count), 1);
  return counts.map((c) => ({ ...c, width: Math.round((c.count / max) * 100) }));
});

/** 在办 = 待受理 + 处理中 */
const openCount = computed(() =>
  stageCards.value.slice(0, -1).reduce((s, c) => s + c.count, 0),
);

/* ---------- 近 7 日受理趋势（暂无对应接口 · mock 口径保留） ---------- */
const trendSeries = computed(() => [
  { name: '报修受理', data: weekTrend.repair },
  { name: '投诉受理', data: weekTrend.complaint },
]);

/* ---------- 满意度：综合分 → 五星填充比例；分布 → 百分比（mock 保留） ---------- */
const STAR_FILL_PCT = `${(satisfaction.overall / 5) * 100}%`;

const starRows = computed(() =>
  satisfaction.stars.map((s) => ({
    level: s.level,
    pct: +( (s.count / satisfaction.total) * 100 ).toFixed(1),
  })),
);
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

/* ===== KPI 条（6 格） ===== */
.kpi-strip {
  flex: none;
  height: 76px;
  margin: 12px 12px 0;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
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
}
.kpi-cell:last-child { border-right: none; }

/* ===== 主栅格：3 列（400 / flex / 400） ===== */
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 5fr) minmax(0, 14fr) minmax(300px, 5fr);
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
.f-full { flex: 1 1 0; min-height: 0; }

/* ===== 左列：信息公告 ===== */
.notice-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}
.notice-list::-webkit-scrollbar { width: 4px; }
.notice-list::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.25); border-radius: 2px; }

.notice {
  padding: 8px 10px;
  margin-bottom: 6px;
  background: rgba(12, 35, 64, 0.4);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
}
.n-line1 {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.n-type {
  flex: none;
  font-size: 11px;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 1px;
  color: var(--well-deep);
  font-weight: 600;
}
.n-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.n-line2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-dim);
}
.n-channel {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px 1px 2px;
  border: var(--border-w) solid;
  border-radius: 1px;
}
.n-chicon {
  width: 14px;
  height: 14px;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  border-radius: 1px;
  color: var(--well-deep);
  font-style: normal;
  font-weight: 700;
}
.n-scope { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.n-time { letter-spacing: 0.5px; }
.n-status { display: inline-flex; align-items: center; gap: 4px; color: var(--text-dim); }
.n-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-stop);
}
.n-status.live { color: var(--spring-green); }
.n-status.live i { background: var(--spring-green); box-shadow: 0 0 6px var(--spring-green); }

/* ===== 中列：进度管道 ===== */
.pipeline {
  display: grid;
  grid-template-columns: 1fr 18px 1fr 18px 1fr;
  align-items: stretch;
  gap: 6px;
}
.stage-card {
  --sc: var(--flood-teal);
  padding: 10px 12px;
  background: rgba(12, 35, 64, 0.5);
  border: var(--border-w) solid var(--line-vein);
  border-top: var(--border-w-thick) solid var(--sc);
  border-radius: var(--radius);
}
.s-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}
.s-name { font-size: 13px; color: var(--text); }
.s-count { font-size: 24px; font-weight: 700; color: var(--sc); }
.s-bar {
  margin-top: 8px;
  height: 5px;
  background: var(--surface-blue);
  border-radius: 1px;
  overflow: hidden;
}
.s-bar i {
  display: block;
  height: 100%;
  background: var(--sc);
  transition: width 0.4s ease;
}
.p-arrow {
  align-self: center;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--flood-teal);
}

/* ===== 中列：工单明细表 ===== */
.tk-grid {
  display: grid;
  grid-template-columns: 104px 44px 1.15fr 1.7fr 66px 62px 58px;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ta-r { text-align: right; }

.tk-head {
  flex: none;
  font-size: 12px;
  color: var(--text-dim);
  padding: 2px 10px 8px;
  border-bottom: var(--border-w) solid var(--line-vein);
}
.tk-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-top: 4px;
}
.tk-body::-webkit-scrollbar { width: 4px; }
.tk-body::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.25); border-radius: 2px; }

.tk-row {
  --tc: var(--flood-teal);
  padding: 7px 10px 7px 12px;
  margin-bottom: 3px;
  font-size: 13px;
  color: var(--text);
  background: rgba(12, 35, 64, 0.35);
  border: var(--border-w) solid transparent;
  border-left: 3px solid var(--tc);
  border-radius: var(--radius);
}
.tk-row:hover { background: rgba(0, 194, 255, 0.08); }
.tk-id { font-weight: 600; letter-spacing: 0.3px; }
.tk-type,
.tk-stage {
  font-size: 11px;
  padding: 1px 5px;
  border: var(--border-w) solid;
  border-radius: 1px;
  text-align: center;
}
.tk-village,
.tk-sum {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.tk-sum { color: var(--text-dim); }
.tk-handler { color: var(--text-dim); }
.tk-elapsed { color: var(--text-dim); }

/* ===== 右列：满意度评价 ===== */
.sat {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sat-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sat-score {
  font-size: 40px;
  font-weight: 700;
  color: var(--steppe-amber);
  text-shadow: 0 0 12px rgba(255, 180, 84, 0.35);
  line-height: 1;
}
/* 五星：底层灰星 + 上层金星按比例裁切（4.6/5 = 92%） */
.sat-stars {
  position: relative;
  display: inline-block;
  font-size: 18px;
  line-height: 1;
  letter-spacing: 2px;
}
.sat-stars .row { display: block; white-space: nowrap; }
.sat-stars .row.dim { color: rgba(157, 178, 198, 0.35); }
.sat-stars .row.lit {
  position: absolute;
  inset: 0;
  width: var(--fill);
  overflow: hidden;
  color: var(--steppe-amber);
}
.sat-unit { font-size: 12px; color: var(--text-dim); }
.sat-bars :deep(.mb-label) { flex: 0 0 36px; }

/* ===== 右列：知识宣传 ===== */
.art-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}
.art-list::-webkit-scrollbar { width: 4px; }
.art-list::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.25); border-radius: 2px; }

.art {
  padding: 7px 10px;
  margin-bottom: 6px;
  background: rgba(12, 35, 64, 0.4);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
}
.a-line1 {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.a-cat {
  flex: none;
  font-size: 11px;
  padding: 1px 6px;
  border: var(--border-w) solid;
  border-radius: 1px;
}
.a-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.a-line2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 5px;
  font-size: 11px;
  color: var(--text-dim);
}
.a-time { margin-left: auto; }

/* ===== 右列：便民服务卡 ===== */
.svc {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.svc-hotline {
  padding: 10px 12px;
  background: rgba(12, 35, 64, 0.5);
  border: var(--border-w) solid rgba(0, 194, 255, 0.35);
  border-radius: var(--radius);
}
.svc-hotline .svc-num {
  display: block;
  margin-top: 4px;
  font-size: 26px;
  font-weight: 700;
  color: var(--spring-green);
  text-shadow: 0 0 10px rgba(0, 255, 224, 0.3);
  letter-spacing: 1px;
}
.svc-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
}
.svc-label {
  flex: none;
  color: var(--text-dim);
  font-size: 12px;
}
.svc-val {
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.svc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 4px;
  border-top: var(--border-w) solid var(--line-vein);
}
.svc-chip {
  font-size: 11px;
  color: var(--flood-teal);
  padding: 2px 8px;
  border: var(--border-w) solid rgba(0, 194, 255, 0.35);
  border-radius: 1px;
  background: rgba(0, 194, 255, 0.06);
}

@media (prefers-reduced-motion: reduce) {
  .s-bar i { transition: none; }
}
</style>
