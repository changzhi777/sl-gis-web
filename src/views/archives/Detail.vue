<!--
  archives/Detail.vue — 单工程详情页（需求 §三 一工程一档案）
  · 数据源（v8.3 真化）：route.params.id 即工程编码 → /api/projects/{code} 水合；
    后端无此 id 时回落 mockData.projects 查找；均未命中给出空态 + 返回
  · 左：工程基本信息卡；右：设备清单 / 维修记录 / 水质检测记录
  · 三张表均按工程 id 种子确定性生成（1 期 mock 口径，刷新不变，挂真工程编码）
-->
<template>
  <div class="screen">
    <section class="page">
        <!-- 顶栏：返回 + 标题 -->
        <div class="head">
          <button class="back-btn" type="button" @click="router.push('/archives')">
            ← 返回档案列表
          </button>
          <h2 v-if="project" class="title">
            {{ project.name }}
            <span class="num sub-id">{{ project.id }}</span>
          </h2>
        </div>

        <!-- 未找到 -->
        <div v-if="!project" class="missing">
          <Panel title="未找到工程" sub="档案检索">
            <p class="missing-text">
              编号 <b class="num">{{ pid }}</b> 不在档案库中，请返回列表重新选择。
            </p>
          </Panel>
        </div>

        <!-- 主体：左信息卡 + 右三表 -->
        <div v-else class="body">
          <!-- 左：基本信息 -->
          <Panel class="info-panel" title="工程基本信息" sub="一工程一档案" hero>
            <dl class="info-list">
              <div class="irow">
                <dt>工程编号</dt>
                <dd class="num">{{ project.id }}</dd>
              </div>
              <div class="irow">
                <dt>工程类型</dt>
                <dd>
                  <span class="grade-chip">{{ project.grade }} 级 · {{ GRADE_LABEL[project.grade] }}</span>
                </dd>
              </div>
              <div class="irow">
                <dt>所在苏木</dt>
                <dd>{{ project.suMu }}</dd>
              </div>
              <div class="irow">
                <dt>坐标</dt>
                <dd class="num">{{ project.coord[0].toFixed(4) }}°E · {{ project.coord[1].toFixed(4) }}°N</dd>
              </div>
              <div class="irow">
                <dt>建成年份</dt>
                <dd class="num">{{ builtYear }}</dd>
              </div>
              <div class="irow">
                <dt>设计规模</dt>
                <dd><span class="num">{{ scale }}</span> m³/d</dd>
              </div>
              <div class="irow">
                <dt>供水人口</dt>
                <dd><span class="num">{{ population.toLocaleString('en-US') }}</span> 人</dd>
              </div>
              <div class="irow">
                <dt>责任人</dt>
                <dd>{{ project.responsible }}</dd>
              </div>
              <div class="irow">
                <dt>运行状态</dt>
                <dd>
                  <span
                    class="status-chip"
                    :style="{ color: STATUS_COLOR[project.status], borderColor: STATUS_COLOR[project.status] }"
                  >{{ STATUS_LABEL[project.status] }}</span>
                </dd>
              </div>
            </dl>

            <!-- 实时关键值（档案关联监测口径） -->
            <div v-if="metricEntries.length" class="metrics">
              <div class="m-cap">关键实时值</div>
              <div class="m-grid">
                <div v-for="m in metricEntries" :key="m.label" class="m-cell">
                  <div class="m-val num">{{ m.value }}</div>
                  <div class="m-label">{{ m.label }}</div>
                </div>
              </div>
            </div>
          </Panel>

          <!-- 右：三张台账 -->
          <div class="tables">
            <Panel title="设备清单" :sub="`${devices.length} 台（套）`">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>设备名称</th>
                    <th>型号</th>
                    <th class="w-num">数量</th>
                    <th class="w-num">安装年份</th>
                    <th class="w-status">状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="d in devices" :key="d.name">
                    <td>{{ d.name }}</td>
                    <td class="num dim">{{ d.model }}</td>
                    <td class="num">{{ d.count }}</td>
                    <td class="num">{{ d.year }}</td>
                    <td>
                      <span class="d-status" :style="{ color: DEVICE_STATUS_COLOR[d.status] }">{{ d.status }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Panel>

            <Panel title="维修记录" :sub="`近两年 ${repairs.length} 次`">
              <table class="tbl">
                <thead>
                  <tr>
                    <th class="w-date">日期</th>
                    <th>故障描述</th>
                    <th class="w-person">处理人</th>
                    <th class="w-num">工时 h</th>
                    <th class="w-status">状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in repairs" :key="r.date + r.item">
                    <td class="num dim">{{ r.date }}</td>
                    <td>{{ r.item }}</td>
                    <td>{{ r.person }}</td>
                    <td class="num">{{ r.hours }}</td>
                    <td>
                      <span :class="r.done ? 'ok' : 'doing'">{{ r.done ? '已办结' : '处理中' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Panel>

            <Panel title="水质检测记录" :sub="`近一年 ${tests.length} 次`" variant="alarm">
              <table class="tbl">
                <thead>
                  <tr>
                    <th class="w-date">日期</th>
                    <th class="w-point">采样点</th>
                    <th class="w-num">浊度 NTU</th>
                    <th class="w-num">余氯 mg/L</th>
                    <th class="w-num">pH</th>
                    <th class="w-status">结论</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in tests" :key="t.date + t.point">
                    <td class="num dim">{{ t.date }}</td>
                    <td>{{ t.point }}</td>
                    <td class="num" :class="{ bad: t.turbidity > 1 }">{{ t.turbidity.toFixed(2) }}</td>
                    <td class="num">{{ t.chlorine.toFixed(2) }}</td>
                    <td class="num">{{ t.ph.toFixed(2) }}</td>
                    <td>
                      <span :class="t.pass ? 'ok' : 'fail'">{{ t.pass ? '合格' : '不合格' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Panel>
          </div>
        </div>
      </section>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Panel from '@ui/Panel.vue';
import { mockData } from '@mock/index';
import { apiFetch } from '@/composables/realtime';
import { mapProject } from '@shared/backend';
import { STATUS_COLOR, type Grade, type Project, type Status } from '@shared/types';

/* ---------- 常量 ---------- */
const GRADE_LABEL: Record<Grade, string> = {
  A: '重点集中供水',
  B: '联村/较重要小型',
  C: '一般单村',
  D: '分散供水点',
};

const STATUS_LABEL: Record<Status, string> = {
  normal: '运行',
  alarm: '告警',
  repair: '检修',
  stop: '停运',
  offline: '离线',
};

const METRIC_LABEL: Record<string, { label: string; unit: string }> = {
  pressure: { label: '压力', unit: 'MPa' },
  flow: { label: '流量', unit: 'm³/h' },
  level: { label: '液位', unit: 'm' },
  turbidity: { label: '浊度', unit: 'NTU' },
  chlorine: { label: '余氯', unit: 'mg/L' },
  ph: { label: 'pH', unit: '' },
  temperature: { label: '水温', unit: '°C' },
  pumpCurrent: { label: '水泵电流', unit: 'A' },
};

/* ---------- 确定性 PRNG（与 mock 工厂同源 mulberry32） ---------- */
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

/* ---------- 路由工程查找：mock 起步 → /api/projects/{code} 真工程水合 ---------- */
const route = useRoute();
const router = useRouter();

const pid = computed(() => {
  const v = route.params.id;
  return Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');
});

const project = ref<Project | null>(
  mockData.projects.find((p) => p.id === pid.value) ?? null,
);

/** 后端真工程水合：命中 code 即覆盖；失败/无此 id 静默保留 mock 回落 */
async function hydrateProject(): Promise<void> {
  const row = await apiFetch<Record<string, unknown>>(`/api/projects/${encodeURIComponent(pid.value)}`);
  if (row && String(row.code) === pid.value) project.value = mapProject(row);
}

watch(pid, () => {
  project.value = mockData.projects.find((p) => p.id === pid.value) ?? null;
  void hydrateProject();
}, { immediate: true });

/* ---------- 基本信息（年份/规模/人口：与 List.vue 同一派生口径） ---------- */
const builtYear = computed(() => {
  if (!project.value) return 0;
  return 1998 + Math.floor(mulberry32(hashStr(project.value.id))() * 26);
});

const scale = computed(() => {
  const p = project.value;
  if (!p) return 0;
  const rand = mulberry32(hashStr(p.id));
  rand(); // 消耗第一个随机数（与 List 的 builtYear 同源）
  if (p.grade === 'A') return 1000 + Math.floor(rand() * 80) * 50;
  if (p.grade === 'B') return 300 + Math.floor(rand() * 14) * 50;
  if (p.grade === 'C') return 50 + Math.floor(rand() * 25) * 10;
  return 5 + Math.floor(rand() * 9) * 5;
});

const population = computed(() => {
  const p = project.value;
  if (!p) return 0;
  const rand = mulberry32(hashStr(p.id));
  rand();
  rand(); // 消耗规模位随机数，保持与 List 口径一致
  if (p.grade === 'A') return 3000 + Math.floor(rand() * 120) * 100;
  if (p.grade === 'B') return 800 + Math.floor(rand() * 44) * 50;
  if (p.grade === 'C') return 200 + Math.floor(rand() * 60) * 10;
  return 20 + Math.floor(rand() * 36) * 5;
});

/* ---------- 关键实时值 ---------- */
const metricEntries = computed(() => {
  const p = project.value;
  if (!p) return [];
  return Object.entries(p.metrics)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .map(([k, v]) => ({
      label: `${METRIC_LABEL[k]?.label ?? k} ${METRIC_LABEL[k]?.unit ?? ''}`,
      value: String(v),
    }));
});

/* ---------- 设备清单（按级别配置，确定性生成） ---------- */
const DEVICE_SETS: Record<Grade, Array<{ name: string; model: string }>> = {
  A: [
    { name: '潜水电泵', model: '200QJ32-52/4' },
    { name: '变频控制柜', model: 'BTS-Ⅲ 45kW' },
    { name: '二氧化氯消毒设备', model: 'HT-2008' },
    { name: '远传水表', model: 'LXLC-100' },
    { name: '压力变送器', model: 'GP-100' },
    { name: '投入式液位计', model: 'SDMB-701' },
    { name: '视频监控枪机', model: 'DS-2CD3T45' },
    { name: '门禁一体机', model: 'DS-K1T804' },
  ],
  B: [
    { name: '潜水电泵', model: '150QJ20-50/7' },
    { name: '变频控制柜', model: 'BTS-Ⅱ 22kW' },
    { name: '缓释消毒设备', model: 'JY-02' },
    { name: '远传水表', model: 'LXLC-80' },
    { name: '压力变送器', model: 'GP-100' },
  ],
  C: [
    { name: '潜水电泵', model: '100QJ10-60/8' },
    { name: '一体化净水设备', model: 'JYD-10' },
    { name: '远传水表', model: 'LXLC-50' },
  ],
  D: [
    { name: '小型离心泵', model: '1.5DW 1.1kW' },
    { name: 'IC 卡水表', model: 'LXS-25E' },
  ],
};

const DEVICE_STATUS = ['正常', '正常', '正常', '正常', '备用', '检修', '报废'] as const;
const DEVICE_STATUS_COLOR: Record<string, string> = {
  正常: 'var(--spring-green)',
  备用: 'var(--flood-teal)',
  检修: 'var(--steppe-amber)',
  报废: 'var(--status-stop)',
};

interface DeviceRow {
  name: string;
  model: string;
  count: number;
  year: number;
  status: string;
}

const devices = computed<DeviceRow[]>(() => {
  const p = project.value;
  if (!p) return [];
  const rand = mulberry32(hashStr(p.id) ^ 0x7d3c1a);
  return DEVICE_SETS[p.grade].map((d, i) => ({
    name: d.name,
    model: d.model,
    count: 1 + Math.floor(rand() * (p.grade === 'A' ? 4 : 2)),
    year: builtYear.value + Math.floor(rand() * 4),
    status: i === 0 && (p.status === 'repair' || p.status === 'alarm')
      ? '检修'
      : DEVICE_STATUS[Math.floor(rand() * DEVICE_STATUS.length)],
  }));
});

/* ---------- 维修记录 ---------- */
const REPAIR_ITEMS = [
  '水泵启动失败，更换机械密封',
  '管路接口渗漏，重新热熔处理',
  '变频器过流告警，参数整定',
  '水表冻裂，整体更换',
  '消毒设备药剂管路堵塞，疏通',
  '电缆绝缘老化，局部换线',
];

const PERSONS = ['巴特尔', '朝鲁', '哈斯', '乌力吉', '苏乙拉', '其木德'];

interface RepairRow {
  date: string;
  item: string;
  person: string;
  hours: number;
  done: boolean;
}

const repairs = computed<RepairRow[]>(() => {
  const p = project.value;
  if (!p) return [];
  const rand = mulberry32(hashStr(p.id) ^ 0x9e3779b9);
  const rows: RepairRow[] = [];
  // 以 2026-09 为基准向回排 5 次
  for (let i = 0; i < 5; i++) {
    const month = 9 - Math.floor(rand() * 6) - i * 4; // 粗粒度回退
    const norm = ((month % 12) + 12) % 12;
    const year = 2026 - (month < 0 ? Math.ceil(-month / 12) : 0);
    rows.push({
      date: `${year}-${p2(norm + 1)}-${p2(3 + Math.floor(rand() * 24))}`,
      item: REPAIR_ITEMS[Math.floor(rand() * REPAIR_ITEMS.length)],
      person: PERSONS[Math.floor(rand() * PERSONS.length)],
      hours: 1 + Math.floor(rand() * 16),
      done: !(i === 0 && (p.status === 'alarm' || p.status === 'repair')),
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
});

/* ---------- 水质检测记录（季度采样） ---------- */
const SAMPLE_POINTS = ['出厂水', '末梢水', '水源水'];

interface TestRow {
  date: string;
  point: string;
  turbidity: number;
  chlorine: number;
  ph: number;
  pass: boolean;
}

const tests = computed<TestRow[]>(() => {
  const p = project.value;
  if (!p) return [];
  const rand = mulberry32(hashStr(p.id) ^ 0x51ed270b);
  const rows: TestRow[] = [];
  // 2026-09 起按季度回退 6 次
  const months = [9, 6, 3, 12, 9, 6];
  months.forEach((m, i) => {
    const fail = p.status === 'alarm' && i === 0;
    rows.push({
      date: `${m > 9 ? 2025 : 2026}-${p2(m)}-${p2(5 + Math.floor(rand() * 20))}`,
      point: SAMPLE_POINTS[i % SAMPLE_POINTS.length],
      turbidity: fail ? +(1.2 + rand() * 0.6).toFixed(2) : +(0.18 + rand() * 0.72).toFixed(2),
      chlorine: +(0.32 + rand() * 0.53).toFixed(2),
      ph: +(6.9 + rand() * 1.3).toFixed(2),
      pass: !fail,
    });
  });
  return rows;
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

.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px 20px 16px;
  gap: 12px;
}

/* ===== 顶栏 ===== */
.head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 20px;
}
.back-btn {
  padding: 6px 16px;
  font-size: 13px;
  color: var(--flood-teal);
  background: rgba(0, 194, 255, 0.08);
  border: 1px solid rgba(0, 194, 255, 0.4);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.14s ease;
}
.back-btn:hover {
  background: rgba(0, 194, 255, 0.16);
}
.title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.sub-id {
  margin-left: 12px;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-dim);
}

/* ===== 未找到 ===== */
.missing {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.missing :deep(.panel) {
  width: 520px;
  height: 220px;
}
.missing-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-dim);
}
.missing-text b {
  color: var(--steppe-amber);
}

/* ===== 主体 ===== */
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: var(--panel-gap);
}
.info-panel {
  flex: 0 0 420px;
}
.tables {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
}
.tables > .panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ===== 信息卡 ===== */
.info-list {
  margin: 0;
  display: flex;
  flex-direction: column;
}
.irow {
  display: flex;
  align-items: baseline;
  padding: 7px 0;
  border-bottom: 1px solid rgba(0, 194, 255, 0.08);
  font-size: 14px;
}
.irow:last-child {
  border-bottom: none;
}
.irow dt {
  flex: 0 0 96px;
  color: var(--text-dim);
}
.irow dd {
  margin: 0;
  flex: 1;
  min-width: 0;
}
.grade-chip {
  display: inline-block;
  padding: 1px 8px;
  font-size: 12px;
  color: var(--flood-teal);
  border: 1px solid rgba(0, 194, 255, 0.4);
  border-radius: 1px;
  background: rgba(0, 194, 255, 0.06);
}
.status-chip {
  display: inline-block;
  padding: 2px 10px;
  font-size: 13px;
  border: 1px solid;
  border-radius: 1px;
}

/* 关键实时值 */
.metrics {
  margin-top: 12px;
  flex: none;
}
.m-cap {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 8px;
  letter-spacing: 1px;
}
.m-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.m-cell {
  padding: 8px 10px;
  background: rgba(12, 35, 64, 0.6);
  border: 1px solid rgba(0, 194, 255, 0.12);
  border-radius: 1px;
}
.m-val {
  font-size: 20px;
  font-weight: 600;
  color: var(--spring-green);
  line-height: 1.2;
}
.m-label {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 2px;
}

/* ===== 台账表 ===== */
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl thead th {
  text-align: left;
  font-weight: 500;
  color: var(--text-dim);
  padding: 6px 10px;
  background: rgba(12, 35, 64, 0.7);
  border-bottom: var(--border-w) solid var(--line-vein);
  white-space: nowrap;
}
.tbl tbody td {
  padding: 6px 10px;
  border-bottom: 1px solid rgba(0, 194, 255, 0.07);
  white-space: nowrap;
}
.w-num { width: 90px; }
.w-status { width: 84px; }
.w-date { width: 110px; }
.w-person { width: 90px; }
.w-point { width: 90px; }

.dim {
  color: var(--text-dim);
}
.d-status {
  font-size: 12px;
}
.ok {
  color: var(--spring-green);
  font-size: 12px;
}
.doing {
  color: var(--steppe-amber);
  font-size: 12px;
}
.fail {
  color: var(--status-alarm);
  font-size: 12px;
}
.bad {
  color: var(--status-alarm);
}
</style>
