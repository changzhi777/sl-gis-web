<!--
  AlarmTable.vue — 告警等级表（SCADA 右列上）
  · 按级别分组：重大（红）/ 较大（金）/ 一般（蓝），未签收优先展示
  · 支持签收操作：点击「签收」→ 本地状态置为已签收（1 期 mock，不回写 mockData）
  · 顶部级别计数条 + 未签收计数
-->
<template>
  <div class="at">
    <div class="counts">
      <span v-for="lv in LEVELS" :key="lv" class="c">
        <i class="d" :class="`d-${lv}`" aria-hidden="true"></i>{{ lv }}
        <b class="num">{{ countOf(lv) }}</b>
      </span>
      <span class="c c-unsigned">
        未签收 <b class="num">{{ unsignedCount }}</b>
      </span>
    </div>

    <div class="tbl" role="list" aria-label="告警列表">
      <template v-for="g in groups" :key="g.level">
        <div class="ghead" :class="`gh-${g.level}`" role="listitem">
          <span>{{ g.level }}告警</span>
          <b class="num">{{ g.items.length }}</b>
        </div>
        <div
          v-for="a in g.items"
          :key="a.id"
          class="arow"
          :class="`tone-${g.level}`"
          role="listitem"
        >
          <div class="l1">
            <span class="lv" :class="`lv-${a.level}`">{{ a.level }}</span>
            <span class="t num">{{ hhmm(a.time) }}</span>
            <span class="loc num">{{ projShort(a.projectId) }}</span>
            <span class="su">{{ a.suMu }}</span>
            <span class="sp"></span>
            <button
              v-if="a.status === '未签收'"
              class="sign"
              type="button"
              :aria-label="`签收 ${a.level}告警：${a.location}`"
              @click="sign(a)"
            >签收</button>
            <span v-else class="signed" :title="a.description">
              已签收 · {{ a.receivedBy ?? '值班员' }}
            </span>
          </div>
          <div class="l2" :title="a.description">{{ a.description }}</div>
        </div>
      </template>
      <div v-if="groups.every((g) => g.items.length === 0)" class="none">当前无告警</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { apiWrite } from '@/composables/realtime';
import type { EmergencyEvent } from '@shared/types';

const props = defineProps<{
  alerts: EmergencyEvent[];
}>();

/** 签收后向父级同步未签收数（顶栏告警灯 / Panel 标题联动） */
const emit = defineEmits<{
  (e: 'unsigned-change', n: number): void;
}>();

const LEVELS = ['重大', '较大', '一般'] as const;
type Level = EmergencyEvent['level'];

/** 已签收本地状态（不回写 mockData） */
const signedIds = ref<Set<string>>(new Set());

interface Row extends EmergencyEvent {
  /* 展开 map 后保持原字段即可 */
}

const rows = computed<Row[]>(() =>
  props.alerts.map((a) =>
    signedIds.value.has(a.id)
      ? { ...a, status: '已签收' as const, receivedBy: a.receivedBy ?? '值班员' }
      : a,
  ),
);

const groups = computed(() =>
  LEVELS.map((lv) => ({
    level: lv,
    items: rows.value.filter((a) => a.level === (lv as Level) && a.status !== '已销号'),
  })),
);

function countOf(lv: string): number {
  return rows.value.filter((a) => a.level === (lv as Level)).length;
}
const unsignedCount = computed(() => rows.value.filter((a) => a.status === '未签收').length);

watch(unsignedCount, (n) => emit('unsigned-change', n), { immediate: true });

/** 签收：BX- 报修工单走真实状态流转（待受理→处理中），普通告警保持本地签收 */
async function sign(a: EmergencyEvent) {
  if (a.id.startsWith('BX-')) {
    const done = await apiWrite('PUT', `/api/repairs/${a.id}/status`, { status: '处理中' });
    if (!done) {
      alert('工单流转失败，请重试');
      return;
    }
  }
  const next = new Set(signedIds.value);
  next.add(a.id);
  signedIds.value = next;
}

const p2 = (n: number) => String(n).padStart(2, '0');
function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** PRJ-A-01 → A-01 */
function projShort(id?: string): string {
  return id ? id.replace('PRJ-', '') : '--';
}
</script>

<style scoped>
.at {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 级别计数条 */
.counts {
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: var(--text-dim);
  padding-bottom: 8px;
  border-bottom: var(--border-w) solid var(--line-vein);
}
.c {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.c b {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}
.d {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.d-重大 { background: var(--status-alarm); }
.d-较大 { background: var(--steppe-amber); }
.d-一般 { background: var(--flood-teal); }
.c-unsigned {
  margin-left: auto;
  color: #ff9e9e;
}
.c-unsigned b { color: var(--status-alarm); }

/* 滚动列表 */
.tbl {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
}
.tbl::-webkit-scrollbar { width: 4px; }
.tbl::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.25); border-radius: 2px; }

.ghead {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 2px;
}
.ghead b {
  font-size: 12px;
  color: var(--text);
}
.ghead::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line-vein);
}
.gh-重大 span { color: var(--status-alarm); }
.gh-较大 span { color: var(--steppe-amber); }
.gh-一般 span { color: var(--flood-teal); }

/* 告警行 */
.arow {
  flex: none;
  background: rgba(12, 35, 64, 0.5);
  border-left: 3px solid var(--flood-teal);
  border-radius: 1px;
  padding: 7px 10px;
}
.tone-重大 { border-left-color: var(--status-alarm); }
.tone-较大 { border-left-color: var(--steppe-amber); }
.tone-一般 { border-left-color: var(--flood-teal); }

.l1 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.lv {
  flex: none;
  font-size: 12px;
  padding: 1px 6px;
  border: 1px solid;
  border-radius: 1px;
  line-height: 1.3;
}
.lv-重大 { color: var(--status-alarm); border-color: var(--status-alarm); }
.lv-较大 { color: var(--steppe-amber); border-color: var(--steppe-amber); }
.lv-一般 { color: var(--flood-teal); border-color: var(--flood-teal); }

.t {
  flex: none;
  color: var(--text-dim);
  font-size: 12px;
}
.loc {
  flex: none;
  color: var(--text);
  font-weight: 600;
  font-size: 13px;
}
.su {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-dim);
  font-size: 12px;
}
.sp { flex: 1; }

.sign {
  flex: none;
  font-size: 12px;
  color: var(--spring-green);
  background: rgba(0, 255, 224, 0.08);
  border: 1px solid rgba(0, 255, 224, 0.4);
  border-radius: 2px;
  padding: 2px 10px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.sign:hover {
  background: rgba(0, 255, 224, 0.18);
  border-color: rgba(0, 255, 224, 0.75);
}
.sign:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: 2px;
}
.signed {
  flex: none;
  font-size: 12px;
  color: var(--text-dim);
}

.l2 {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.none {
  padding: 24px 0;
  text-align: center;
  color: var(--text-dim);
  font-size: 13px;
}
</style>
