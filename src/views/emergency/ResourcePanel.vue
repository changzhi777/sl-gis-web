<!--
  ResourcePanel.vue — 应急资源面板
  · 4 类应急资源卡：综合抢险队 / 应急供水车 / 临时管材 / 备用泵机组
  · 卡片：类型徽标 + 名称驻点 + 可用/总量 + 出动数；点击 emit select（父级联动地图高亮）
  · 底部 StatusBars：出动构成一览（出动的行用 repair 金色）
-->
<template>
  <Panel title="应急资源" sub="4 类 · 点击定位">
    <div class="res-list">
      <div
        v-for="r in resources"
        :key="r.id"
        class="res-card"
        :class="{ active: r.id === highlightId }"
        role="button"
        tabindex="0"
        :aria-pressed="r.id === highlightId"
        @click="onCard(r)"
        @keydown.enter.prevent="onCard(r)"
      >
        <span class="badge" aria-hidden="true">{{ r.code }}</span>
        <div class="meta">
          <div class="name-row">
            <span class="name">{{ r.name }}</span>
            <span class="state" :class="stateTone(r)">{{ stateText(r) }}</span>
          </div>
          <div class="depot">{{ r.depotName }} · {{ r.person }}</div>
        </div>
        <div class="fig">
          <div class="num-line">
            <b class="num">{{ r.ready }}</b>
            <i class="num">/{{ r.total }}{{ r.unit }}</i>
          </div>
          <span class="disp num">出动 {{ r.dispatched }}</span>
        </div>
      </div>
    </div>

    <div class="bars-head">出动构成</div>
    <StatusBars :items="bars" />
  </Panel>
</template>

<script lang="ts">
/** 应急资源（驻点为真实苏木乡镇坐标，见 @shared/sumu-anchors） */
export interface EmergencyResource {
  id: string;
  /** 卡片徽标单字 */
  code: string;
  name: string;
  unit: string;
  total: number;
  /** 待命可用 */
  ready: number;
  /** 已出动 */
  dispatched: number;
  /** 驻点 [lon, lat] */
  depot: [number, number];
  depotName: string;
  person: string;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import Panel from '@ui/Panel.vue';
import StatusBars from '@charts/StatusBars.vue';

const props = withDefaults(
  defineProps<{
    resources: EmergencyResource[];
    highlightId?: string | null;
  }>(),
  { highlightId: null },
);

const emit = defineEmits<{
  (e: 'select', r: EmergencyResource): void;
}>();

function onCard(r: EmergencyResource): void {
  emit('select', r);
}

/** 状态文案与色 */
function stateTone(r: EmergencyResource): string {
  if (r.ready === 0) return 'is-out';
  if (r.dispatched > 0) return 'is-busy';
  return 'is-idle';
}
function stateText(r: EmergencyResource): string {
  if (r.ready === 0) return '全部出动';
  if (r.dispatched > 0) return '部分出动';
  return '满员待命';
}

/** 出动构成条（StatusBars：label ≤ 2 字适配 36px 定宽） */
const SHORT: Record<string, string> = {
  'R-TEAM': '队伍',
  'R-TRUCK': '水车',
  'R-PIPE': '管材',
  'R-PUMP': '水泵',
};
const bars = computed(() =>
  props.resources.map((r) => ({
    label: SHORT[r.id] ?? r.name.slice(0, 2),
    value: r.dispatched,
    status: r.dispatched > 0 ? 'repair' : 'normal',
  })),
);
</script>

<style scoped>
.res-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.res-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(12, 35, 64, 0.45);
  border: var(--border-w) solid var(--line-vein);
  border-left: 3px solid rgba(0, 255, 224, 0.35);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease;
}
.res-card:hover {
  background: rgba(0, 194, 255, 0.08);
}
.res-card:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: 2px;
}
.res-card.active {
  background: rgba(0, 255, 224, 0.1);
  border-color: rgba(0, 255, 224, 0.55);
  border-left-color: var(--spring-green);
}

.badge {
  flex: none;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--spring-green);
  background: rgba(0, 255, 224, 0.08);
  border: var(--border-w) solid rgba(0, 255, 224, 0.4);
  border-radius: var(--radius);
}

.meta {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}
.state {
  font-size: 11px;
  line-height: 1.4;
  padding: 0 5px;
  border: var(--border-w) solid;
  border-radius: var(--radius);
}
.state.is-idle { color: var(--spring-green); border-color: rgba(0, 255, 224, 0.5); }
.state.is-busy { color: var(--steppe-amber); border-color: rgba(255, 180, 84, 0.55); }
.state.is-out { color: var(--status-alarm); border-color: rgba(255, 92, 92, 0.55); }

.depot {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fig {
  flex: none;
  text-align: right;
}
.num-line {
  line-height: 1.1;
}
.num-line b {
  font-size: 20px;
  font-weight: 700;
  color: var(--spring-green);
}
.num-line i {
  font-style: normal;
  font-size: 12px;
  color: var(--text-dim);
}
.disp {
  display: block;
  font-size: 11px;
  color: var(--steppe-amber);
  margin-top: 1px;
}

.bars-head {
  font-size: 12px;
  color: var(--text-dim);
  margin: 2px 0 4px;
  padding-left: 2px;
}
</style>
