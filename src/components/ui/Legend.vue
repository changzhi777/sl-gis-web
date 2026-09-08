<!--
  Legend.vue — 地图图例浮层（左下）
  视觉标准：preview.html `.legend` + design-system §2.4 / §6.4
  · A-D 四行形状双编码（hex / square / circle / triangle）+ 计数，点击切显隐
  · 5 状态双编码（颜色 + 形状：实心 / 实心 / 实心 / 空心 / 空心虚线）
-->
<template>
  <div class="legend" role="group" aria-label="图例">
    <div
      v-for="g in grades"
      :key="g.grade"
      class="row"
      :class="{ off: hiddenGrades.has(g.grade) }"
      role="button"
      tabindex="0"
      :aria-pressed="!hiddenGrades.has(g.grade)"
      @click="toggleGrade(g.grade)"
      @keydown.enter.prevent="toggleGrade(g.grade)"
      @keydown.space.prevent="toggleGrade(g.grade)"
    >
      <span class="shape">
        <span :class="['sh', `sh-${GRADE_SHAPE[g.grade]}`]"></span>
      </span>
      <span class="nm">{{ g.label }} {{ g.grade }}</span>
      <span class="cnt num">{{ g.count.toLocaleString('en-US') }}</span>
    </div>

    <div class="states">
      <span
        v-for="s in states"
        :key="s.status"
        class="st"
        :class="{ off: hiddenStatus.has(s.status) }"
        role="button"
        tabindex="0"
        :aria-pressed="!hiddenStatus.has(s.status)"
        @click="toggleStatus(s.status)"
        @keydown.enter.prevent="toggleStatus(s.status)"
        @keydown.space.prevent="toggleStatus(s.status)"
      >
        <i class="dot" :class="`dot-${s.status}`"></i>{{ s.label
        }}<b v-if="s.count !== undefined" class="num sc">{{ s.count }}</b>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { GRADE_SHAPE } from '@shared/types';
import type { Grade, Status } from '@shared/types';

/** 展示文案（非类型定义，只做中文标签映射） */
const GRADE_LABEL: Record<Grade, string> = {
  A: '重点集中供水',
  B: '联村工程',
  C: '单村工程',
  D: '分散供水点',
};
const STATUS_LABEL: Record<Status, string> = {
  normal: '正常',
  alarm: '异常',
  repair: '检修',
  stop: '停运',
  offline: '离线',
};
const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D'];
const STATUS_ORDER: Status[] = ['normal', 'alarm', 'repair', 'stop', 'offline'];

const props = withDefaults(
  defineProps<{
    /** A-D 工程计数 */
    projects?: Partial<Record<Grade, number>>;
    /** 5 状态计数（可选，缺省只显示名称） */
    alarms?: Partial<Record<Status, number>>;
  }>(),
  {
    projects: () => ({ A: 12, B: 8, C: 26, D: 1842 }),
    alarms: () => ({}),
  },
);

const emit = defineEmits<{
  (e: 'toggle-grade', grade: Grade, visible: boolean): void;
  (e: 'toggle-status', status: Status, visible: boolean): void;
}>();

const hiddenGrades = ref<Set<Grade>>(new Set());
const hiddenStatus = ref<Set<Status>>(new Set());

const grades = computed(() =>
  GRADE_ORDER.map((grade) => ({
    grade,
    label: GRADE_LABEL[grade],
    count: props.projects[grade] ?? 0,
  })),
);

const states = computed(() =>
  STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    count: props.alarms[status],
  })),
);

function toggleGrade(grade: Grade) {
  const next = new Set(hiddenGrades.value);
  if (next.has(grade)) next.delete(grade);
  else next.add(grade);
  hiddenGrades.value = next;
  emit('toggle-grade', grade, !next.has(grade));
}

function toggleStatus(status: Status) {
  const next = new Set(hiddenStatus.value);
  if (next.has(status)) next.delete(status);
  else next.add(status);
  hiddenStatus.value = next;
  emit('toggle-status', status, !next.has(status));
}
</script>

<style scoped>
.legend {
  background: rgba(3, 8, 18, 0.85);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  padding: 12px 16px;
  backdrop-filter: blur(4px);
  min-width: 196px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding: 3px 0;
  cursor: pointer;
  transition: color 0.15s ease, opacity 0.15s ease;
}
.row:hover,
.row:hover .cnt {
  color: var(--spring-green);
}
.row.off {
  opacity: 0.4;
}
.row.off .sh {
  background: var(--status-offline);
  border-color: var(--status-offline);
}
.row.off .sh-triangle {
  border-bottom-color: var(--status-offline);
}
.nm { white-space: nowrap; }
.cnt {
  margin-left: auto;
  color: var(--text-dim);
}

/* A-D 形状（§2.4 形状编码，不依赖颜色） */
.shape {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.sh-hex {
  width: 12px;
  height: 12px;
  background: var(--grade-a);
  clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
}
.sh-square {
  width: 10px;
  height: 10px;
  background: var(--grade-b);
}
.sh-circle {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--grade-c);
}
.sh-triangle {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 10px solid var(--grade-d);
}

/* 5 状态双编码 */
.states {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--line-vein);
  font-size: 12px;
  color: var(--text-dim);
}
.st {
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, opacity 0.15s ease;
}
.st:hover { color: var(--spring-green); }
.st.off { opacity: 0.4; text-decoration: line-through; }
.sc { margin-left: 4px; color: var(--text); }
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
  vertical-align: -1px;
}
.dot-normal { background: var(--status-normal); }
.dot-alarm { background: var(--status-alarm); }
.dot-repair { background: var(--status-repair); }
/* 停运 = 空心实线 · 离线 = 空心虚线（色弱可辨） */
.dot-stop { background: transparent; border: 1.5px solid var(--status-stop); }
.dot-offline { background: transparent; border: 1.5px dashed var(--status-stop); }

.row:focus-visible,
.st:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: 2px;
}
</style>
