<!--
  EventTimeline.vue — 应急事件处置垂直时间线
  节点：事件上报 → 警情研判 → 工单派发 → 现场签到 → 抢险处置 → 处置复核 → 销号归档
  · 节点状态由事件 status 推导：未签收(1)/已派单(3)/已签收(4)/已销号(7) 个节点完成
  · 已完成节点显示时间 + 操作人（确定性：事件 id hash 选取，不随机）
  · 进行中节点琥珀色脉冲；待执行节点空心灰
-->
<template>
  <div class="evt-timeline">
    <template v-if="event">
      <ol class="tl">
        <li
          v-for="s in steps"
          :key="s.name"
          class="tl-item"
          :class="`is-${s.state}`"
        >
          <span class="node" aria-hidden="true"></span>
          <div class="body">
            <div class="r1">
              <span class="nm">{{ s.name }}</span>
              <span class="tm num">{{ s.time }}</span>
            </div>
            <div class="r2">{{ s.actor }}</div>
          </div>
        </li>
      </ol>
    </template>
    <div v-else class="empty">
      点击地图或告警事件<br />
      查看「上报 → 研判 → 派单 → 签到 → 处置 → 复核 → 销号」全流程
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EmergencyEvent } from '@shared/types';

const props = defineProps<{
  event: EmergencyEvent | null;
}>();

/** 各状态对应的已完成节点数（§巡检工单闭环流程） */
const COMPLETED_BY_STATUS: Record<EmergencyEvent['status'], number> = {
  未签收: 1,
  已派单: 3,
  已签收: 4,
  已销号: 7,
};

/** 节点定义：名称 + 相对上报时刻的分钟增量（mock 确定性） */
const STEP_DEFS: ReadonlyArray<{ name: string; delta: number }> = [
  { name: '事件上报', delta: 0 },
  { name: '警情研判', delta: 8 },
  { name: '工单派发', delta: 15 },
  { name: '现场签到', delta: 35 },
  { name: '抢险处置', delta: 55 },
  { name: '处置复核', delta: 130 },
  { name: '销号归档', delta: 185 },
];

/** 操作人池（与 mock/factories/alerts 同一人物体系） */
const DUTY = ['朝鲁', '那日苏'];
const DISPATCHERS = ['巴特尔', '斯日娜'];
const FIELD = ['乌云娜', '宝力德', '希吉尔'];
const REVIEWERS = ['安全员·其木格', '站长·额尔登'];

/** 事件 id 确定性 hash → 选取操作人（同事件恒定，不同事件分散） */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
function pick(pool: string[], key: string): string {
  return pool[hashId(key) % pool.length];
}

const p2 = (n: number) => String(n).padStart(2, '0');
function fmtHM(ms: number): string {
  const d = new Date(ms);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

interface StepView {
  name: string;
  state: 'done' | 'active' | 'pending';
  time: string;
  actor: string;
}

const steps = computed<StepView[]>(() => {
  const ev = props.event;
  if (!ev) return [];
  const done = COMPLETED_BY_STATUS[ev.status];
  const base = new Date(ev.time).getTime();
  const now = Date.now();

  return STEP_DEFS.map((d, i): StepView => {
    const state: StepView['state'] =
      i < done ? 'done' : i === done ? 'active' : 'pending';

    let time = '';
    let actor = '';
    if (state === 'done') {
      time = fmtHM(Math.min(base + d.delta * 60_000, now));
      switch (i) {
        case 0:
          actor = '平台自动受理';
          break;
        case 1:
          actor = `值班长 · ${pick(DUTY, ev.id)}`;
          break;
        case 2:
          actor = `调度员 · ${pick(DISPATCHERS, ev.id)}`;
          break;
        case 3:
          actor = `运维 · ${ev.receivedBy ?? pick(FIELD, ev.id)}`;
          break;
        case 4:
          actor = `抢修队 · ${pick(FIELD, `${ev.id}F`)}`;
          break;
        case 5:
          actor = pick(REVIEWERS, ev.id);
          break;
        default:
          actor = `值班长 · ${pick(DUTY, `${ev.id}R`)}`;
      }
    } else if (state === 'active') {
      actor =
        i === 1
          ? '警情研判中…'
          : i === 3
            ? `待 ${ev.receivedBy ?? '运维人员'} 签到`
            : '执行中…';
    } else {
      actor = '待执行';
    }
    return { name: d.name, state, time, actor };
  });
});
</script>

<style scoped>
.evt-timeline {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.tl {
  list-style: none;
  margin: 0;
  padding: 2px 0 0 6px;
}

.tl-item {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 0 0 16px 18px;
}
/* 竖向连接线 */
.tl-item::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: -2px;
  width: 2px;
  background: rgba(0, 194, 255, 0.16);
}
.tl-item:last-child {
  padding-bottom: 2px;
}
.tl-item:last-child::before {
  display: none;
}

.node {
  position: absolute;
  left: 0;
  top: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--status-offline);
  background: var(--night-navy);
  box-sizing: border-box;
  flex: none;
}
.is-done .node {
  border-color: var(--spring-green);
  background: var(--spring-green);
  box-shadow: 0 0 6px rgba(0, 255, 224, 0.45);
}
.is-active .node {
  border-color: var(--steppe-amber);
  background: var(--steppe-amber);
  animation: node-pulse 1.2s ease-out infinite;
}
@keyframes node-pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 180, 84, 0.55); }
  100% { box-shadow: 0 0 0 8px rgba(255, 180, 84, 0); }
}

.body {
  flex: 1;
  min-width: 0;
  padding-top: 0;
}
.r1 {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.nm {
  font-size: 13px;
  color: var(--text-dim);
}
.tm {
  margin-left: auto;
  font-size: 12px;
  color: var(--text);
  font-weight: 600;
}
.r2 {
  font-size: 12px;
  color: var(--status-stop);
  margin-top: 1px;
}

.is-done .nm { color: var(--text); }
.is-done .r2 { color: var(--text-dim); }
.is-active .nm { color: var(--steppe-amber); }
.is-active .r2 { color: var(--steppe-amber); }

.empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1.9;
  opacity: 0.75;
}

@media (prefers-reduced-motion: reduce) {
  .is-active .node { animation: none; }
}
</style>
