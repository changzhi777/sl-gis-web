<!--
  archives/List.vue — 工程资产档案列表（需求 §三 工程与资产档案）
  · mockData.projects 全量 1888 条（A 12 / B 8 / C 26 / D 1842），每页 20 条
  · 筛选：名称/编号关键字 + 类型 A-D + 苏木乡镇
  · 建成年份/设计规模/供水人口：按工程 id 种子确定性生成（1 期 mock 口径）
  · 行点击 / 操作列 → /archives/:id 详情（archive-detail 路由）
-->
<template>
  <div class="screen">
    <section class="page">
        <!-- 筛选栏 -->
        <div class="toolbar">
          <input
            v-model.trim="keyword"
            class="ipt ipt-key"
            type="text"
            placeholder="搜索工程名称 / 编号"
            aria-label="搜索工程名称或编号"
          />
          <select v-model="grade" class="ipt sel" aria-label="工程类型">
            <option value="">全部类型</option>
            <option v-for="g in GRADES" :key="g.value" :value="g.value">{{ g.label }}</option>
          </select>
          <select v-model="suMu" class="ipt sel" aria-label="苏木乡镇">
            <option value="">全部苏木乡镇</option>
            <option v-for="s in suMus" :key="s" :value="s">{{ s }}</option>
          </select>

          <div class="stat num">
            共 <b>{{ filtered.length }}</b> 条
            <i class="sep"></i>A {{ gradeCount.A }}
            <i class="sep"></i>B {{ gradeCount.B }}
            <i class="sep"></i>C {{ gradeCount.C }}
            <i class="sep"></i>D {{ gradeCount.D }}
          </div>
        </div>

        <!-- 档案表 -->
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th class="w-id">工程编号</th>
                <th>工程名称</th>
                <th class="w-grade">类型</th>
                <th class="w-sumu">所在苏木</th>
                <th class="w-num">建成年份</th>
                <th class="w-num">设计规模 m³/d</th>
                <th class="w-num">供水人口</th>
                <th class="w-status">状态</th>
                <th class="w-op">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rows"
                :key="row.p.id"
                tabindex="0"
                @click="goDetail(row.p.id)"
                @keydown.enter.prevent="goDetail(row.p.id)"
              >
                <td class="num dim">{{ row.p.id }}</td>
                <td class="name">{{ row.p.name }}</td>
                <td>
                  <span class="grade-chip" :class="`g-${row.p.grade}`">
                    {{ row.p.grade }} · {{ GRADE_LABEL[row.p.grade] }}
                  </span>
                </td>
                <td>{{ row.p.suMu }}</td>
                <td class="num">{{ row.builtYear }}</td>
                <td class="num">{{ row.scale }}</td>
                <td class="num">{{ row.population.toLocaleString('en-US') }}</td>
                <td>
                  <span
                    class="status-chip"
                    :style="{ color: STATUS_COLOR[row.p.status], borderColor: STATUS_COLOR[row.p.status] }"
                  >{{ STATUS_LABEL[row.p.status] }}</span>
                </td>
                <td>
                  <button class="op-btn" type="button" @click.stop="goDetail(row.p.id)">详情</button>
                </td>
              </tr>
              <tr v-if="rows.length === 0">
                <td colspan="9" class="empty">未找到匹配的工程档案</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 分页器 -->
        <div class="pager">
          <span class="info num">第 {{ page }} / {{ pageCount }} 页 · 每页 {{ PAGE_SIZE }} 条</span>
          <div class="pgs">
            <button class="pg-btn" type="button" :disabled="page <= 1" @click="page--">‹ 上一页</button>
            <template v-for="(pg, i) in pageList" :key="`${pg}-${i}`">
              <span v-if="pg === '…'" class="pg-ellipsis">…</span>
              <button
                v-else
                class="pg-btn num"
                type="button"
                :class="{ active: pg === page }"
                @click="goPage(pg)"
              >{{ pg }}</button>
            </template>
            <button class="pg-btn" type="button" :disabled="page >= pageCount" @click="page++">下一页 ›</button>
          </div>
        </div>
      </section>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { mockData } from '@mock/index';
import { STATUS_COLOR, type Grade, type Project, type Status } from '@shared/types';

/* ---------- 常量 ---------- */
const PAGE_SIZE = 20;

const GRADES: Array<{ value: Grade; label: string }> = [
  { value: 'A', label: 'A · 重点集中供水' },
  { value: 'B', label: 'B · 联村/较重要小型' },
  { value: 'C', label: 'C · 一般单村' },
  { value: 'D', label: 'D · 分散供水点' },
];

const GRADE_LABEL: Record<Grade, string> = {
  A: '重点集中',
  B: '联村供水',
  C: '单村供水',
  D: '分散供水',
};

const STATUS_LABEL: Record<Status, string> = {
  normal: '运行',
  alarm: '告警',
  repair: '检修',
  stop: '停运',
  offline: '离线',
};

/* ---------- 确定性派生（建成年份/规模/人口） ---------- */
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

interface ArchiveRow {
  p: Project;
  builtYear: number;
  scale: number;
  population: number;
}

function toRow(p: Project): ArchiveRow {
  const rand = mulberry32(hashStr(p.id));
  const builtYear = 1998 + Math.floor(rand() * 26);
  let scale = 0;
  let population = 0;
  if (p.grade === 'A') {
    scale = 1000 + Math.floor(rand() * 80) * 50;
    population = 3000 + Math.floor(rand() * 120) * 100;
  } else if (p.grade === 'B') {
    scale = 300 + Math.floor(rand() * 14) * 50;
    population = 800 + Math.floor(rand() * 44) * 50;
  } else if (p.grade === 'C') {
    scale = 50 + Math.floor(rand() * 25) * 10;
    population = 200 + Math.floor(rand() * 60) * 10;
  } else {
    scale = 5 + Math.floor(rand() * 9) * 5;
    population = 20 + Math.floor(rand() * 36) * 5;
  }
  return { p, builtYear, scale, population };
}

/* ---------- 筛选与分页 ---------- */
const router = useRouter();
const keyword = ref('');
const grade = ref<'' | Grade>('');
const suMu = ref('');
const page = ref(1);

const suMus = computed(() => [...new Set(mockData.projects.map((p) => p.suMu))]);

const filtered = computed(() =>
  mockData.projects.filter((p) => {
    const kw = keyword.value.toLowerCase();
    const hitKw =
      !kw || p.name.toLowerCase().includes(kw) || p.id.toLowerCase().includes(kw);
    const hitGrade = !grade.value || p.grade === grade.value;
    const hitSuMu = !suMu.value || p.suMu === suMu.value;
    return hitKw && hitGrade && hitSuMu;
  }),
);

const gradeCount = computed(() => {
  const cnt: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const p of mockData.projects) cnt[p.grade] += 1;
  return cnt;
});

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)));
const rows = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;
  return filtered.value.slice(start, start + PAGE_SIZE).map(toRow);
});

/** 筛选变化回第一页；页码越界收敛 */
watch([keyword, grade, suMu], () => {
  page.value = 1;
});
watch(pageCount, (n) => {
  if (page.value > n) page.value = n;
});

/** 页码窗口（首页 2 页 + 当前邻域 + 尾页 2 页，其余省略号） */
const pageList = computed<Array<number | '…'>>(() => {
  const n = pageCount.value;
  const cur = page.value;
  if (n <= 9) return Array.from({ length: n }, (_, i) => i + 1);
  const keep = new Set<number>([1, 2, n - 1, n, cur - 1, cur, cur + 1]);
  const arr: Array<number | '…'> = [];
  let prev = 0;
  for (let i = 1; i <= n; i++) {
    if (!keep.has(i)) continue;
    if (prev && i - prev > 1) arr.push('…');
    arr.push(i);
    prev = i;
  }
  return arr;
});

function goPage(pg: number | '…'): void {
  if (typeof pg === 'number') page.value = pg;
}

function goDetail(id: string): void {
  router.push(`/archives/${id}`);
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

.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 20px 12px;
  gap: 12px;
}

/* ===== 筛选栏 ===== */
.toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
}
.ipt {
  height: 34px;
  padding: 0 12px;
  color: var(--text);
  font-family: var(--cn);
  font-size: 13px;
  background: var(--night-navy);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  outline: none;
  transition: border-color 0.16s ease;
}
.ipt:focus {
  border-color: rgba(0, 194, 255, 0.55);
}
.ipt::placeholder {
  color: var(--text-dim);
}
.ipt-key {
  width: 300px;
}
.sel {
  width: 200px;
  cursor: pointer;
}
.sel option {
  background: var(--surface-blue);
  color: var(--text);
}
.stat {
  margin-left: auto;
  font-size: 14px;
  color: var(--text-dim);
}
.stat b {
  color: var(--spring-green);
  font-size: 18px;
  margin: 0 2px;
}
.sep {
  display: inline-block;
  width: 1px;
  height: 12px;
  margin: 0 10px;
  background: var(--line-vein);
  vertical-align: -1px;
}

/* ===== 表格 ===== */
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  background: var(--night-navy);
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  text-align: left;
  font-weight: 500;
  color: var(--text-dim);
  padding: 10px 14px;
  background: var(--surface-blue);
  border-bottom: var(--border-w) solid var(--line-vein);
  white-space: nowrap;
}
.tbl tbody td {
  padding: 9px 14px;
  border-bottom: 1px solid rgba(0, 194, 255, 0.07);
  white-space: nowrap;
}
.tbl tbody tr {
  cursor: pointer;
  transition: background 0.14s ease;
}
.tbl tbody tr:hover,
.tbl tbody tr:focus-visible {
  background: rgba(0, 194, 255, 0.08);
}
.tbl tbody tr:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: -2px;
}
.w-id { width: 130px; }
.w-grade { width: 140px; }
.w-sumu { width: 150px; }
.w-num { width: 110px; }
.w-status { width: 84px; }
.w-op { width: 76px; }

.dim {
  color: var(--text-dim);
}
.name {
  color: var(--text);
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
.grade-chip.g-D {
  color: var(--text-dim);
  border-color: rgba(107, 122, 143, 0.5);
  background: transparent;
}

.status-chip {
  display: inline-block;
  padding: 1px 8px;
  font-size: 12px;
  border: 1px solid;
  border-radius: 1px;
}

.op-btn {
  padding: 3px 12px;
  font-size: 12px;
  color: var(--spring-green);
  background: rgba(0, 255, 224, 0.08);
  border: 1px solid rgba(0, 255, 224, 0.4);
  border-radius: 1px;
  cursor: pointer;
  transition: background 0.14s ease;
}
.op-btn:hover {
  background: rgba(0, 255, 224, 0.18);
}

.empty {
  text-align: center;
  color: var(--text-dim);
  padding: 48px 0 !important;
}

/* ===== 分页器 ===== */
.pager {
  flex: none;
  display: flex;
  align-items: center;
  gap: 16px;
}
.info {
  font-size: 13px;
  color: var(--text-dim);
}
.pgs {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.pg-btn {
  min-width: 32px;
  height: 30px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--text);
  background: var(--night-navy);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.14s ease;
}
.pg-btn:hover:not(:disabled) {
  border-color: rgba(0, 194, 255, 0.5);
  color: var(--spring-green);
}
.pg-btn.active {
  color: var(--spring-green);
  border-color: rgba(0, 255, 224, 0.6);
  background: rgba(0, 255, 224, 0.1);
}
.pg-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.pg-ellipsis {
  color: var(--text-dim);
  padding: 0 2px;
}
</style>
