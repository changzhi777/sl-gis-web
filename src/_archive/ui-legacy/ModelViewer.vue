<!--
  ModelViewer.vue — 工程 3D 详情浮窗
  视觉标准：docs/design/preview-3d.html `#viewer` + design-system §11.2 / §11.3
  · 全屏遮罩 blur(6px) + 中心 1460×800 弹窗（主角面板：四角角标 75%）
  · 左 1.9fr 3D 视口（1 期纯色占位块 + 「GLB 占位」；viewportHost 已 expose 给 Track A 挂载）
  · 右 1fr 参数栏：6 实时数据卡 + 3 泵组状态条 + 24h spark line + 查看档案
  · 从点击坐标生长（transform-origin）· ESC / 遮罩点击关闭（先动画后卸载）
-->
<template>
  <div
    v-if="visible"
    class="ov"
    :class="{ out: closing }"
    role="dialog"
    aria-modal="true"
    :aria-label="titleText"
    @click.self="requestClose"
  >
    <div class="win" :style="{ '--ox': originCss }">
      <i class="cn tl" aria-hidden="true"></i>
      <i class="cn tr" aria-hidden="true"></i>
      <i class="cn bl" aria-hidden="true"></i>
      <i class="cn br" aria-hidden="true"></i>

      <div class="vhead">
        <div class="t">{{ titleText }}</div>
        <span class="lv">{{ gradeText }}</span>
        <span class="st" :style="{ color: statusColor }">● {{ statusText }}</span>
        <button ref="closeBtn" class="x" type="button" @click="requestClose">ESC 关闭</button>
      </div>

      <div class="vbody">
        <!-- 3D 视口 -->
        <div class="v3d">
          <div class="grid-floor" aria-hidden="true"></div>
          <div ref="viewportHost" class="vp">
            <div class="glb-ph">
              <span class="ph-tag">GLB 占位</span>
              <span class="ph-sub num">{{ glbUrl || 'models/pump-station.glb' }}</span>
            </div>
          </div>

          <div class="hud">
            工程编码 <b class="num">{{ code }}</b><br />
            接入设备 <b class="num">{{ deviceCount }}</b> 台<br />
            数据更新 <b class="num">{{ updatedAgo }}</b> 前
          </div>

          <div class="tools" role="group" aria-label="视图工具">
            <button
              v-for="t in TOOLS"
              :key="t"
              type="button"
              :class="{ on: tool === t }"
              :title="t"
              @click="pickTool(t)"
            >
              {{ t }}
            </button>
          </div>

          <div class="perf">性能 <b class="num">60</b>fps · <b class="num">52.4k</b> 面</div>
          <div class="foot">
            <span>拖拽旋转 · 滚轮缩放 · 右键平移</span>
            <span class="src">GLB · 1 期占位</span>
          </div>
        </div>

        <!-- 参数栏 -->
        <div class="vside">
          <div>
            <h4>实时参数</h4>
            <div class="kv">
              <div v-for="m in metricCards" :key="m.label" class="i">
                <div class="l">{{ m.label }}</div>
                <div class="v num">{{ m.value }}<small> {{ m.unit }}</small></div>
              </div>
            </div>
          </div>

          <div class="pumps">
            <h4>泵组状态</h4>
            <div v-for="p in pumps" :key="p.name" class="row">
              <span class="nm">{{ p.name }}</span>
              <div class="bar">
                <i :style="{ width: (p.standby ? 0 : p.ratio * 100) + '%', background: p.standby ? 'var(--status-stop)' : 'var(--spring-green)' }"></i>
              </div>
              <span class="v num" :style="{ color: p.standby ? 'var(--status-stop)' : 'var(--text)' }">
                {{ p.standby ? '备用' : `${p.freq?.toFixed(1)} Hz` }}
              </span>
            </div>
          </div>

          <div>
            <h4>24h 压力曲线</h4>
            <SparkLine
              :data="history"
              :threshold="0.15"
              :height="84"
              unit=" MPa"
              color="var(--flood-teal)"
            />
            <div class="axis num"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
          </div>

          <button class="more" type="button" @click="emit('archive')">
            查看工程档案 · 工单记录 →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import type { Project, Status } from '@shared/types';
import { STATUS_COLOR } from '@shared/types';
import SparkLine from '@charts/SparkLine.vue';

interface PumpRow {
  name: string;
  /** 0-1 负荷比 */
  ratio: number;
  /** 运行频率 Hz */
  freq?: number;
  standby?: boolean;
}

const TOOLS = ['环视', '剖切', '复位', '线框'] as const;
type Tool = (typeof TOOLS)[number];

const STATUS_LABEL: Record<Status, string> = {
  normal: '运行正常',
  alarm: '告警中',
  repair: '检修中',
  stop: '已停运',
  offline: '离线',
};
const GRADE_LABEL: Record<Project['grade'], string> = {
  A: '重点集中供水',
  B: '联村工程',
  C: '单村工程',
  D: '分散供水点',
};

const props = withDefaults(
  defineProps<{
    open: boolean;
    project?: Project | null;
    glbUrl?: string;
    /** 点击坐标 → 窗口生长原点（§11.3） */
    origin?: { x: number; y: number } | null;
    pumps?: PumpRow[];
    /** 24h 压力序列 */
    history?: number[];
    code?: string;
    deviceCount?: number;
    updatedAgo?: string;
  }>(),
  {
    project: null,
    glbUrl: '',
    origin: null,
    pumps: () => [
      { name: '1# 泵', ratio: 0.72, freq: 18.4 },
      { name: '2# 泵', ratio: 0, standby: true },
      { name: '3# 泵', ratio: 0.48, freq: 12.1 },
    ],
    history: () => [
      0.28, 0.29, 0.27, 0.31, 0.3, 0.33, 0.32, 0.35, 0.33, 0.36, 0.34, 0.33, 0.35, 0.34, 0.32,
      0.33, 0.31, 0.32, 0.3, 0.31,
    ],
    code: '150724-B03',
    deviceCount: 14,
    updatedAgo: '12s',
  },
);

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'close'): void;
  (e: 'archive'): void;
  (e: 'tool', v: string): void;
}>();

const visible = ref(props.open);
const closing = ref(false);
const tool = ref<Tool>('环视');
const closeBtn = ref<HTMLButtonElement | null>(null);
const viewportHost = ref<HTMLDivElement | null>(null);
let closeTimer: ReturnType<typeof setTimeout> | undefined;

const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const titleText = computed(() => props.project?.name ?? '朱日和镇 · B-03 水源井站');
const gradeText = computed(() => {
  const g = props.project?.grade ?? 'B';
  return `${g} 级 · ${GRADE_LABEL[g]}`;
});
const statusText = computed(() => STATUS_LABEL[props.project?.status ?? 'normal']);
const statusColor = computed(() => STATUS_COLOR[props.project?.status ?? 'normal']);
const originCss = computed(() =>
  props.origin ? `${props.origin.x}px ${props.origin.y}px` : '50% 42%',
);

/** 6 实时数据卡 —— 缺值回落到设计稿基准 */
const metricCards = computed(() => {
  const m = props.project?.metrics ?? {};
  const n = (v: number | undefined, fb: number, d: number) => (v ?? fb).toFixed(d);
  return [
    { label: '出口压力', value: n(m.pressure, 0.32, 2), unit: 'MPa' },
    { label: '瞬时流量', value: n(m.flow, 46.2, 1), unit: 'm³/h' },
    { label: '井水位', value: n(m.level, 12.8, 1), unit: 'm' },
    {
      label: '今日取水',
      value: Math.round((m.flow ?? 46.2) * 23).toLocaleString('en-US'),
      unit: 'm³',
    },
    { label: '浊度', value: n(m.turbidity, 0.6, 1), unit: 'NTU' },
    { label: '余氯', value: n(m.chlorine, 0.42, 2), unit: 'mg/L' },
  ];
});

function pickTool(t: Tool) {
  tool.value = t;
  emit('tool', t);
}

function requestClose() {
  if (closing.value) return;
  if (reduced) {
    finishClose();
    return;
  }
  closing.value = true;
  closeTimer = setTimeout(finishClose, 200);
}

function finishClose() {
  closing.value = false;
  visible.value = false;
  emit('update:open', false);
  emit('close');
}

function onKey(ev: KeyboardEvent) {
  if (ev.key === 'Escape' && visible.value && !closing.value) {
    ev.stopPropagation();
    requestClose();
  }
}

watch(
  () => props.open,
  async (v) => {
    if (v) {
      if (closeTimer) clearTimeout(closeTimer);
      closing.value = false;
      visible.value = true;
      await nextTick();
      closeBtn.value?.focus();
    } else if (visible.value && !closing.value) {
      requestClose();
    }
  },
);

onMounted(() => {
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  if (closeTimer) clearTimeout(closeTimer);
});

defineExpose({ viewportHost });
</script>

<style scoped>
/* ===== 遮罩 ===== */
.ov {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(3, 8, 18, 0.82);
  backdrop-filter: blur(6px);
  animation: ovin 0.18s ease both;
}
.ov.out { animation: ovout 0.2s ease forwards; }
@keyframes ovin { from { opacity: 0; } to { opacity: 1; } }
@keyframes ovout { to { opacity: 0; } }

/* ===== 弹窗（主角面板：角标 75%）===== */
.win {
  position: relative;
  width: 1460px;
  height: 800px;
  display: flex;
  flex-direction: column;
  background: var(--night-navy);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  transform-origin: var(--ox, 50% 42%);
  animation: winin 0.45s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.ov.out .win { animation: winout 0.2s ease-in forwards; }
@keyframes winin { from { transform: translateY(26px) scale(0.97); opacity: 0; } }
@keyframes winout { to { transform: translateY(14px) scale(0.98); opacity: 0; } }

.cn {
  position: absolute;
  width: 12px;
  height: 12px;
  border: var(--border-w-thick) solid rgba(0, 194, 255, 0.75);
  pointer-events: none;
  z-index: 2;
}
.tl { top: -2px; left: -2px; border-right: none; border-bottom: none; }
.tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
.bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
.br { bottom: -2px; right: -2px; border-left: none; border-top: none; }

/* ===== 顶栏 ===== */
.vhead {
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: 14px 20px;
  border-bottom: var(--border-w) solid var(--line-vein);
  flex: none;
}
.vhead .t {
  font-size: 18px;
  font-weight: 600;
}
.vhead .t::after {
  content: '';
  display: block;
  width: 24px;
  height: var(--border-w-thick);
  background: var(--flood-teal);
  margin-top: 5px;
}
.vhead .lv {
  font-size: 11px;
  color: var(--steppe-amber);
  border: var(--border-w) solid rgba(255, 180, 84, 0.5);
  padding: 1px 6px;
  border-radius: var(--radius);
}
.vhead .st { font-size: 12px; }
.vhead .x {
  margin-left: auto;
  cursor: pointer;
  color: var(--text-dim);
  font-size: 14px;
  border: var(--border-w) solid var(--line-vein);
  background: none;
  padding: 2px 10px;
  border-radius: var(--radius);
}
.vhead .x:hover {
  color: var(--status-alarm);
  border-color: rgba(255, 92, 92, 0.5);
}

.vbody {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* ===== 3D 视口 ===== */
.v3d {
  flex: 1.9;
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse 65% 55% at 50% 42%, #10305a 0%, #0a1d38 45%, #050d1b 100%);
}
.grid-floor {
  position: absolute;
  left: 50%;
  bottom: 2%;
  width: 1800px;
  height: 500px;
  transform: translateX(-50%) rotateX(66deg);
  transform-origin: center bottom;
  opacity: 0.8;
  background:
    repeating-linear-gradient(0deg, rgba(0, 194, 255, 0.1) 0 1px, transparent 1px 80px),
    repeating-linear-gradient(90deg, rgba(0, 194, 255, 0.1) 0 1px, transparent 1px 80px);
  mask-image: radial-gradient(ellipse 70% 60% at 50% 55%, #000 30%, transparent 75%);
  pointer-events: none;
}
.vp {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.glb-ph {
  width: 380px;
  height: 250px;
  background: var(--surface-blue);
  border: 1px dashed rgba(0, 194, 255, 0.55);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.ph-tag {
  font-size: 16px;
  font-weight: 600;
  color: var(--flood-teal);
  letter-spacing: 2px;
}
.ph-sub { font-size: 12px; color: var(--text-dim); }

.hud {
  position: absolute;
  left: 16px;
  top: 14px;
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.9;
}
.hud b { color: var(--spring-green); font-size: 13px; font-weight: 600; }

.tools {
  position: absolute;
  right: 14px;
  top: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tools button {
  background: rgba(7, 21, 37, 0.85);
  border: var(--border-w) solid var(--line-vein);
  color: var(--text-dim);
  font-size: 12px;
  font-family: var(--cn);
  padding: 6px 14px;
  border-radius: var(--radius);
  cursor: pointer;
  writing-mode: vertical-rl;
  letter-spacing: 2px;
}
.tools button:hover,
.tools button.on {
  color: var(--spring-green);
  border-color: rgba(0, 255, 224, 0.4);
}

.perf {
  position: absolute;
  right: 60px;
  bottom: 14px;
  font-size: 11px;
  color: var(--text-dim);
  background: rgba(3, 8, 18, 0.7);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  padding: 2px 8px;
}
.perf b { color: var(--spring-green); font-weight: 600; }

.foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 30px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: linear-gradient(0deg, rgba(3, 8, 18, 0.85), transparent);
  font-size: 12px;
  color: var(--text-dim);
}
.foot .src { margin-left: auto; color: var(--spring-green); }

/* ===== 参数栏 ===== */
.vside {
  flex: 1;
  border-left: var(--border-w) solid var(--line-vein);
  padding: 16px 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.vside h4 {
  font-size: 13px;
  color: var(--text-dim);
  font-weight: 500;
  letter-spacing: 1px;
  margin: 0 0 8px;
}
.kv {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 14px;
}
.kv .i {
  background: rgba(12, 35, 64, 0.5);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  padding: 7px 10px;
}
.kv .i .l { font-size: 11px; color: var(--text-dim); }
/* 实时数值统一 spring-green（§11.2 跨态同色闭环） */
.kv .i .v { font-weight: 600; font-size: 20px; color: var(--spring-green); }
.kv .i .v small { font-size: 11px; color: var(--text-dim); font-family: var(--cn); }

.pumps .row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  padding: 5px 0;
  border-bottom: 1px dashed rgba(0, 194, 255, 0.12);
}
.pumps .row:hover .bar i { background: var(--flood-teal) !important; }
.pumps .nm { width: 52px; flex: none; }
.pumps .bar {
  flex: 1;
  height: 8px;
  background: var(--surface-blue);
  border-radius: 1px;
  overflow: hidden;
}
.pumps .bar i { display: block; height: 100%; transition: width 0.3s ease; }
.pumps .v { font-weight: 600; font-size: 14px; width: 70px; text-align: right; flex: none; }

.axis {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-dim);
  padding: 0 2px;
}

.more {
  margin-top: auto;
  font-size: 12px;
  color: var(--flood-teal);
  cursor: pointer;
  text-align: center;
  border: 1px dashed rgba(0, 194, 255, 0.35);
  padding: 7px;
  border-radius: var(--radius);
  background: none;
  font-family: var(--cn);
}
.more:hover { background: rgba(0, 194, 255, 0.08); }

button:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .ov, .win { animation: none !important; }
}
</style>
