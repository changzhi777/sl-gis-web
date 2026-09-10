<!--
  MapCanvas.vue — SVG 事件地图组件（T2 轨道 · 「事件地图」技术栈升级版）
  图层（底→顶）：旗界双线 → 乡镇在线率 choropleth → 供水管线（沟/面双层 + 流向箭头）
    → 工程点（A-D 形状编码） → 监测点 → 告警脉冲 → 旗界扫光 → 标牌锚点探针
  · 入场编排 2.8s 纯 CSS delay（仅首挂载；reduced-motion 直达终态）
  · viewport 聚焦 transform 过渡 + focus()/reset() 暴露 + focus-end 事件
  · HTML 标牌层（恒定 13px）：引线画在独立像素坐标 SVG，牌位由「探针
    getBoundingClientRect」实测（rAF 循环仅在视角过渡期间运行）——
    兼容 viewBox letterbox / 祖先缩放（v-scale-screen），无需 CTM
  性能纪律：只动 transform/opacity/stroke-dashoffset；无滤镜；常态循环动画 = 扫光 1 + 脉冲 ≤ 告警数
-->
<template>
  <div ref="rootEl" class="mc-root" :class="{ 'intro-run': introActive }">
    <svg
      class="mc-svg"
      :viewBox="`0 0 ${MAP_W} ${mapH}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="供水管网事件地图"
    >
      <defs>
        <!-- 流向箭头（按线宽分档；refX=10 尖端贴流向终点） -->
        <marker
          v-for="m in arrowMarkers"
          :id="m.id"
          :key="m.id"
          viewBox="0 0 10 8"
          refX="10"
          refY="4"
          :markerWidth="m.w"
          :markerHeight="m.h"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path class="arrow-shape" d="M0 0L10 4L0 8Z" />
        </marker>
      </defs>

      <g class="viewport" :style="viewportStyle" @transitionend="onViewportTransitionEnd">
        <!-- a) 旗界：填充 + 外 1.6 / 内 0.8 双线（外线入场描边生长） -->
        <path v-for="(d, i) in bannerPaths" :key="`bf${i}`" class="banner-fill" :d="d" />
        <path v-for="(d, i) in bannerPaths" :key="`bi${i}`" class="banner-inner" :d="d" />
        <path ref="bannerOuterEl" class="banner-outer" :d="bannerMainPath" :style="bannerDrawStyle" />

        <!-- b) 乡镇 choropleth（监测点 PIP 聚合在线率 · 5 档） + 界线 + 质心名称 -->
        <template v-for="t in townView" :key="t.name">
          <path
            v-for="(d, j) in t.paths"
            :key="`${t.name}-f${j}`"
            class="town-fill"
            :class="t.tier >= 0 ? `tier-${t.tier}` : 'tier-none'"
            :d="d"
            :style="{ '--i': t.i }"
          />
          <path
            v-for="(d, j) in t.paths"
            :key="`${t.name}-l${j}`"
            class="town-line"
            :d="d"
            :style="{ '--i': t.i }"
          />
        </template>
        <text
          v-for="t in townView"
          :key="`${t.name}-t`"
          class="town-name"
          :x="t.centroid.x"
          :y="t.centroid.y"
          :style="{ '--i': t.i }"
        >{{ t.name }}</text>

        <!-- c) 供水管线：d 按起点→终点生成（方向 = 水流方向）；A 级工程管段终点 / DN≥200 中点静态箭头 -->
        <g v-for="p in pipeView" :key="p.id" class="pipe">
          <path
            class="pipe-trench"
            :d="p.d"
            :stroke-width="p.w + 2.4"
            :style="{ '--len': p.len, '--i': p.idx }"
          />
          <path
            class="pipe-face"
            :d="p.d"
            :stroke-width="p.w"
            :style="{ '--len': p.len, '--w': p.w, '--i': p.idx }"
            :marker-end="p.endArrow ? `url(#${p.markerId})` : undefined"
          />
          <!-- 选中工程关联管线：恒速流光（90 units/s · dash=周长/8 · dashoffset 负向=顺流向） -->
          <path
            v-if="p.active"
            class="pipe-flow"
            :d="p.d"
            :style="{ '--len': p.len, '--w': p.w }"
          />
          <path v-if="p.midArrow" class="pipe-arrow" :d="p.midD" :marker-end="`url(#${p.markerId})`" />
        </g>

        <!-- d) 工程点：A 六边形 / B 方形 / C 圆 / D 三角 · 状态色覆盖 · 点击上抛 -->
        <g
          v-for="(pj, i) in projectView"
          :key="pj.p.id"
          class="pj"
          :class="[`st-${pj.p.status}`, { sel: pj.p.id === selectedProjectId }]"
          :transform="`translate(${pj.x} ${pj.y})`"
          role="button"
          tabindex="0"
          :aria-label="`工程 ${pj.p.name}，${pj.p.grade} 级，状态 ${pj.p.status}`"
          @click.stop="emit('project-click', pj.p)"
          @keydown.enter.prevent="emit('project-click', pj.p)"
        >
          <g class="pj-in" :style="{ '--i': Math.min(i, 24) }">
            <circle class="pj-halo" r="12" />
            <polygon v-if="pj.shape === 'hex'" class="shape" :points="HEX_PTS" />
            <rect v-else-if="pj.shape === 'square'" class="shape" x="-5" y="-5" width="10" height="10" rx="1" />
            <circle v-else-if="pj.shape === 'circle'" class="shape" r="6.5" />
            <polygon v-else class="shape" :points="TRI_PTS" />
          </g>
          <title>{{ pj.p.name }} · {{ pj.p.grade }} 级 · {{ pj.p.status }}</title>
        </g>

        <!-- e) 监测点：静态圆，告警态放大变色 -->
        <circle
          v-for="m in monitorView"
          :key="m.m.id"
          class="mon"
          :class="[`mt-${m.m.type}`, { 'mon-alarm': m.m.status === 'alarm' }]"
          :cx="m.x"
          :cy="m.y"
          :r="m.m.status === 'alarm' ? 3.5 : 2.5"
        >
          <title>{{ m.m.id }} · {{ m.m.value }}</title>
        </circle>

        <!-- f) 告警脉冲：SSE 到达即播（响应式渲染），不参与入场编排 gating -->
        <g
          v-for="e in alertView"
          :key="e.e.id"
          class="evt"
          :class="[e.tone, { sel: e.e.id === props.selectedEventId }]"
          :transform="`translate(${e.x} ${e.y})`"
          role="button"
          tabindex="0"
          :aria-label="`告警 ${e.e.id}，${e.e.level}`"
          @click.stop="emit('alert-click', e.e)"
          @keydown.enter.prevent="emit('alert-click', e.e)"
        >
          <circle class="pulse" r="9" />
          <circle class="halo" r="6" />
          <circle class="dot" r="3.5" />
          <title>{{ e.e.id }} · {{ e.e.level }} · {{ e.e.status }}</title>
        </g>

        <!-- f2) 自定义连线（调度线 · dash 流动） -->
        <line
          v-for="lk in linkView"
          :key="lk.id"
          class="map-dispatch"
          :x1="lk.x1"
          :y1="lk.y1"
          :x2="lk.x2"
          :y2="lk.y2"
        />

        <!-- f3) 自定义标记（应急资源驻点 · 方框 + 编码 + 名称） -->
        <g
          v-for="m in markerView"
          :key="m.id"
          class="map-marker"
          :transform="`translate(${m.x} ${m.y})`"
          role="button"
          tabindex="0"
          :aria-label="`标记：${m.name}`"
          @click.stop="emit('marker-click', m.id)"
          @keydown.enter.prevent="emit('marker-click', m.id)"
        >
          <circle class="marker-halo" r="11" />
          <rect x="-7" y="-7" width="14" height="14" rx="1.5" />
          <text class="marker-code" x="0" y="0.5">{{ m.code }}</text>
          <text class="marker-name" x="0" y="17">{{ m.name }}</text>
          <title>{{ m.name }}</title>
        </g>

        <!-- g) 旗界扫光：外沿亮色短 dash 线性循环（入场期暂停，introDone 后 running） -->
        <path class="sweep" :d="bannerMainPath" />

        <!-- 标牌锚点探针（不可见 · 供 HTML 标牌层实测屏幕坐标） -->
        <g ref="probeLayerEl" class="probes" aria-hidden="true">
          <circle v-for="s in labelSpecs" :key="s.key" :data-key="s.key" :cx="s.x" :cy="s.y" r="0.6" />
        </g>
      </g>
    </svg>

    <!-- 引线层（屏幕像素坐标系：锚点 → 槽位端斜线 + 短横杠） -->
    <svg class="mc-leaders" aria-hidden="true">
      <path v-for="l in labelItems" :key="`ld-${l.key}`" class="leader" :d="l.leader" />
    </svg>

    <!-- HTML 标牌层（恒定 13px · 水厂金边） -->
    <div class="mc-labels" aria-hidden="true">
      <div
        v-for="l in labelItems"
        :key="l.key"
        class="mc-tag"
        :class="{ plant: l.plant, sel: l.sel }"
        :style="{ left: `${l.left}px`, top: `${l.top}px` }"
      >{{ l.text }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { GRADE_SHAPE } from '@shared/types';
import type { EmergencyEvent, MonitorPoint, PipeSegment, Project } from '@shared/types';
import { pointInPolygon, useMapProjection } from './composables/useMapProjection';
import type { Pt } from './composables/useMapProjection';

const props = defineProps<{
  projects: Project[];
  monitors: MonitorPoint[];
  pipes: PipeSegment[];
  alerts: EmergencyEvent[];
  selectedProjectId?: string | null;
  /** 选中事件（脉冲 halo 增强 · 应急页联动） */
  selectedEventId?: string | null;
  /** 自定义标记（应急资源驻点等） */
  markers?: MapMarker[];
  /** 自定义连线（资源→事件调度线等） */
  links?: MapLink[];
}>();

export interface MapMarker {
  id: string;
  lon: number;
  lat: number;
  code: string;
  name: string;
}
export interface MapLink {
  id: string;
  from: [number, number];
  to: [number, number];
}

const emit = defineEmits<{
  'project-click': [project: Project];
  'alert-click': [event: EmergencyEvent];
  'focus-end': [];
  'marker-click': [id: string];
}>();

/* ================= 投影 + GeoJSON 边界 ================= */
const { MAP_W, mapH, proj, bannerPaths, bannerMainPath, towns, load } = useMapProjection();

/* ================= h) 入场编排（2.8s · 仅首挂载 · reduced-motion 直达终态） ================= */
const reduced =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const introActive = ref(!reduced);
let introTimer: ReturnType<typeof setTimeout> | null = null;

/* 旗界描边生长：getTotalLength → dasharray=周长 → dashoffset 归零（0.8s） */
const bannerOuterEl = ref<SVGPathElement | null>(null);
const bannerDrawStyle = ref<CSSProperties>({});
watch(bannerMainPath, async () => {
  await nextTick();
  const el = bannerOuterEl.value;
  if (!el) return;
  const len = el.getTotalLength();
  if (len > 0) bannerDrawStyle.value = { '--len': String(Math.ceil(len)) } as CSSProperties;
});

/* ================= b) 乡镇在线率 choropleth（PIP 一次聚合） ================= */
/** 5 档色：spring-green → amber → alarm 低饱和（fill 由 CSS 分档控制） */
function rateTier(rate: number): number {
  if (rate >= 98) return 0;
  if (rate >= 95) return 1;
  if (rate >= 90) return 2;
  if (rate >= 80) return 3;
  return 4;
}
interface TownView {
  name: string;
  paths: string[];
  tier: number; // -1 = 无监测点不填色
  i: number;
  centroid: Pt;
}
const townView = computed<TownView[]>(() =>
  towns.value.map((t, i) => {
    let total = 0;
    let online = 0;
    for (const m of props.monitors) {
      const pt = proj(m.coord[0], m.coord[1]);
      if (t.ring.length >= 3 && pointInPolygon(pt, t.ring)) {
        total++;
        if (m.status !== 'offline' && m.status !== 'stop') online++;
      }
    }
    return {
      name: t.name,
      paths: t.paths,
      tier: total === 0 ? -1 : rateTier((online / total) * 100),
      i: Math.min(i, 24),
      centroid: t.centroid,
    };
  }),
);

/* ================= c) 供水管线 ================= */
interface PipeView {
  id: string;
  d: string;
  len: number;
  w: number;
  idx: number;
  active: boolean;
  endArrow: boolean;
  midArrow: boolean;
  midD: string;
  markerId: string;
}
const gradeAIds = computed(() => new Set(props.projects.filter((p) => p.grade === 'A').map((p) => p.id)));
const pipeView = computed<PipeView[]>(() =>
  props.pipes.map((pipe, i) => {
    const a = proj(pipe.start[0], pipe.start[1]);
    const b = proj(pipe.end[0], pipe.end[1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1e-3, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const w = Math.min(4.8, Math.max(1.6, pipe.diameter / 100));
    return {
      id: pipe.id,
      d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
      len: +len.toFixed(1),
      w,
      idx: Math.min(i, 24),
      active: pipe.projectId === props.selectedProjectId,
      endArrow: gradeAIds.value.has(pipe.projectId),
      midArrow: pipe.diameter >= 200,
      midD: `M${(mx - ux * 0.6).toFixed(1)} ${(my - uy * 0.6).toFixed(1)}L${(mx + ux * 0.6).toFixed(1)} ${(
        my + uy * 0.6
      ).toFixed(1)}`,
      markerId: `mc-arrow-${w.toFixed(1)}`,
    };
  }),
);
/** 用到箭头的线宽分档 → 各建一个 marker（尺寸 max(5, 2.2W)） */
const arrowMarkers = computed(() => {
  const ws = new Set(
    pipeView.value.filter((p) => p.endArrow || p.midArrow).map((p) => p.w.toFixed(1)),
  );
  return [...ws].map((w) => {
    const size = Math.max(5, 2.2 * Number(w));
    return { id: `mc-arrow-${w}`, w: +(size * 1.25).toFixed(2), h: +size.toFixed(2) };
  });
});

/* ================= d) 工程点 ================= */
const HEX_PTS = '7,0 3.5,6.1 -3.5,6.1 -7,0 -3.5,-6.1 3.5,-6.1';
const TRI_PTS = '0,-8 6.9,4 -6.9,4';
interface ProjectView {
  p: Project;
  x: number;
  y: number;
  shape: 'hex' | 'square' | 'circle' | 'triangle';
}
const projectView = computed<ProjectView[]>(() =>
  props.projects.map((p) => {
    const pt = proj(p.coord[0], p.coord[1]);
    return { p, x: pt.x, y: pt.y, shape: GRADE_SHAPE[p.grade] };
  }),
);

/* ================= e) 监测点 ================= */
interface MonitorView {
  m: MonitorPoint;
  x: number;
  y: number;
}
const monitorView = computed<MonitorView[]>(() =>
  props.monitors.map((m) => {
    const pt = proj(m.coord[0], m.coord[1]);
    return { m, x: pt.x, y: pt.y };
  }),
);

/* ================= f) 告警脉冲（坐标经 projectId → 工程坐标） ================= */
const TYPE_LABEL: Record<EmergencyEvent['type'], string> = {
  burst: '爆管',
  water_quality: '水质异常',
  power_outage: '停电',
  frost: '冻堵',
  equipment: '设备故障',
};
const coordOf = computed(() => new Map(props.projects.map((p) => [p.id, p.coord])));
interface AlertView {
  e: EmergencyEvent;
  x: number;
  y: number;
  tone: string;
}
const alertView = computed<AlertView[]>(() =>
  props.alerts.flatMap((e): AlertView[] => {
    const coord = e.projectId ? coordOf.value.get(e.projectId) : undefined;
    if (!coord) return [];
    const pt = proj(coord[0], coord[1]);
    return [
      {
        e,
        x: pt.x,
        y: pt.y,
        tone: e.level === '重大' ? 'lv-major' : e.level === '较大' ? 'lv-mid' : 'lv-minor',
      },
    ];
  }),
);

/* ================= f2/f3) 自定义标记与连线（应急资源/调度线等） ================= */
const markerView = computed(() =>
  (props.markers ?? []).flatMap((m) => {
    const pt = proj(m.lon, m.lat);
    return [{ ...m, x: pt.x, y: pt.y }];
  }),
);
const linkView = computed(() =>
  (props.links ?? []).flatMap((lk) => {
    const a = proj(lk.from[0], lk.from[1]);
    const b = proj(lk.to[0], lk.to[1]);
    return [{ id: lk.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y }];
  }),
);

/* ================= i) viewport 聚焦（公式同 emergency 页） ================= */
interface VPt {
  x: number;
  y: number;
}
const focusPt = ref<VPt | null>(null);
const viewportStyle = computed<CSSProperties | undefined>(() => {
  if (!focusPt.value) return undefined;
  const s = 1.9;
  const { x, y } = focusPt.value;
  return {
    transform: `translate(${(MAP_W / 2 - x * s).toFixed(1)}px, ${(mapH.value / 2 - y * s).toFixed(
      1,
    )}px) scale(${s})`,
  };
});

/** 视角过渡期间的标牌同步（rAF 循环；transitionend / 兜底计时器停表） */
let rafId = 0;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
let transitioning = false;

function beginTransitionSync(): void {
  stopLoop();
  transitioning = true;
  const tick = (): void => {
    syncLabels();
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  // 兜底：transition:none（reduced-motion）或状态未变时 transitionend 不触发 → 仍需 emit focus-end
  fallbackTimer = setTimeout(() => {
    if (transitioning) emit('focus-end');
    stopLoop();
  }, 900);
}

function stopLoop(): void {
  transitioning = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  syncLabels();
}

function onViewportTransitionEnd(e: Event): void {
  const te = e as TransitionEvent;
  if (e.target !== e.currentTarget || te.propertyName !== 'transform') return;
  stopLoop();
  emit('focus-end');
}

function focus(lon: number, lat: number): void {
  focusPt.value = proj(lon, lat);
  beginTransitionSync();
}
function reset(): void {
  if (focusPt.value === null) return;
  focusPt.value = null;
  beginTransitionSync();
}
defineExpose({ focus, reset });

/* ================= HTML 标牌层（探针实测屏幕坐标 · 8 槽位轮换防叠字） ================= */
interface LabelSpec {
  key: string;
  text: string;
  plant: boolean;
  sel: boolean;
  x: number;
  y: number;
}
const labelSpecs = computed<LabelSpec[]>(() => [
  // D 级供水点数据量近千（mock 1888），标牌仅保留 A/B/C 工程 + 当前选中（防叠字/淹没地图）
  ...projectView.value
    .filter((pj) => pj.p.grade !== 'D' || pj.p.id === props.selectedProjectId)
    .map((pj) => ({
      key: `p-${pj.p.id}`,
      text: pj.p.name,
      plant: pj.p.grade === 'A' && /水厂|供水站/.test(pj.p.name),
      sel: pj.p.id === props.selectedProjectId,
      x: pj.x,
      y: pj.y,
    })),
  ...alertView.value.map((a) => ({
    key: `a-${a.e.id}`,
    text: `${TYPE_LABEL[a.e.type]} · ${a.e.level}`,
    plant: false,
    sel: false,
    x: a.x,
    y: a.y,
  })),
]);

/** 8 槽位：左上/右上 × 长短 × 再左右偏移（屏幕 px，相对锚点） */
const SLOTS = [
  { dx: -46, dy: -46, side: -1 },
  { dx: -64, dy: -46, side: -1 },
  { dx: -90, dy: -74, side: -1 },
  { dx: -108, dy: -74, side: -1 },
  { dx: 46, dy: -46, side: 1 },
  { dx: 64, dy: -46, side: 1 },
  { dx: 90, dy: -74, side: 1 },
  { dx: 108, dy: -74, side: 1 },
] as const;

interface LabelItem {
  key: string;
  text: string;
  plant: boolean;
  sel: boolean;
  left: number;
  top: number;
  leader: string;
}
const labelItems = ref<LabelItem[]>([]);
const rootEl = ref<HTMLDivElement | null>(null);
const probeLayerEl = ref<SVGGElement | null>(null);

function syncLabels(): void {
  const root = rootEl.value;
  const probes = probeLayerEl.value;
  if (!root || !probes || !labelSpecs.value.length) {
    labelItems.value = [];
    return;
  }
  const rootRect = root.getBoundingClientRect();
  const rects = new Map<string, VPt>();
  probes.querySelectorAll<SVGCircleElement>('circle[data-key]').forEach((c) => {
    const k = c.getAttribute('data-key');
    if (!k) return;
    const r = c.getBoundingClientRect();
    rects.set(k, { x: r.left + r.width / 2 - rootRect.left, y: r.top + r.height / 2 - rootRect.top });
  });
  // 同类点（工程/告警）按索引轮换槽位
  const counters: Record<'p' | 'a', number> = { p: 0, a: 0 };
  labelItems.value = labelSpecs.value.flatMap((s): LabelItem[] => {
    const anchor = rects.get(s.key);
    if (!anchor) return [];
    const kind: 'p' | 'a' = s.key.startsWith('p-') ? 'p' : 'a';
    const slot = SLOTS[counters[kind] % SLOTS.length];
    counters[kind]++;
    const sx = anchor.x + slot.dx;
    const sy = anchor.y + slot.dy;
    const barEnd = sx + slot.side * 14; // 短横杠末端 = 标牌锚定点
    return [
      {
        key: s.key,
        text: s.text,
        plant: s.plant,
        sel: s.sel,
        left: barEnd,
        top: sy,
        leader: `M${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)}L${sx.toFixed(1)} ${sy.toFixed(
          1,
        )}L${barEnd.toFixed(1)} ${sy.toFixed(1)}`,
      },
    ];
  });
}

/* ================= 生命周期 ================= */
let ro: ResizeObserver | null = null;

onMounted(() => {
  void load();
  if (!reduced) introTimer = setTimeout(() => { introActive.value = false; }, 2800);
  ro = new ResizeObserver(() => syncLabels());
  if (rootEl.value) ro.observe(rootEl.value);
  void nextTick(syncLabels);
});

onBeforeUnmount(() => {
  if (introTimer) clearTimeout(introTimer);
  if (rafId) cancelAnimationFrame(rafId);
  if (fallbackTimer) clearTimeout(fallbackTimer);
  ro?.disconnect();
});

/* 标牌规格变化（数据条数 / 选中项 / bbox 重投影）→ 探针渲染后重算一次位置 */
watch(labelSpecs, async () => {
  await nextTick();
  syncLabels();
});
</script>

<style scoped>
.mc-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(
    ellipse 70% 60% at 50% 45%,
    #0e2a4a 0%,
    var(--surface-blue) 45%,
    var(--well-deep) 100%
  );
}
.mc-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.viewport {
  transition: transform 0.7s cubic-bezier(0.22, 0.8, 0.3, 1);
}

/* ===== a) 旗界双线 ===== */
.banner-fill {
  fill: rgba(12, 35, 64, 0.35);
  pointer-events: none;
}
.banner-inner {
  fill: none;
  stroke: rgba(0, 194, 255, 0.25);
  stroke-width: 0.8;
  pointer-events: none;
}
.banner-outer {
  fill: none;
  stroke: rgba(0, 194, 255, 0.55);
  stroke-width: 1.6;
  pointer-events: none;
}

/* ===== b) 乡镇 choropleth（在线率 5 档低饱和 · fill-opacity 0.10-0.22） ===== */
.town-fill {
  fill: var(--spring-green);
  fill-opacity: 0.1;
  pointer-events: none;
}
.tier-1 { fill: #7be8c4; fill-opacity: 0.13; }
.tier-2 { fill: #ffd98a; fill-opacity: 0.16; }
.tier-3 { fill: var(--steppe-amber); fill-opacity: 0.19; }
.tier-4 { fill: var(--status-alarm); fill-opacity: 0.22; }
.tier-none { fill: none; }
.town-line {
  fill: none;
  stroke: rgba(0, 194, 255, 0.16);
  stroke-width: 0.8;
  pointer-events: none;
}
.town-name {
  fill: var(--text-dim);
  font-size: 11px;
  font-family: var(--cn);
  letter-spacing: 1px;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}

/* ===== c) 供水管线（沟层 + 白青面层 + 静态箭头） ===== */
.pipe-trench {
  fill: none;
  stroke: rgba(0, 194, 255, 0.14);
  stroke-linecap: round;
}
.pipe-face {
  fill: none;
  stroke: rgba(223, 247, 255, 0.82);
  stroke-linecap: round;
}
/* 选中工程关联管线的恒速流光（90 units/s · 只动 stroke-dashoffset） */
.pipe-flow {
  fill: none;
  stroke: var(--spring-green);
  stroke-width: calc(var(--w) * 0.45);
  stroke-linecap: round;
  stroke-dasharray: calc(var(--len) / 8);
  animation: pipe-flow calc(var(--len) / 90 * 1s) linear infinite;
  pointer-events: none;
}
@keyframes pipe-flow {
  to { stroke-dashoffset: calc(-1 * var(--len)); }
}
.pipe-arrow {
  fill: none;
  stroke: none;
}
.arrow-shape {
  fill: rgba(223, 247, 255, 0.95);
}

/* ===== d) 工程点（形状双编码 · 状态色覆盖） ===== */
.pj {
  cursor: pointer;
  color: var(--spring-green);
}
.pj.st-alarm { color: var(--status-alarm); }
.pj.st-repair { color: var(--steppe-amber); }
.pj.st-stop,
.pj.st-offline { color: var(--status-stop); }
.pj .shape {
  stroke: currentColor;
  stroke-width: 2;
  fill: currentColor;
  fill-opacity: 0.18;
}
.pj .pj-halo {
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  opacity: 0;
}
.pj.sel .pj-halo,
.pj:focus-visible .pj-halo {
  opacity: 0.9;
}
.pj:focus-visible {
  outline: none;
}

/* ===== e) 监测点 ===== */
.mon {
  stroke: var(--well-deep);
  stroke-width: 0.6;
}
.mt-pressure { fill: var(--mon-pressure); }
.mt-flow { fill: var(--mon-flow); }
.mt-quality { fill: var(--mon-quality); }
.mt-level { fill: var(--mon-level); }
.mon-alarm { fill: var(--status-alarm); }

/* ===== f) 告警脉冲（事件地图同款 · 色随 level） ===== */
.evt {
  cursor: pointer;
  color: var(--flood-teal);
}
.evt.lv-major { color: var(--status-alarm); }
.evt.lv-mid { color: var(--steppe-amber); }
.evt .dot {
  fill: currentColor;
  stroke: var(--well-deep);
  stroke-width: 1;
}
.evt .halo {
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  opacity: 0.55;
}
.evt .pulse {
  fill: currentColor;
  opacity: 0.4;
  transform-box: fill-box;
  transform-origin: center;
  animation: mc-pulse 1.6s ease-out infinite;
}
@keyframes mc-pulse {
  0% { transform: scale(0.4); opacity: 0.5; }
  100% { transform: scale(1.7); opacity: 0; }
}
.evt:focus-visible {
  outline: none;
}
.evt:focus-visible .halo {
  stroke: var(--spring-green);
  stroke-width: 2;
  opacity: 1;
}
.evt.sel .halo {
  stroke-width: 2;
  opacity: 1;
}

/* ===== f2) 自定义连线（调度线 · dash 流动） ===== */
.map-dispatch {
  stroke: rgba(0, 255, 224, 0.55);
  stroke-width: 1.2;
  stroke-dasharray: 6 5;
  animation: mc-dispatch 1.2s linear infinite;
  pointer-events: none;
}
@keyframes mc-dispatch {
  to { stroke-dashoffset: -11; }
}

/* ===== f3) 自定义标记（应急资源驻点） ===== */
.map-marker {
  cursor: pointer;
  color: var(--spring-green);
}
.map-marker rect {
  fill: var(--surface-blue);
  stroke: currentColor;
  stroke-width: 1.3;
  transition: fill 0.16s ease;
}
.map-marker:hover rect {
  fill: rgba(0, 255, 224, 0.2);
}
.map-marker text {
  fill: currentColor;
  font-size: 9px;
  font-family: var(--cn);
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}
.map-marker .marker-name {
  font-size: 8.5px;
  fill: rgba(0, 255, 224, 0.75);
}
.map-marker .marker-halo {
  fill: none;
  stroke: currentColor;
  opacity: 0;
}

/* ===== g) 旗界扫光（唯一 gated 循环动画） ===== */
.sweep {
  fill: none;
  stroke: rgba(0, 255, 224, 0.85);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-dasharray: 60 4000;
  animation: mc-sweep 8s linear infinite;
  pointer-events: none;
}
@keyframes mc-sweep {
  to { stroke-dashoffset: -4060; }
}
.intro-run .sweep {
  animation-play-state: paused;
}

/* ===== h) 入场编排（.intro-run 挂载期间生效，结束移除 = 直达终态） ===== */
.intro-run .banner-outer {
  stroke-dasharray: var(--len);
  stroke-dashoffset: var(--len);
  animation: mc-draw 0.8s ease-out forwards;
}
.intro-run .town-fill,
.intro-run .town-line,
.intro-run .town-name {
  animation: mc-fade 0.3s ease-out both;
  animation-delay: calc(0.5s + var(--i) * 30ms);
}
.intro-run .pj-in {
  animation: mc-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: calc(1.2s + var(--i) * 50ms);
  transform-box: fill-box;
  transform-origin: center;
}
.intro-run .pipe-trench,
.intro-run .pipe-face {
  stroke-dasharray: var(--len);
  stroke-dashoffset: var(--len);
  animation: mc-draw 0.6s ease-out both;
  animation-delay: calc(1.8s + var(--i) * 15ms);
}
@keyframes mc-draw {
  to { stroke-dashoffset: 0; }
}
@keyframes mc-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes mc-pop {
  from { transform: scale(0); }
  to { transform: scale(1); }
}

/* ===== 标牌探针 / 引线 / HTML 标牌 ===== */
.probes circle {
  fill: none;
  stroke: none;
  pointer-events: none;
}
.mc-leaders {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}
.leader {
  fill: none;
  stroke: rgba(0, 194, 255, 0.45);
  stroke-width: 1;
}
.mc-labels {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}
.mc-tag {
  position: absolute;
  transform: translate(-50%, -100%);
  padding: 3px 10px;
  font-size: 13px;
  line-height: 1.3;
  white-space: nowrap;
  color: var(--text);
  background: rgba(3, 8, 18, 0.85);
  border: 1px solid var(--line-vein);
  border-radius: var(--radius);
}
.mc-tag.plant {
  border-color: var(--steppe-amber);
  color: #ffd9a0;
}
.mc-tag.sel {
  border-color: var(--spring-green);
}

/* ===== reduced-motion：编排直达终态，循环动画全关 ===== */
@media (prefers-reduced-motion: reduce) {
  .viewport { transition: none; }
  .sweep { display: none; }
  .evt .pulse { animation: none; opacity: 0.22; }
  .map-dispatch { animation: none; }
}
</style>
