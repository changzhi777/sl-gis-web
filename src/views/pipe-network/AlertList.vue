<!--
  AlertList.vue — 右列上半：实时告警滚动
  视觉标准：preview.html `.alerts` + design-system §6.3
  · Panel variant=alarm（顶部 2px alarm-red 状态条）+ 主角面板角标 75%
  · 6 条 CSS 无缝滚动（scroll 18s linear infinite，列表复制两份 translateY(-50%)）
  · hover / focus-within 暂停；条目 flex：时间定宽 42px + 名称 flex:1 省略 + 等级徽标 flex:none
-->
<template>
  <Panel
    class="alerts"
    variant="alarm"
    hero
    title="实时告警"
    :sub="`${unsigned} 未签收`"
  >
    <div class="viewport">
      <div class="alist" role="list">
        <div
          v-for="(a, i) in doubled"
          :key="`${a.id}-${i}`"
          class="aitem"
          :class="`tone-${tone(a)}`"
          role="listitem"
          tabindex="0"
          @click="emit('select', a)"
          @keydown.enter.prevent="emit('select', a)"
        >
          <div class="head">
            <span class="t num">{{ hhmm(a.time) }}</span>
            <span class="name">{{ a.suMu }} · {{ a.location }}</span>
            <span class="lvl" :class="`lvl-${a.level}`">{{ a.level }}</span>
          </div>
          <div class="loc">{{ a.description }} · {{ a.status }}</div>
        </div>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EmergencyEvent } from '@shared/types';
import Panel from '@ui/Panel.vue';

/** 今日 HH:mm → ISO（避免硬编码日期过期） */
function at(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** 默认演示告警（顶层常量，避开 defineProps default factory 的"本地变量引用"限制） */
const DEFAULT_ALERTS: EmergencyEvent[] = [
  { id: 'EV-2401', time: at('23:41'), type: 'burst',     level: '重大', suMu: '赛罕乌力吉苏木', location: 'A-07 工程',     description: '压力骤降 · 疑似管网破损', status: '未签收' },
  { id: 'EV-2402', time: at('23:12'), type: 'equipment', level: '较大', suMu: '朱日和镇',       location: 'B-03 水源井',   description: '水泵电流过载',             status: '已派单' },
  { id: 'EV-2403', time: at('22:58'), type: 'equipment', level: '一般', suMu: '乌日根塔拉镇',   location: 'C-11 高位水池', description: '液位低于阈值',             status: '已签收' },
  { id: 'EV-2404', time: at('21:30'), type: 'equipment', level: '一般', suMu: '阿其图乌拉苏木', location: 'D-215 供水点',   description: '通信中断 · 离线 2.1h',    status: '已签收' },
  { id: 'EV-2405', time: at('20:47'), type: 'frost',     level: '重大', suMu: '赛罕乌力吉苏木', location: 'A-07 工程',     description: '管线冻堵风险 · 地温 -18℃', status: '未签收' },
  { id: 'EV-2406', time: at('20:12'), type: 'equipment', level: '较大', suMu: '朱日和镇',       location: 'B-03 水源井',   description: '水泵电流过载 · 二次报警', status: '已派单' },
];

const props = defineProps<{
  alerts?: EmergencyEvent[];
}>();

const emit = defineEmits<{
  (e: 'select', alert: EmergencyEvent): void;
}>();

/** 父级未传时回落默认演示数据 */
const list = computed(() => props.alerts ?? DEFAULT_ALERTS);

const unsigned = computed(() => list.value.filter((a) => a.status === '未签收').length);

/** 无缝滚动：复制两份，动画 translateY(-50%) */
const doubled = computed(() => [...list.value, ...list.value]);

const p2 = (n: number) => String(n).padStart(2, '0');
function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 5);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** 左侧色条：等级映射；通信中断类归为离线灰（状态语义唯一映射 §2.3） */
function tone(a: EmergencyEvent): string {
  if (/离线|中断/.test(a.description)) return 'offline';
  if (a.level === '重大') return 'major';
  if (a.level === '较大') return 'medium';
  return 'minor';
}
</script>

<style scoped>
.alerts {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
/* 上下渐隐（滚动出入淡出） */
.viewport::before,
.viewport::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 26px;
  pointer-events: none;
  z-index: 2;
}
.viewport::before {
  top: 0;
  background: linear-gradient(180deg, var(--night-navy), transparent);
}
.viewport::after {
  bottom: 0;
  height: 34px;
  background: linear-gradient(0deg, var(--night-navy) 30%, transparent);
}

.alist {
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: alist-scroll 18s linear infinite;
}
@keyframes alist-scroll {
  to { transform: translateY(-50%); }
}
.alerts:hover .alist,
.alerts:focus-within .alist {
  animation-play-state: paused;
}

.aitem {
  background: rgba(12, 35, 64, 0.5);
  border-left: 3px solid var(--status-alarm);
  border-radius: 1px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  flex: none;
}
.aitem:hover {
  background: rgba(0, 194, 255, 0.1);
  border-left-width: 4px;
  padding-left: 11px;
}
.aitem:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: 2px;
}
.tone-major { border-left-color: var(--status-alarm); }
.tone-medium { border-left-color: var(--steppe-amber); }
.tone-minor { border-left-color: var(--flood-teal); }
.tone-offline { border-left-color: var(--status-offline); }

.head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.t {
  flex: 0 0 42px;
  color: var(--text-dim);
  font-size: 13px;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lvl {
  flex: none;
  font-size: 12px;
  padding: 1px 6px;
  border: 1px solid;
  border-radius: 1px;
  line-height: 1.3;
}
.lvl-一般 { color: var(--flood-teal); border-color: var(--flood-teal); }
.lvl-较大 { color: var(--steppe-amber); border-color: var(--steppe-amber); }
.lvl-重大 { color: var(--status-alarm); border-color: var(--status-alarm); }

.loc {
  color: var(--text-dim);
  font-size: 13px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .alist { animation: none; }
}
</style>
