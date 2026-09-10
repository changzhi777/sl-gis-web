<!--
  emergency/Dashboard.vue — 应急指挥大屏（1920×1080）
  视觉标准：preview.html + design-system（tokens.css 同源）
  · 顶栏复用 TopBar（kpis 置空，告警灯 = 未签收数）
  · KPI 条：今日事件 / 未签收 / 处置中 / 平均响应时间 / 重大事件数
  · 左列：ResourcePanel 应急资源 + 响应统计（TrendLine 近 7 日）
  · 中列：事件地图（简化 SVG：真实旗界/乡镇界 GeoJSON + 事件脉冲 + 资源点 + 调度连线）
         + 事件详情（字段卡 + ImpactAnalysis 影响范围）
  · 右列：EventTimeline 处置时间线 + 应急预案手风琴
  交互：点击事件 → 地图聚焦该点 + 右侧时间线联动；点击资源卡 → 地图高亮资源驻点
  数据：全部 mock（mockData.alerts/projects + 本地确定性常量），坐标不虚构
-->
<template>
  <VScaleScreen
    :width="1920"
    :height="1080"
    :full-screen="false"
    :box-style="{ background: '#030812' }"
  >
    <div class="screen">
      <TopBar :kpis="[]" :alarm-count="unsignedCount" @alarm-click="focusTopAlarm" />

      <!-- KPI 条 -->
      <div class="kpi-strip" role="group" aria-label="应急态势总览">
        <div v-for="k in stripKpis" :key="k.label" class="ks" :class="k.tone">
          <div class="v num">
            {{ k.value }}<small v-if="k.unit">{{ k.unit }}</small>
          </div>
          <div class="l">{{ k.label }}</div>
        </div>
      </div>

      <main class="grid">
        <!-- 左列 -->
        <div class="col">
          <ResourcePanel
            class="grow-14"
            :resources="resources"
            :highlight-id="highlightId"
            @select="onSelectResource"
          />
          <Panel class="grow-10" title="响应统计" sub="近 7 日">
            <div class="resp-row">
              <div class="rs">
                <b class="num">26</b><small>min</small>
                <span class="lab">平均响应时间</span>
              </div>
              <div class="rs">
                <b class="num">6.5</b><small>h</small>
                <span class="lab">平均修复时间</span>
              </div>
              <div class="rs">
                <b class="num">5</b><small>次</small>
                <span class="lab">今日出动次数</span>
              </div>
            </div>
            <TrendLine
              :series="respSeries"
              :x-labels="respLabels"
              :height="104"
              smooth
              :show-legend="true"
            />
          </Panel>
        </div>

        <!-- 中列 -->
        <section class="mid">
          <Panel class="mid-map" hero title="事件地图" :sub="mapSub">
            <template #extra>
              <button class="btn-reset" type="button" @click="resetView">⌖ 复位视角</button>
            </template>
            <div class="emap-host">
              <svg
                class="emap"
                :viewBox="`0 0 ${MAP_W} ${mapH}`"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="应急事件分布图"
              >
                <g class="viewport" :style="viewportStyle">
                  <!-- 旗界 + 乡镇界（真实 GeoJSON，fetch 失败时仅缺省边界） -->
                  <path
                    v-for="(d, i) in bannerPaths"
                    :key="`b${i}`"
                    class="banner-outline"
                    :d="d"
                  />
                  <path
                    v-for="(d, i) in townPaths"
                    :key="`t${i}`"
                    class="town-outline"
                    :d="d"
                  />

                  <!-- 苏木乡镇名称 -->
                  <text v-for="s in sumuPoints" :key="s.name" class="sumu-label" :x="s.x" :y="s.y">
                    {{ s.name }}
                  </text>

                  <!-- 调度连线（资源驻点 → 事件点） -->
                  <line
                    v-for="(lk, i) in mapLinks"
                    :key="`l${i}`"
                    class="dispatch"
                    :x1="lk.x1"
                    :y1="lk.y1"
                    :x2="lk.x2"
                    :y2="lk.y2"
                  />

                  <!-- 应急资源驻点（绿色方块，可高亮） -->
                  <g
                    v-for="m in mapResources"
                    :key="m.r.id"
                    class="res"
                    :class="{ active: m.r.id === highlightId }"
                    :transform="`translate(${m.x} ${m.y})`"
                    role="button"
                    tabindex="0"
                    :aria-label="`应急资源：${m.r.name}，驻点 ${m.r.depotName}`"
                    @click.stop="onSelectResource(m.r)"
                    @keydown.enter.prevent="onSelectResource(m.r)"
                  >
                    <circle class="res-halo" r="11" />
                    <rect x="-7" y="-7" width="14" height="14" rx="1.5" />
                    <text x="0" y="0.5">{{ m.r.code }}</text>
                    <text class="res-name" x="0" y="17">{{ m.r.name }}</text>
                  </g>

                  <!-- 告警事件脉冲标记 -->
                  <g
                    v-for="e in mapEvents"
                    :key="e.event.id"
                    class="evt"
                    :class="[toneClass(e.event.level), { sel: e.event.id === selected?.id }]"
                    :transform="`translate(${e.x} ${e.y})`"
                    role="button"
                    tabindex="0"
                    :aria-label="`事件 ${e.event.id}：${TYPE_LABEL[e.event.type]}，${e.event.level}`"
                    @click.stop="selectEvent(e.event)"
                    @keydown.enter.prevent="selectEvent(e.event)"
                  >
                    <circle class="pulse" r="9" />
                    <circle class="halo" r="7" />
                    <circle class="dot" r="4" />
                    <title>{{ e.event.id }} · {{ TYPE_LABEL[e.event.type] }} · {{ e.event.level }} · {{ e.event.status }}</title>
                  </g>
                </g>
              </svg>

              <!-- 图例 -->
              <div class="emap-legend" aria-hidden="true">
                <span><i class="lg lg-major"></i>重大</span>
                <span><i class="lg lg-mid"></i>较大</span>
                <span><i class="lg lg-minor"></i>一般</span>
                <span><i class="lg lg-res"></i>应急资源</span>
                <span><i class="lg lg-line"></i>调度</span>
              </div>
            </div>
          </Panel>

          <Panel
            class="mid-detail"
            :variant="selected ? 'alarm' : 'default'"
            title="事件详情"
            :sub="selected ? selected.id : '未选择'"
          >
            <template v-if="selected">
              <div class="dfields">
                <div class="df"><span class="k">位置</span><span class="v2" :title="selected.location">{{ selected.location }}</span></div>
                <div class="df"><span class="k">类型</span><span class="v2">{{ TYPE_LABEL[selected.type] }}</span></div>
                <div class="df"><span class="k">等级</span><span class="v2 lvl" :class="toneClass(selected.level)">{{ selected.level }}</span></div>
                <div class="df"><span class="k">状态</span><span class="v2 st" :class="`st-${selected.status}`">{{ selected.status }}</span></div>
                <div class="df"><span class="k">责任人</span><span class="v2">{{ selected.receivedBy ?? '待派单' }}</span></div>
                <div class="df"><span class="k">上报时间</span><span class="v2 num">{{ fmtHM(selected.time) }}</span></div>
              </div>
              <div class="ddesc">{{ selected.description }}</div>
              <ImpactAnalysis :event="selected" />
            </template>
            <div v-else class="empty">点击地图上的事件标记查看详情</div>
          </Panel>
        </section>

        <!-- 右列 -->
        <div class="col">
          <Panel class="grow-12" title="处置时间线" :sub="selected ? selected.id : '点击事件联动'">
            <EventTimeline :event="selected" />
          </Panel>

          <Panel class="grow-10" title="应急预案" sub="4 类 · 点击展开">
            <div class="plans">
              <div
                v-for="(p, i) in PLANS"
                :key="p.name"
                class="plan"
                :class="{ open: openPlan === i }"
              >
                <button
                  class="plan-head"
                  type="button"
                  :aria-expanded="openPlan === i"
                  @click="togglePlan(i)"
                >
                  <span class="p-name">{{ p.name }}</span>
                  <span class="p-lvl" :class="toneClass(p.level)">{{ p.level }}</span>
                  <span class="arrow" aria-hidden="true">{{ openPlan === i ? '▾' : '▸' }}</span>
                </button>
                <ol v-show="openPlan === i" class="plan-steps">
                  <li v-for="(s, j) in p.steps" :key="j">{{ s }}</li>
                </ol>
              </div>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  </VScaleScreen>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import VScaleScreen from 'v-scale-screen';
import TopBar from '@ui/TopBar.vue';
import Panel from '@ui/Panel.vue';
import TrendLine from '@charts/TrendLine.vue';
import ResourcePanel from './ResourcePanel.vue';
import type { EmergencyResource } from './ResourcePanel.vue';
import EventTimeline from './EventTimeline.vue';
import ImpactAnalysis from './ImpactAnalysis.vue';
import { mockData } from '@mock/index';
import { realtime, onRealtime } from '@/composables/realtime';
import type { EmergencyEvent } from '@shared/types';
import { SUMU_CENTERS } from '@shared/sumu-anchors';

/* ================= 数据源 ================= */
/** 实时告警池（alert 频道置顶追加 · 初始 = mock 基线） */
const liveAlerts = ref<EmergencyEvent[]>([...mockData.alerts]);
const projectCoord = new Map(mockData.projects.map((p) => [p.id, p.coord]));

const unsignedCount = computed(() => liveAlerts.value.filter((a) => a.status === '未签收').length);
const handlingCount = computed(() =>
  liveAlerts.value.filter((a) => a.status === '已派单' || a.status === '已签收').length,
);
const majorCount = computed(() => liveAlerts.value.filter((a) => a.level === '重大').length);

/** KPI 条（平均响应时间取行业基准 26min，mock 基准值） */
const stripKpis = computed(() => [
  { label: '今日事件数', value: liveAlerts.value.length, unit: '', tone: 'c-teal' },
  { label: '未签收', value: unsignedCount.value, unit: '', tone: 'c-red' },
  { label: '处置中', value: handlingCount.value, unit: '', tone: 'c-amber' },
  { label: '平均响应时间', value: 26, unit: 'min', tone: 'c-green' },
  { label: '重大事件数', value: majorCount.value, unit: '', tone: 'c-red' },
]);

/** 应急资源（驻点 = 真实苏木乡镇中心坐标） */
const resources: EmergencyResource[] = [
  { id: 'R-TEAM', code: '抢', name: '综合抢险队', unit: '支', total: 3, ready: 2, dispatched: 1, depot: [113.103398, 42.5655], depotName: '旗应急服务中心', person: '巴特尔' },
  { id: 'R-TRUCK', code: '水', name: '应急供水车', unit: '辆', total: 6, ready: 4, dispatched: 2, depot: [113.402859, 42.477651], depotName: '朱日和镇养护站', person: '朝鲁' },
  { id: 'R-PIPE', code: '材', name: '临时管材', unit: 'm', total: 800, ready: 650, dispatched: 150, depot: [111.977158, 43.169304], depotName: '额仁淖尔物资库', person: '乌云娜' },
  { id: 'R-PUMP', code: '泵', name: '备用泵机组', unit: '台', total: 5, ready: 4, dispatched: 1, depot: [113.02006, 43.126702], depotName: '桑宝拉格养护站', person: '斯日娜' },
];

/** 调度关系：重大事件自动触发预案调派；已派单/已签收为常态调度 */
const dispatchLinks = computed(() =>
  liveAlerts.value.flatMap((a) => {
    if (a.status === '未签收' && a.level !== '重大') return [];
    const ids: string[] =
      a.type === 'burst' || a.type === 'frost'
        ? ['R-TEAM', 'R-TRUCK', 'R-PIPE']
        : a.type === 'water_quality'
          ? ['R-TRUCK']
          : ['R-PUMP'];
    return ids.map((resourceId) => ({ resourceId, eventId: a.id }));
  }),
);

/* ================= 选中 / 高亮联动 ================= */
const selected = ref<EmergencyEvent | null>(
  liveAlerts.value.find((a) => a.level === '重大') ?? liveAlerts.value[0] ?? null,
);
const highlightId = ref<string | null>(null);

function onSelectResource(r: EmergencyResource): void {
  const next = highlightId.value === r.id ? null : r.id;
  highlightId.value = next;
  if (next) {
    const p = proj(r.depot[0], r.depot[1]);
    focusPt.value = p;
  }
}

function selectEvent(a: EmergencyEvent): void {
  selected.value = a;
  const coord = a.projectId ? projectCoord.get(a.projectId) : undefined;
  focusPt.value = coord ? proj(coord[0], coord[1]) : null;
}

function focusTopAlarm(): void {
  const a = liveAlerts.value.find((x) => x.status === '未签收') ?? liveAlerts.value[0];
  if (a) selectEvent(a);
}

/* ================= SVG 地图（真实 GeoJSON 投影） ================= */
const MAP_W = 1000;
const LAT0 = 42.8;
const COS0 = Math.cos((LAT0 * Math.PI) / 180);

/** bbox：sumu-anchors 同源兜底值，banner.json 加载后按实测重算 */
const bbox = ref({ minLon: 111.15, maxLon: 114.55, minLat: 42.05, maxLat: 43.6 });
const kDeg = computed(
  () => MAP_W / Math.max(1e-6, (bbox.value.maxLon - bbox.value.minLon) * COS0),
);
const mapH = computed(() =>
  Math.round((bbox.value.maxLat - bbox.value.minLat) * kDeg.value),
);

interface Pt {
  x: number;
  y: number;
}
function proj(lon: number, lat: number): Pt {
  const k = kDeg.value;
  return { x: (lon - bbox.value.minLon) * k * COS0, y: (bbox.value.maxLat - lat) * k };
}

/* GeoJSON 最小类型（公开 6.6KB / 3.7KB，DataV GeoAtlas） */
interface GeoFeature {
  geometry: { type: string; coordinates: unknown } | null;
}
interface GeoFc {
  type: string;
  features: GeoFeature[];
}
type Ring = [number, number][];

function ringsOf(geom: { type: string; coordinates: unknown }): Ring[] {
  if (geom.type === 'Polygon') return geom.coordinates as Ring[];
  if (geom.type === 'MultiPolygon') return (geom.coordinates as Ring[][]).flat();
  return [];
}
function ringToD(ring: Ring): string {
  if (!ring.length) return '';
  const seg = ring.map(([lon, lat]) => {
    const p = proj(lon, lat);
    return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  });
  return `M${seg.join('L')}Z`;
}
function featurePaths(fc: GeoFc): string[] {
  return fc.features.flatMap((f) =>
    f.geometry ? ringsOf(f.geometry).map(ringToD).filter(Boolean) : [],
  );
}
function bboxOf(fc: GeoFc): typeof bbox.value {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const f of fc.features) {
    if (!f.geometry) continue;
    for (const ring of ringsOf(f.geometry)) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

async function fetchGeo(url: string): Promise<GeoFc> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`geo ${r.status}`);
  return (await r.json()) as GeoFc;
}

const bannerPaths = ref<string[]>([]);
const townPaths = ref<string[]>([]);

const offs: Array<() => void> = [];

onMounted(async () => {
  // 实时引擎（本页只消费 alert 频道 · 新事件置顶 + KPI/地图/调度线联动）
  realtime.start({ monitors: mockData.monitors, alertPool: mockData.alerts });
  offs.push(onRealtime('alert', (evt) => {
    liveAlerts.value = [evt.data as unknown as EmergencyEvent, ...liveAlerts.value].slice(0, 15);
  }));

  try {
    const fc = await fetchGeo(`${import.meta.env.BASE_URL}geo/banner.json`);
    bbox.value = bboxOf(fc);
    bannerPaths.value = featurePaths(fc);
  } catch {
    /* 边界缺省：兜底 bbox 继续渲染点位 */
  }
  try {
    const fc = await fetchGeo(`${import.meta.env.BASE_URL}geo/townships.json`);
    townPaths.value = featurePaths(fc);
  } catch {
    /* 乡镇界缺省可接受 */
  }
});

onBeforeUnmount(() => {
  realtime.stop();
  offs.forEach((off) => off());
});

/* 点位投影（computed 依赖 bbox，边界加载后自动重投影） */
interface MapEvent {
  event: EmergencyEvent;
  x: number;
  y: number;
}
const mapEvents = computed<MapEvent[]>(() =>
  liveAlerts.value.flatMap((a): MapEvent[] => {
    const coord = a.projectId ? projectCoord.get(a.projectId) : undefined;
    if (!coord) return [];
    const p = proj(coord[0], coord[1]);
    return [{ event: a, x: p.x, y: p.y }];
  }),
);

interface MapResource {
  r: EmergencyResource;
  x: number;
  y: number;
}
const mapResources = computed<MapResource[]>(() =>
  resources.map((r) => {
    const p = proj(r.depot[0], r.depot[1]);
    return { r, x: p.x, y: p.y };
  }),
);

const sumuPoints = computed(() =>
  SUMU_CENTERS.map((c) => ({ name: c.name, ...proj(c.center[0], c.center[1]) })),
);

const mapLinks = computed(() =>
  dispatchLinks.value.flatMap((l): Array<{ x1: number; y1: number; x2: number; y2: number }> => {
    const ev = mapEvents.value.find((e) => e.event.id === l.eventId);
    const res = resources.find((r) => r.id === l.resourceId);
    if (!ev || !res) return [];
    const p = proj(res.depot[0], res.depot[1]);
    return [{ x1: p.x, y1: p.y, x2: ev.x, y2: ev.y }];
  }),
);

/* 视角聚焦（transform 平移缩放，CSS 过渡 = 飞行动画） */
const focusPt = ref<Pt | null>(null);
const viewportStyle = computed(() => {
  if (!focusPt.value) return undefined;
  const s = 1.9;
  const { x, y } = focusPt.value;
  return {
    transform: `translate(${(MAP_W / 2 - x * s).toFixed(1)}px, ${(mapH.value / 2 - y * s).toFixed(1)}px) scale(${s})`,
  };
});
function resetView(): void {
  focusPt.value = null;
}

const mapSub = computed(
  () =>
    `${liveAlerts.value.length} 起 · 未签收 ${unsignedCount.value} · 调度 ${dispatchLinks.value.length} 线`,
);

/* ================= 标签 / 格式化 ================= */
const TYPE_LABEL: Record<EmergencyEvent['type'], string> = {
  burst: '爆管',
  water_quality: '水质异常',
  power_outage: '停电',
  frost: '冻堵',
  equipment: '设备故障',
};
function toneClass(level: EmergencyEvent['level']): string {
  if (level === '重大') return 'tone-major';
  if (level === '较大') return 'tone-mid';
  return 'tone-minor';
}
const p2 = (n: number) => String(n).padStart(2, '0');
function fmtHM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/* ================= 响应统计（近 7 日，确定性 mock） ================= */
const respLabels = computed(() => {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push(`${p2(d.getMonth() + 1)}-${p2(d.getDate())}`);
  }
  return out;
});
const respSeries = [
  { name: '平均响应(min)', data: [22, 25, 28, 24, 30, 27, 26] },
  { name: '目标上限(min)', data: [30, 30, 30, 30, 30, 30, 30] },
];

/* ================= 应急预案（需求 §九 · 应急保障） ================= */
interface EmPlan {
  name: string;
  level: EmergencyEvent['level'];
  steps: string[];
}
const PLANS: EmPlan[] = [
  {
    name: '供水管网爆管应急预案',
    level: '重大',
    steps: [
      '值班室接警确认，10 分钟内上报县级统管单位',
      '关闭爆管点上下游阀门，缩小停水范围',
      '调派就近抢险队携管材进场，开挖更换管段',
      '应急供水车向受影响嘎查村定点送水',
      '修复后试压冲洗，水质检测合格恢复供水',
      '24 小时内完成复盘销号并上报处置报告',
    ],
  },
  {
    name: '水质异常应急处置预案',
    level: '较大',
    steps: [
      '立即停止供水并通知受影响用户',
      '加密取样检测（浊度 / 余氯 / pH / 微生物）',
      '排查污染源（水源 / 管网 / 二次设施）',
      '管网冲洗排污，加大消毒剂投加量',
      '连续 3 次检测合格后方可恢复供水',
    ],
  },
  {
    name: '管网冻堵处置预案（牧区冬季）',
    level: '较大',
    steps: [
      '冻堵管段定位（测温 / 听漏 / 分段试压）',
      '停水泄压，采用热水循环解冻，严禁明火',
      '受影响牧户启用储水窖应急供水',
      '解冻后保温包扎，复测通水',
      '入冬前对浅埋管段完成保温加固',
    ],
  },
  {
    name: '停电应急切换预案',
    level: '一般',
    steps: [
      '确认市电中断范围，同步通知电力部门抢修',
      '10 分钟内启动柴油发电机 / UPS 切换',
      '非关键负荷轮停，优先保障供水泵运行',
      '每 2 小时巡查水位，必要时启用备用水源',
      '来电后倒闸恢复，记录停电损失台账',
    ],
  },
];
const openPlan = ref(0);
function togglePlan(i: number): void {
  openPlan.value = openPlan.value === i ? -1 : i;
}
</script>

<style scoped>
.screen {
  width: 1920px;
  height: 1080px;
  display: flex;
  flex-direction: column;
  background: var(--well-deep);
  overflow: hidden;
}

/* ===== KPI 条 ===== */
.kpi-strip {
  height: 46px;
  flex: none;
  display: flex;
  align-items: stretch;
  padding: 0 20px;
  background: linear-gradient(180deg, rgba(12, 35, 64, 0.55), rgba(7, 21, 37, 0.25));
  border-bottom: var(--border-w) solid var(--line-vein);
}
.ks {
  flex: 1;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  padding: 6px 0;
}
.ks + .ks {
  border-left: var(--border-w) solid var(--line-vein);
}
.ks .v {
  font-size: 25px;
  font-weight: 700;
  line-height: 1.2;
}
.ks .v small {
  font-family: var(--cn);
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  margin-left: 3px;
}
.ks .l {
  font-size: 12px;
  color: var(--text-dim);
}
.c-teal .v { color: var(--flood-teal); }
.c-green .v { color: var(--spring-green); }
.c-amber .v { color: var(--steppe-amber); }
.c-red .v {
  color: var(--status-alarm);
  text-shadow: 0 0 10px rgba(255, 92, 92, 0.35);
}

/* ===== 栅格 ===== */
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 400px 1fr 400px;
  gap: var(--panel-gap);
  padding: var(--panel-gap);
}
.col {
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
  min-height: 0;
}
.grow-14 { flex: 1.4; min-height: 0; }
.grow-12 { flex: 1.2; min-height: 0; }
.grow-10 { flex: 1; min-height: 0; }

.mid {
  display: flex;
  flex-direction: column;
  gap: var(--panel-gap);
  min-height: 0;
}
.mid-map { flex: 1.35; min-height: 0; }
.mid-detail { flex: 1; min-height: 0; }

/* ===== 事件地图 ===== */
.emap-host {
  position: relative;
  flex: 1;
  min-height: 0;
  background: radial-gradient(
    ellipse 70% 60% at 50% 45%,
    #0e2a4a 0%,
    var(--surface-blue) 45%,
    var(--well-deep) 100%
  );
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  overflow: hidden;
}
.emap {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.viewport {
  transition: transform 0.7s cubic-bezier(0.22, 0.8, 0.3, 1);
}

.banner-outline {
  fill: rgba(12, 35, 64, 0.35);
  stroke: rgba(0, 194, 255, 0.55);
  stroke-width: 1.6;
}
.town-outline {
  fill: none;
  stroke: rgba(0, 194, 255, 0.16);
  stroke-width: 0.8;
}
.sumu-label {
  fill: var(--text-dim);
  font-size: 11px;
  font-family: var(--cn);
  letter-spacing: 1px;
  text-anchor: middle;
  pointer-events: none;
}

/* 调度连线 */
.dispatch {
  stroke: rgba(0, 255, 224, 0.55);
  stroke-width: 1.2;
  stroke-dasharray: 6 5;
  animation: dash-flow 1.2s linear infinite;
}
@keyframes dash-flow {
  to { stroke-dashoffset: -11; }
}

/* 资源驻点 */
.res {
  cursor: pointer;
}
.res rect {
  fill: var(--surface-blue);
  stroke: var(--spring-green);
  stroke-width: 1.3;
  transition: fill 0.16s ease, stroke-width 0.16s ease;
}
.res text {
  fill: var(--spring-green);
  font-size: 9px;
  font-family: var(--cn);
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}
.res .res-name {
  font-size: 8.5px;
  fill: rgba(0, 255, 224, 0.75);
}
.res .res-halo {
  fill: none;
  stroke: var(--spring-green);
  opacity: 0;
}
.res.active rect {
  fill: rgba(0, 255, 224, 0.2);
  stroke-width: 2.2;
}
.res.active .res-halo {
  opacity: 0.9;
  animation: res-pulse 1.4s ease-out infinite;
}
@keyframes res-pulse {
  0% { transform: scale(0.7); opacity: 0.9; }
  100% { transform: scale(1.8); opacity: 0; }
}

/* 事件标记 */
.evt {
  cursor: pointer;
  color: var(--flood-teal);
}
.tone-major.evt { color: var(--status-alarm); }
.tone-mid.evt { color: var(--steppe-amber); }
.tone-minor.evt { color: var(--flood-teal); }
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
  animation: pulse 1.6s ease-out infinite;
}
@keyframes pulse {
  0% { transform: scale(0.4); opacity: 0.5; }
  100% { transform: scale(1.7); opacity: 0; }
}
.evt.sel .halo {
  stroke-width: 2;
  opacity: 1;
}
.evt:focus-visible {
  outline: none;
}
.evt:focus-visible .halo {
  stroke: var(--spring-green);
  stroke-width: 2;
  opacity: 1;
}

/* 图例 */
.emap-legend {
  position: absolute;
  left: 10px;
  bottom: 8px;
  z-index: 2;
  display: flex;
  gap: 14px;
  font-size: 11px;
  color: var(--text-dim);
  padding: 4px 10px;
  background: rgba(3, 8, 18, 0.75);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  pointer-events: none;
}
.emap-legend .lg {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: -1px;
}
.lg-major { background: var(--status-alarm); }
.lg-mid { background: var(--steppe-amber); }
.lg-minor { background: var(--flood-teal); }
.lg-res {
  background: var(--spring-green);
  border-radius: 1px !important;
}
.lg-line {
  width: 14px !important;
  height: 0 !important;
  border-top: 2px dashed rgba(0, 255, 224, 0.7);
  border-radius: 0 !important;
  vertical-align: 3px !important;
}

.btn-reset {
  padding: 3px 10px;
  font-size: 12px;
  color: var(--spring-green);
  background: rgba(7, 21, 37, 0.85);
  border: var(--border-w) solid rgba(0, 255, 224, 0.4);
  border-radius: var(--radius);
  cursor: pointer;
}
.btn-reset:hover {
  background: rgba(0, 255, 224, 0.12);
}

/* ===== 事件详情 ===== */
.dfields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
  margin-bottom: 8px;
}
.df {
  display: flex;
  gap: 8px;
  font-size: 13px;
  min-width: 0;
  line-height: 1.5;
}
.df .k {
  flex: none;
  color: var(--text-dim);
}
.df .v2 {
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lvl.tone-major { color: var(--status-alarm); font-weight: 600; }
.lvl.tone-mid { color: var(--steppe-amber); font-weight: 600; }
.lvl.tone-minor { color: var(--flood-teal); font-weight: 600; }
.st {
  font-size: 12px;
  padding: 0 6px;
  border: var(--border-w) solid;
  border-radius: var(--radius);
  line-height: 1.5;
  align-self: center;
}
.st-未签收 { color: var(--status-alarm); border-color: rgba(255, 92, 92, 0.55); }
.st-已派单 { color: var(--steppe-amber); border-color: rgba(255, 180, 84, 0.55); }
.st-已签收 { color: var(--flood-teal); border-color: rgba(0, 194, 255, 0.55); }
.st-已销号 { color: var(--spring-green); border-color: rgba(0, 255, 224, 0.5); }

.ddesc {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.6;
  border-left: 3px solid var(--status-alarm);
  background: rgba(255, 92, 92, 0.06);
  padding: 5px 10px;
  border-radius: 0 var(--radius) var(--radius) 0;
  margin-bottom: 10px;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  font-size: 13px;
  opacity: 0.75;
}

/* ===== 响应统计 ===== */
.resp-row {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}
.rs {
  flex: 1;
  text-align: center;
  padding: 7px 0 6px;
  background: rgba(12, 35, 64, 0.5);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
}
.rs b {
  font-size: 22px;
  font-weight: 700;
  color: var(--spring-green);
  line-height: 1.15;
}
.rs:nth-child(2) b { color: var(--flood-teal); }
.rs:nth-child(3) b { color: var(--steppe-amber); }
.rs small {
  font-family: var(--cn);
  font-size: 11px;
  color: var(--text-dim);
  margin-left: 2px;
}
.rs .lab {
  display: block;
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 1px;
}

/* ===== 应急预案 ===== */
.plans {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.plan {
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  background: rgba(12, 35, 64, 0.4);
  margin-bottom: 8px;
}
.plan.open {
  border-color: rgba(0, 194, 255, 0.35);
}
.plan-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: none;
  border: none;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.plan-head:hover {
  background: rgba(0, 194, 255, 0.08);
}
.plan-head:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: -2px;
}
.p-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.p-lvl {
  flex: none;
  font-size: 11px;
  padding: 0 5px;
  border: var(--border-w) solid;
  border-radius: var(--radius);
  line-height: 1.5;
}
.p-lvl.tone-major { color: var(--status-alarm); border-color: rgba(255, 92, 92, 0.55); }
.p-lvl.tone-mid { color: var(--steppe-amber); border-color: rgba(255, 180, 84, 0.55); }
.p-lvl.tone-minor { color: var(--flood-teal); border-color: rgba(0, 194, 255, 0.55); }
.arrow {
  flex: none;
  color: var(--text-dim);
  font-size: 12px;
}
.plan-steps {
  margin: 0;
  padding: 2px 10px 10px 32px;
  color: var(--text-dim);
  font-size: 12px;
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.plan-steps li::marker {
  color: var(--flood-teal);
  font-family: var(--num);
}

/* 动效预算：reduced-motion 全关 */
@media (prefers-reduced-motion: reduce) {
  .viewport { transition: none; }
  .dispatch { animation: none; }
  .evt .pulse { animation: none; opacity: 0.25; }
  .res.active .res-halo { animation: none; opacity: 0.6; }
}
</style>
