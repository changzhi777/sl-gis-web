<!--
  billing/Dashboard.vue — 收费服务大屏主视图（需求 §八 收费服务 · T1 弹性布局壳）
  · 顶栏/侧栏职责已上收全局 AppShell/AppTopbar（告警灯口径见 AppTopbar）
  · KPI 条：用水户总数 / 抄表到户率 / 本月水费 / 收缴率 / 欠费户数 / 产销差率
  · 左列：用水户构成（5 类 MicroBar）+ 收缴率 6 个月趋势（TrendLine）
  · 中列：产销差三级水量对比（出厂总表/村级总表/用户分表，CSS 分组柱）+ 疑似漏损清单表
  · 右列：欠费提醒（红左条行）+ 最近缴费流水（微信/营业厅/上门）
  · 数据：本页 mock.ts（确定性常量，口径见文件头注释）
-->
<template>
  <div class="screen">
    <!-- 顶部 KPI 条 -->
      <div class="kpi-strip" role="group" aria-label="收费服务关键指标">
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
          <Panel
            title="用水户构成"
            :sub="`${kpi.totalUsers.toLocaleString('en-US')} 户 · 牧户占 87.0%`"
            class="f12"
          >
            <div class="mix">
              <MicroBar
                v-for="m in userMix"
                :key="m.label"
                :label="m.label"
                :value="m.count"
                :max="userMixMax"
                unit="户"
                :color="m.color"
                :decimals="0"
              />
              <div class="mix-foot">
                服务人口 {{ kpi.servedPopulation }} 万人 · 覆盖 {{ kpi.townships }} 个苏木乡镇 ·
                现行水价 {{ kpi.waterPrice }} 元/m³
              </div>
            </div>
          </Panel>

          <Panel title="收缴率趋势" sub="近 6 个月 · 目标 85%" class="f10">
            <TrendLine
              :series="collectionSeries"
              :x-labels="collectionTrend.months"
              :height="316"
              smooth
            />
          </Panel>
        </div>

        <!-- ============ 中列 ============ -->
        <div class="col">
          <Panel
            title="产销差三级水量对比"
            sub="月累计 m³ · 4–9 月"
            class="f12"
            hero
          >
            <div class="lc">
              <div class="lc-legend" aria-hidden="true">
                <span><i class="d d-f"></i>出厂总表</span>
                <span><i class="d d-v"></i>村级总表</span>
                <span><i class="d d-u"></i>用户分表</span>
              </div>
              <div class="lc-plot" role="img" aria-label="出厂总表、村级总表、用户分表月度水量对比">
                <div
                  v-for="g in meterGroups"
                  :key="g.month"
                  class="lc-group"
                  :title="`${g.month}：出厂 ${fmt(g.factory)} · 村级 ${fmt(g.village)} · 用户 ${fmt(g.user)} m³`"
                >
                  <i class="lc-bar b-f" :style="{ height: barPct(g.factory) }"></i>
                  <i class="lc-bar b-v" :style="{ height: barPct(g.village) }"></i>
                  <i class="lc-bar b-u" :style="{ height: barPct(g.user) }"></i>
                </div>
              </div>
              <div class="lc-months">
                <span v-for="g in meterGroups" :key="g.month" class="num">{{ g.month }}</span>
              </div>
              <div class="lc-foot">
                <span>{{ lastGroup.month }} 产销差率</span>
                <b class="num bad">{{ kpi.lossRate }}%</b>
                <span class="dim">目标 ≤12% · 村网漏损 8.1% · 户表侧 10.0%</span>
              </div>
            </div>
          </Panel>

          <Panel title="疑似漏损清单" sub="村级总表 − 分表合计 · 本月" class="f10" hero>
            <div class="tbl-wrap">
              <table class="leak">
                <thead>
                  <tr>
                    <th>嘎查村</th>
                    <th class="r">月差值 m³</th>
                    <th class="r">偏差率</th>
                    <th>排查状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in leakSuspects" :key="row.village">
                    <td>{{ row.village }}</td>
                    <td class="r num">{{ fmt(row.delta) }}</td>
                    <td class="r num" :class="{ bad: row.bias >= 15 }">{{ row.bias.toFixed(1) }}%</td>
                    <td>
                      <span
                        class="st"
                        :style="{ color: LEAK_COLOR[row.status], borderColor: LEAK_COLOR[row.status] }"
                      >{{ row.status }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <!-- ============ 右列 ============ -->
        <div class="col">
          <Panel
            variant="alarm"
            title="欠费提醒"
            :sub="`${kpi.arrearsUsers} 户 · 合计 ${kpi.arrearsAmount} 万元`"
            class="f12"
            hero
          >
            <div class="ar-list" role="list" aria-label="欠费用户列表">
              <div v-for="a in arrearsList" :key="a.user" class="ar-row" role="listitem">
                <div class="l1">
                  <span class="name">{{ a.user }}</span>
                  <span class="proj num">{{ a.project }}</span>
                  <b class="amt num">¥{{ a.amount.toFixed(1) }}</b>
                </div>
                <div class="l2">
                  <span class="dim">{{ a.projectName }}</span>
                  <span class="months" :class="{ hot: a.months >= 4 }">欠费 {{ a.months }} 个月</span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="最近缴费流水" sub="今日 · 线上 + 线下" class="f10">
            <div class="pay-list" role="list" aria-label="缴费流水列表">
              <div v-for="p in paymentFeed" :key="p.time + p.user" class="pay-row" role="listitem">
                <span class="time num dim">{{ p.time }}</span>
                <span class="puser">{{ p.user }}</span>
                <b class="amt num">+{{ p.amount.toFixed(1) }}</b>
                <span
                  class="ch"
                  :style="{ color: PAY_COLOR[p.channel], borderColor: PAY_COLOR[p.channel] }"
                >{{ p.channel }}</span>
              </div>
            </div>
          </Panel>
        </div>
      </main>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import KpiCard from '@ui/KpiCard.vue';
import Panel from '@ui/Panel.vue';
import TrendLine from '@charts/TrendLine.vue';
import MicroBar from '@charts/MicroBar.vue';
import {
  arrearsList,
  billingKpi,
  collectionTrend,
  leakSuspects,
  meterTrend,
  paymentFeed,
  userMix,
} from './mock';
import type { LeakStatus, PayChannel } from './mock';

/* ---------- 常量 ---------- */
/** 漏损排查状态 → 语义色（tokens.css 状态色唯一映射） */
const LEAK_COLOR: Record<LeakStatus, string> = {
  待排查: 'var(--steppe-amber)',
  排查中: 'var(--flood-teal)',
  已确认漏损: 'var(--status-alarm)',
  已修复: 'var(--spring-green)',
};

/** 缴费渠道 → 色板（微信绿 / 营业厅青蓝 / 上门草金） */
const PAY_COLOR: Record<PayChannel, string> = {
  微信: 'var(--spring-green)',
  营业厅: 'var(--flood-teal)',
  上门: 'var(--steppe-amber)',
};

const kpi = billingKpi;

/* ---------- KPI（KPI 条 6 项） ---------- */
const stripKpis = computed(() => [
  { value: kpi.totalUsers, unit: '户', label: '用水户总数', alarm: false },
  { value: kpi.meterRate, unit: '%', label: '抄表到户率', alarm: false },
  { value: kpi.monthFee, unit: '万元', label: '本月水费', alarm: false },
  { value: kpi.collectionRate, unit: '%', label: '收缴率', alarm: false },
  { value: kpi.arrearsUsers, unit: '户', label: '欠费户数', alarm: true },
  { value: kpi.lossRate, unit: '%', label: '产销差率', alarm: false },
]);

/* ---------- 用水户构成 ---------- */
const userMixMax = Math.max(...userMix.map((m) => m.count));

/* ---------- 收缴率趋势 ---------- */
const collectionSeries = computed(() => [
  { name: '实际收缴率', data: collectionTrend.actual },
  { name: '目标线', data: collectionTrend.target },
]);

/* ---------- 产销差三级水量（CSS 分组柱） ---------- */
const meterMax = Math.max(...meterTrend.factory);

const meterGroups = computed(() =>
  meterTrend.months.map((month, i) => ({
    month,
    factory: meterTrend.factory[i],
    village: meterTrend.village[i],
    user: meterTrend.userMeters[i],
  })),
);

const lastGroup = computed(() => meterGroups.value[meterGroups.value.length - 1]);

/** 柱高百分比（以出厂最大值为 100% 基准） */
function barPct(v: number): string {
  return `${((v / meterMax) * 100).toFixed(1)}%`;
}

/** 千分位格式化 */
function fmt(n: number): string {
  return n.toLocaleString('en-US');
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

/* ===== KPI 条 ===== */
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
  position: relative;
}
.kpi-cell:last-child { border-right: none; }
.kpi-cell.is-alarm { background: rgba(255, 92, 92, 0.06); }
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
.f12 { flex: 1.2 1 0; min-height: 0; }
.f10 { flex: 1 1 0; min-height: 0; }

/* ===== 用水户构成 ===== */
.mix {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
}
.mix-foot {
  font-size: 12px;
  color: var(--text-dim);
  padding-top: 8px;
  border-top: var(--border-w) solid var(--line-vein);
}

/* ===== 产销差三级水量对比 ===== */
.lc {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.lc-legend {
  flex: none;
  display: flex;
  gap: 18px;
  font-size: 12px;
  color: var(--text-dim);
  padding-bottom: 6px;
}
.lc-legend .d {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 1px;
  margin-right: 5px;
}
.d-f { background: var(--flood-teal); }
.d-v { background: var(--steppe-amber); }
.d-u { background: var(--spring-green); }

.lc-plot {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: 26px;
  padding: 6px 8px 0;
  border-bottom: var(--border-w) solid var(--line-vein);
}
.lc-group {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  cursor: default;
}
.lc-bar {
  width: 16px;
  border-radius: 1px 1px 0 0;
  transition: filter 0.14s ease;
}
.b-f { background: var(--flood-teal); }
.b-v { background: var(--steppe-amber); }
.b-u { background: var(--spring-green); }
.lc-group:hover .lc-bar { filter: brightness(1.3); }

.lc-months {
  flex: none;
  display: flex;
  gap: 26px;
  padding: 6px 8px 0;
}
.lc-months span {
  flex: 1;
  text-align: center;
  font-size: 12px;
  color: var(--text-dim);
}
.lc-foot {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 10px;
  font-size: 13px;
  color: var(--text);
}
.lc-foot .bad {
  font-size: 18px;
  font-weight: 700;
  color: var(--status-alarm);
}
.lc-foot .dim { font-size: 12px; color: var(--text-dim); }

/* ===== 疑似漏损清单表 ===== */
.tbl-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}
.tbl-wrap::-webkit-scrollbar { width: 4px; }
.tbl-wrap::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.25); border-radius: 2px; }
.leak {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.leak th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--night-navy);
  color: var(--text-dim);
  font-weight: 400;
  font-size: 12px;
  text-align: left;
  padding: 6px 8px;
  border-bottom: var(--border-w) solid var(--line-vein);
}
.leak td {
  padding: 8px;
  border-bottom: var(--border-w) solid rgba(0, 194, 255, 0.08);
  color: var(--text);
  white-space: nowrap;
}
.leak tbody tr { transition: background 0.14s ease; }
.leak tbody tr:hover { background: rgba(0, 194, 255, 0.08); }
.leak .r { text-align: right; }
.leak .bad { color: var(--status-alarm); }
.st {
  display: inline-block;
  font-size: 11px;
  padding: 1px 6px;
  border: var(--border-w) solid;
  border-radius: 1px;
}

/* ===== 欠费提醒（红左条行，同 scada AlarmTable 行样式） ===== */
.ar-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}
.ar-list::-webkit-scrollbar { width: 4px; }
.ar-list::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.25); border-radius: 2px; }
.ar-row {
  flex: none;
  background: rgba(12, 35, 64, 0.5);
  border-left: 3px solid var(--status-alarm);
  border-radius: 1px;
  padding: 7px 10px;
  margin-bottom: 6px;
  transition: background 0.14s ease, border-color 0.14s ease;
}
.ar-row:hover {
  background: rgba(255, 92, 92, 0.08);
  border-left-color: var(--status-alarm);
}
.ar-row .l1 {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.ar-row .name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ar-row .proj {
  font-size: 12px;
  color: var(--flood-teal);
}
.ar-row .amt {
  margin-left: auto;
  font-size: 16px;
  font-weight: 700;
  color: var(--status-alarm);
}
.ar-row .l2 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 2px;
  font-size: 12px;
}
.ar-row .dim { color: var(--text-dim); }
.ar-row .months { margin-left: auto; color: var(--steppe-amber); }
.ar-row .months.hot {
  color: var(--status-alarm);
  font-weight: 600;
}

/* ===== 最近缴费流水 ===== */
.pay-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}
.pay-list::-webkit-scrollbar { width: 4px; }
.pay-list::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.25); border-radius: 2px; }
.pay-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 7px 8px;
  border-bottom: var(--border-w) solid rgba(0, 194, 255, 0.08);
  transition: background 0.14s ease;
}
.pay-row:hover { background: rgba(0, 194, 255, 0.08); }
.pay-row .time { font-size: 12px; }
.pay-row .dim { color: var(--text-dim); }
.pay-row .puser {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pay-row .amt {
  font-size: 15px;
  font-weight: 700;
  color: var(--spring-green);
}
.pay-row .ch {
  flex: none;
  font-size: 11px;
  padding: 1px 6px;
  border: var(--border-w) solid;
  border-radius: 1px;
}
</style>
