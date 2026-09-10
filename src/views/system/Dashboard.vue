<!--
  system/Dashboard.vue — 系统管理大屏主视图（需求 §十二 组织权限与系统管理）
  页内确定性 mock 来自 ./mock.ts（菜单即权限 · mini-rbac 口径，1 期无后端）
  · 顶部 KPI 条：组织机构数 / 角色数 / 账户总数 / 今日操作 / 接口异常数 / 权限复核到期数
  · 左列：组织架构树（旗水利局 → 统管公司 → 7 苏木乡镇站 → 嘎查村，点选高亮）+ 角色权限（点选联动矩阵列高亮）
  · 中列：用户管理表（复核按钮仅样式）+ 菜单权限矩阵（行=菜单 × 列=角色，✓ 青色）
  · 右列：操作日志（敏感操作红标「敏感」）+ 外部接口状态（正常绿 / 异常红 / 未接入灰）
-->
<template>
  <div class="screen">
    <!-- 顶部 KPI 条（6 格） -->
      <div class="kpi-strip" role="group" aria-label="系统管理关键指标">
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
          <Panel title="组织架构" sub="旗水利局 → 统管公司 → 苏木乡镇站" class="f16">
            <div class="tree" role="tree" aria-label="组织架构树">
              <button
                v-for="n in flatOrgs"
                :key="n.id"
                type="button"
                class="tree-node"
                role="treeitem"
                :aria-selected="n.id === selectedOrgId"
                :class="{ active: n.id === selectedOrgId, [`lv-${n.level}`]: true }"
                :style="{ paddingLeft: `${12 + n.depth * 18}px` }"
                @click="selectedOrgId = n.id"
              >
                <i class="node-dot" aria-hidden="true"></i>
                <span class="node-name">{{ n.name }}</span>
                <span class="node-count num" :class="{ leaf: n.children.length === 0 }">
                  {{ n.total }}人
                </span>
              </button>
            </div>
          </Panel>

          <Panel title="角色权限" :sub="`${roles.length} 个角色 · 菜单即权限`" class="f10">
            <div class="role-list">
              <MicroBar
                v-for="(r, i) in roles"
                :key="r.id"
                class="role-bar"
                :class="{ 'is-active': r.id === selectedRoleId }"
                :label="r.name"
                :value="r.userCount"
                unit="人"
                :decimals="0"
                :max="maxRoleUsers"
                :color="ROLE_COLOR[i % ROLE_COLOR.length]"
              />
              <div class="role-sub">级别徽标 · 点击角色高亮矩阵列</div>
              <div class="role-chips">
                <button
                  v-for="(r, i) in roles"
                  :key="r.id"
                  type="button"
                  class="role-chip"
                  :class="{ active: r.id === selectedRoleId }"
                  :style="{ '--chip-c': ROLE_COLOR[i % ROLE_COLOR.length] }"
                  @click="toggleRole(r.id)"
                >
                  {{ r.name }}
                  <b>{{ r.level }}</b>
                </button>
              </div>
            </div>
          </Panel>
        </div>

        <!-- ============ 中列 ============ -->
        <div class="col">
          <Panel title="用户管理" :sub="`平台账户 ${accountTotal} 个 · 演示 ${users.length} 条`" class="f12" hero>
            <div class="tbl-wrap">
              <table class="tbl users-tbl">
                <thead>
                  <tr>
                    <th>账号</th>
                    <th>姓名</th>
                    <th>角色</th>
                    <th>所属组织</th>
                    <th>最后登录</th>
                    <th>状态</th>
                    <th class="ta-r">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in users" :key="u.id" :class="{ 'row-disabled': !u.enabled }">
                    <td class="num">{{ u.account }}</td>
                    <td>
                      {{ u.name }}
                      <b v-if="u.reviewDue" class="due-tag">复核到期</b>
                    </td>
                    <td class="dim">{{ u.role }}</td>
                    <td class="dim org-cell" :title="u.org">{{ u.org }}</td>
                    <td class="num dim">{{ u.lastLogin }}</td>
                    <td>
                      <span class="st" :class="u.enabled ? 'st-on' : 'st-off'">
                        {{ u.enabled ? '启用' : '禁用' }}
                      </span>
                    </td>
                    <td class="ta-r">
                      <button type="button" class="btn-review">复核</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="菜单权限矩阵" sub="行 = 菜单模块 · 列 = 角色 · ✓ 已授权（最小权限）" class="f10">
            <div class="tbl-wrap">
              <table class="tbl perm-tbl">
                <thead>
                  <tr>
                    <th class="menu-col">菜单模块</th>
                    <th
                      v-for="r in roles"
                      :key="r.id"
                      :class="{ 'col-hl': r.id === selectedRoleId }"
                    >{{ r.name }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in permMatrix" :key="row.menu">
                    <td class="menu-col">{{ row.menu }}</td>
                    <td
                      v-for="(ok, ci) in row.grants"
                      :key="roles[ci].id"
                      :class="{ 'col-hl': roles[ci].id === selectedRoleId }"
                    >
                      <span v-if="ok" class="grant num">✓</span>
                      <span v-else class="deny num">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <!-- ============ 右列 ============ -->
        <div class="col">
          <Panel title="操作日志" :sub="`今日 ${TODAY_OPS} 条 · 留痕追溯`" variant="alarm" class="f12" hero>
            <div class="logs">
              <div
                v-for="l in opLogs"
                :key="l.id"
                class="log-row"
                :class="{ 'log-fail': l.result === '失败' }"
              >
                <div class="log-l1">
                  <span class="num log-time">{{ l.time }}</span>
                  <span class="log-user">{{ l.user }}</span>
                  <span class="log-role dim">{{ l.role }}</span>
                  <b v-if="l.sensitive" class="sen-tag">敏感</b>
                  <b v-if="l.result === '失败'" class="fail-tag">失败</b>
                </div>
                <div class="log-l2">
                  {{ l.action }} · {{ l.target }}
                  <span class="log-ip num">{{ l.ip }}</span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="外部接口状态" sub="预留数据交换 · 6 路" class="f10">
            <div class="apis">
              <div v-for="a in extApis" :key="a.id" class="api-row">
                <i class="api-dot" :class="`dot-${apiDot[a.status]}`" aria-hidden="true"></i>
                <span class="api-name">{{ a.name }}</span>
                <span class="api-st" :class="`stc-${apiDot[a.status]}`">{{ a.status }}</span>
                <span class="num api-sync dim">{{ a.lastSync }}</span>
              </div>
            </div>
          </Panel>
        </div>
      </main>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import KpiCard from '@ui/KpiCard.vue';
import Panel from '@ui/Panel.vue';
import MicroBar from '@charts/MicroBar.vue';
import {
  orgTree,
  roles,
  users,
  permMatrix,
  opLogs,
  extApis,
  TODAY_OPS,
} from './mock';
import type { OrgNode } from './mock';

/* ---------- 组织树：拍平 + 缩进层级（末级人数 = 直挂口径，上级 = 子树合计） ---------- */
interface FlatOrg {
  id: string;
  name: string;
  level: OrgNode['level'];
  /** 子树用户合计 */
  total: number;
  /** 无子节点 = 末级 */
  children: OrgNode[];
  depth: number;
}

function sumTree(n: OrgNode): number {
  return n.userCount + n.children.reduce((s, c) => s + sumTree(c), 0);
}

function flatten(nodes: OrgNode[], depth = 0, out: FlatOrg[] = []): FlatOrg[] {
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, level: n.level, total: sumTree(n), children: n.children, depth });
    if (n.children.length) flatten(n.children, depth + 1, out);
  }
  return out;
}

const flatOrgs: FlatOrg[] = flatten(orgTree);

/** 组织树点选高亮（默认旗水利局） */
const selectedOrgId = ref<string>(orgTree[0].id);

/* ---------- 角色：用户数条 + 级别徽标，点选联动矩阵列 ---------- */
const ROLE_COLOR: string[] = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-4)',
  'var(--chart-3)',
  'var(--chart-6)',
  'var(--chart-5)',
  'var(--text-dim)',
];
const maxRoleUsers: number = Math.max(...roles.map((r) => r.userCount));

/** 当前高亮角色（'' = 无）；再点一次取消 */
const selectedRoleId = ref<string>('');

function toggleRole(id: string): void {
  selectedRoleId.value = selectedRoleId.value === id ? '' : id;
}

/* ---------- KPI（静态口径，来自 mock 推导） ---------- */
const accountTotal: number = roles.reduce((s, r) => s + r.userCount, 0);
const apiAbnormal: number = extApis.filter((a) => a.status === '异常').length;
const reviewDue: number = users.filter((u) => u.reviewDue).length;

const stripKpis = [
  { value: flatOrgs.length, unit: '个', label: '组织机构数', alarm: false },
  { value: roles.length, unit: '个', label: '角色数', alarm: false },
  { value: accountTotal, unit: '个', label: '账户总数', alarm: false },
  { value: TODAY_OPS, unit: '次', label: '今日操作', alarm: false },
  { value: apiAbnormal, unit: '路', label: '接口异常数', alarm: true },
  { value: reviewDue, unit: '个', label: '权限复核到期数', alarm: true },
];

/** 接口状态 → 圆点/文案色 */
const apiDot = { 正常: 'ok', 异常: 'bad', 未接入: 'na' } as const;
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
.f16 { flex: 1.6 1 0; min-height: 0; }
.f12 { flex: 1.2 1 0; min-height: 0; }
.f10 { flex: 1 1 0; min-height: 0; }

/* ===== 组织架构树 ===== */
.tree {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}
.tree::-webkit-scrollbar { width: 4px; }
.tree::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.25); border-radius: 2px; }

.tree-node {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 5px;
  padding-bottom: 5px;
  padding-right: 8px;
  margin-bottom: 2px;
  font-size: 13px;
  font-family: var(--cn);
  color: var(--text);
  text-align: left;
  background: rgba(12, 35, 64, 0.4);
  border: var(--border-w) solid transparent;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease;
}
.tree-node:hover { background: rgba(0, 194, 255, 0.1); }
.tree-node.active {
  background: rgba(0, 194, 255, 0.14);
  border-color: rgba(0, 194, 255, 0.55);
}
.tree-node:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: 1px;
}

/* 层级圆点：旗级青亮 → 公司青 → 乡镇暗青 → 村级小灰 */
.node-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.lv-county .node-dot { background: var(--flood-teal); box-shadow: 0 0 6px rgba(0, 194, 255, 0.6); }
.lv-company .node-dot { background: var(--flood-teal); }
.lv-township .node-dot { background: rgba(0, 194, 255, 0.45); }
.lv-village .node-dot { width: 5px; height: 5px; background: var(--status-offline); }
.lv-village { color: var(--text-dim); font-size: 12px; }

.node-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lv-county .node-name { font-weight: 600; }
.node-count {
  flex: none;
  font-size: 12px;
  color: var(--text-dim);
}
.node-count.leaf {
  color: var(--spring-green);
  font-weight: 600;
}

/* ===== 角色权限 ===== */
.role-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.role-bar { padding: 3px 0; }
/* 加宽标签位容纳 7 字角色名（MicroBar 缺省 72px 不够） */
.role-bar :deep(.mb-label) {
  flex: 0 0 104px;
  font-size: 12px;
  cursor: pointer;
}
.role-bar.is-active :deep(.mb-label) { color: var(--spring-green); }
.role-sub {
  margin-top: 6px;
  padding-top: 6px;
  border-top: var(--border-w) solid var(--line-vein);
  font-size: 11px;
  color: var(--text-dim);
}
.role-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.role-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  font-size: 12px;
  font-family: var(--cn);
  color: var(--text);
  background: rgba(12, 35, 64, 0.5);
  border: var(--border-w) solid rgba(0, 194, 255, 0.3);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color 0.14s ease, background 0.14s ease;
}
.role-chip b {
  font-weight: 400;
  font-size: 11px;
  color: var(--chip-c);
}
.role-chip:hover { background: rgba(0, 194, 255, 0.1); }
.role-chip.active {
  border-color: var(--chip-c);
  background: rgba(0, 194, 255, 0.12);
}
.role-chip:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: 1px;
}

/* ===== 表格通用 ===== */
.tbl-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}
.tbl-wrap::-webkit-scrollbar { width: 4px; }
.tbl-wrap::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.25); border-radius: 2px; }
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 8px;
  font-weight: 500;
  font-size: 12px;
  color: var(--text-dim);
  text-align: left;
  background: var(--night-navy);
  border-bottom: var(--border-w) solid var(--line-vein);
  white-space: nowrap;
}
.tbl td {
  padding: 7px 8px;
  border-bottom: var(--border-w) solid rgba(0, 194, 255, 0.08);
  white-space: nowrap;
}
.tbl tbody tr:hover td { background: rgba(0, 194, 255, 0.05); }
.ta-r { text-align: right !important; }
.dim { color: var(--text-dim); }

/* ===== 用户表 ===== */
.users-tbl th:nth-child(6),
.users-tbl td:nth-child(6) { text-align: center; }
.org-cell {
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-disabled td { opacity: 0.5; }

.due-tag {
  margin-left: 4px;
  padding: 0 4px;
  font-weight: 400;
  font-size: 10px;
  color: var(--steppe-amber);
  border: var(--border-w) solid rgba(255, 180, 84, 0.5);
  border-radius: 1px;
}
.st {
  display: inline-block;
  padding: 1px 8px;
  font-size: 11px;
  border-radius: 1px;
  border: var(--border-w) solid transparent;
}
.st-on {
  color: var(--spring-green);
  border-color: rgba(0, 255, 224, 0.35);
  background: rgba(0, 255, 224, 0.07);
}
.st-off {
  color: var(--text-dim);
  border-color: rgba(107, 122, 143, 0.5);
  background: rgba(107, 122, 143, 0.12);
}
.btn-review {
  padding: 2px 10px;
  font-size: 12px;
  font-family: var(--cn);
  color: var(--flood-teal);
  background: rgba(0, 194, 255, 0.08);
  border: var(--border-w) solid rgba(0, 194, 255, 0.45);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease;
}
.btn-review:hover {
  background: rgba(0, 194, 255, 0.18);
  border-color: rgba(0, 194, 255, 0.8);
}
.btn-review:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: 1px;
}

/* ===== 权限矩阵 ===== */
.perm-tbl th,
.perm-tbl td { text-align: center; }
.perm-tbl .menu-col {
  text-align: left;
  width: 110px;
}
.perm-tbl td { padding: 6px 8px; }
.col-hl {
  background: rgba(0, 194, 255, 0.1);
}
.grant {
  color: var(--spring-green);
  font-weight: 700;
  font-size: 14px;
  text-shadow: 0 0 8px rgba(0, 255, 224, 0.35);
}
.deny {
  color: var(--status-offline);
}

/* ===== 操作日志 ===== */
.logs {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}
.logs::-webkit-scrollbar { width: 4px; }
.logs::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.25); border-radius: 2px; }
.log-row {
  padding: 6px 8px;
  margin-bottom: 4px;
  background: rgba(12, 35, 64, 0.4);
  border-left: 2px solid rgba(0, 194, 255, 0.3);
  border-radius: var(--radius);
}
.log-row.log-fail {
  border-left-color: var(--status-alarm);
  background: rgba(255, 92, 92, 0.06);
}
.log-l1 {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.log-time {
  flex: none;
  font-size: 12px;
  color: var(--flood-teal);
}
.log-user {
  flex: none;
  font-size: 13px;
  font-weight: 600;
}
.log-role {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sen-tag {
  flex: none;
  padding: 0 4px;
  font-weight: 400;
  font-size: 10px;
  color: var(--status-alarm);
  border: var(--border-w) solid rgba(255, 92, 92, 0.55);
  border-radius: 1px;
}
.fail-tag {
  flex: none;
  padding: 0 4px;
  font-weight: 500;
  font-size: 10px;
  color: var(--well-deep);
  background: var(--status-alarm);
  border-radius: 1px;
}
.log-l2 {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-dim);
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.log-l2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-ip {
  flex: none;
  margin-left: auto;
  font-size: 11px;
  color: var(--status-offline);
}

/* ===== 外部接口 ===== */
.apis {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
}
.api-row {
  flex: 1;
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  background: rgba(12, 35, 64, 0.4);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  font-size: 13px;
}
.api-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-ok { background: var(--spring-green); box-shadow: 0 0 6px rgba(0, 255, 224, 0.55); }
.dot-bad {
  background: var(--status-alarm);
  box-shadow: 0 0 6px rgba(255, 92, 92, 0.55);
  animation: dot-blink 1.2s infinite;
}
.dot-na { background: var(--status-offline); }
@keyframes dot-blink {
  50% { opacity: 0.25; }
}
.api-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.api-st { flex: none; font-size: 12px; }
.stc-ok { color: var(--spring-green); }
.stc-bad { color: var(--status-alarm); }
.stc-na { color: var(--status-offline); }
.api-sync { flex: none; font-size: 12px; }

@media (prefers-reduced-motion: reduce) {
  .dot-bad { animation: none; }
}
</style>
