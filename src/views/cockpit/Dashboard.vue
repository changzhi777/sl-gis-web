<!--
  cockpit/Dashboard.vue — 数据驾驶舱 v10（数字孪生水厂版 · A 稿落地）
  布局：两栏 —— 左侧信息列 392px（天气卡 + 当日总览 + 苏木排名）｜右侧主区（等轴测孪生 hero + 四角毛玻璃浮层 + 状态条）
  视觉：数据墨水风局部 tokens + 毛玻璃浮层（backdrop-blur）· 生成式背景保留
  数据：weather(和风聚合) + assessment/billing/projects/monitors/alerts 五源水合 + SSE 四频道（mock 起步 · 失败回落）
  下钻：排名→考核 · 事件流→应急 · 漏斗→应急 · 收费/考核快捷→对应章页
  与一张图差异：厂区微观孪生视角（等轴测线框）vs 全域宏观地理（SVG 瓦片地图）
-->
<template>
  <div class="screen cockpit">
    <div class="bg-deco" aria-hidden="true" />

    <div class="ck-body">
      <!-- ===== 左侧信息列 ===== -->
      <aside class="ck-side">
        <WeatherCard class="ed" style="--d: 0ms" :county="COUNTY" :lon="LON" :lat="LAT" />

        <GlassPanel class="ed" style="--d: 120ms" title="当日总览" sub="统管口径">
          <div class="kpis">
            <FlipNumber :value="kpiBand.totalFlow" :decimals="2" unit="万m³" label="当日供水量" color="#00FFE0" />
            <FlipNumber :value="kpiBand.onlineRate" :decimals="1" unit="%" label="设备在线率" color="#00C2FF" />
            <FlipNumber :value="kpiBand.qualityRate" :decimals="1" unit="%" label="水质合格率" color="#7EE081" />
            <FlipNumber :value="kpiBand.alarm" unit="条" label="未签收告警" :color="kpiBand.alarm > 0 ? '#FF6F52' : '#00C2FF'" />
          </div>
        </GlassPanel>

        <GlassPanel
          class="rank-panel ed"
          style="--d: 240ms"
          title="苏木乡镇综合排名"
          sub="按工程正常率"
          drill
          @click="drill('/assessment')"
        >
          <RankingBoard :rows="ranking" unit="分" />
        </GlassPanel>
      </aside>

      <!-- ===== 主区：四态主视觉 + 毛玻璃浮层 ===== -->
      <main class="ck-main ed" style="--d: 360ms">
        <div class="hero-wrap">
          <TwinPlant
            v-show="heroView === 'twin'"
            :nodes="twinNodes"
            :dosing="`水质 ${kpiBand.qualityRate.toFixed(1)}%`"
            :pool-level="poolLevel"
            :alarm="kpiBand.alarm > 0"
            video="img/cockpit-twin.mp4"
          />
          <TopoRadial v-show="heroView === 'topo'" :nodes="suMuSix" />
          <ProcessFlow v-show="heroView === 'flow'" :pool-level="poolLevel" :quality-rate="kpiBand.qualityRate" />
          <StyleMap v-show="heroView === 'map'" :nodes="suMuSix" />
        </div>

        <div class="hero-tag">
          <span class="dot" aria-hidden="true" />
          <b>厂区数字孪生</b>{{ plantName }} · LIVE
        </div>

        <!-- 右上：实时事件流（SSE 置顶） -->
        <div class="float f-tr stream-wrap drill" @click="drill('/emergency')">
          <div class="f-head"><h4>实时事件流</h4><span>{{ liveTag }}</span></div>
          <div class="ev-scroll">
            <AlertList :alerts="alerts" />
          </div>
        </div>

        <!-- 左下：机组负载（kpi 频道驱动） -->
        <div class="float f-bl">
          <div class="f-head"><h4>机组负载</h4><span>近 12 时</span></div>
          <div class="fv num">{{ kpiBand.totalFlow.toFixed(2) }}<small>万m³</small></div>
          <div class="spark" aria-hidden="true">
            <i v-for="(h, i) in sparkBars" :key="i" :style="{ height: h + '%' }" />
          </div>
        </div>

        <!-- 右下：告警处置漏斗 -->
        <div class="float f-br drill" @click="drill('/emergency')">
          <div class="f-head"><h4>告警处置漏斗</h4><span>本周</span></div>
          <FunnelChart :stages="funnelStages" class="f-funnel" />
        </div>

        <!-- 底部状态条 -->
        <div class="ck-foot">
          <span class="sm" :class="{ on: heroView === 'twin' }" @click="heroView = 'twin'">厂区孪生</span>
          <span class="sm" :class="{ on: heroView === 'topo' }" @click="heroView = 'topo'">供水拓扑</span>
          <span class="sm" :class="{ on: heroView === 'flow' }" @click="heroView = 'flow'">工艺流程</span>
          <span class="sm" :class="{ on: heroView === 'map' }" @click="heroView = 'map'">数据地图</span>
          <i class="foot-sep" aria-hidden="true" />
          <span class="sm" @click="drill('/cockpit-classic')">数据总览</span>
          <span class="sm" @click="drill('/billing')">收费总览</span>
          <span class="sm" @click="drill('/assessment')">统计考核</span>
          <div class="f-status">
            <span class="dot" :class="{ dim: !sseLive }" aria-hidden="true" />
            {{ sseLive ? '实时链路正常' : '模拟数据 · 链路降级' }} · 更新于 {{ updated }}
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FlipNumber from '@/components/cockpit/FlipNumber.vue';
import RankingBoard from '@/components/cockpit/RankingBoard.vue';
import FunnelChart from '@/components/cockpit/FunnelChart.vue';
import GlassPanel from '@/components/cockpit/GlassPanel.vue';
import WeatherCard from '@/components/cockpit/WeatherCard.vue';
import TwinPlant, { type TwinNode } from '@/components/cockpit/TwinPlant.vue';
import TopoRadial from '@/components/cockpit/TopoRadial.vue';
import ProcessFlow from '@/components/cockpit/ProcessFlow.vue';
import StyleMap from '@/components/cockpit/StyleMap.vue';
import AlertList from '@/views/pipe-network/AlertList.vue';
import { mockData } from '@mock/index';
import { realtime, realtimeState, onRealtime, apiFetch } from '@/composables/realtime';
import { mapAlert } from '@shared/backend';
import type { EmergencyEvent } from '@shared/types';

/** 旗县锚点（与 sumu-anchors 同源口径 · 一期固定苏尼特右旗） */
const COUNTY = '苏尼特右旗';
const LON = 112.65;
const LAT = 42.74;
const plantName = '苏尼特右旗第二水厂';

const router = useRouter();
const route = useRoute();
const offs: Array<() => void> = [];

/* ---------- live 数据（mock 起步 → 水合覆盖） ---------- */
const alerts = ref<EmergencyEvent[]>(mockData.alerts);

const kpiBand = ref({
  totalFlow: 1.42,
  onlineRate: 91.6,
  qualityRate: 98.2,
  alarm: 0,
  collectionRate: 76.3,
});

const ranking = ref<Array<{ name: string; value: number }>>([]);

/* ---------- 主视觉四态切换（厂区孪生 / 供水拓扑 / 工艺流程 / 数据地图） ---------- */
const heroView = ref<'twin' | 'topo' | 'flow' | 'map'>('twin');

/* ---------- 孪生场景节点（projects 聚合在线率 → 固定锚点） ---------- */
const NODE_ANCHORS = [
  { x: 1080, y: 320, tx: 1092, ty: 315 },
  { x: 1105, y: 520, tx: 1046, ty: 546 },
  { x: 90, y: 430, tx: 52, ty: 410 },
  { x: 160, y: 640, tx: 118, ty: 666 },
];
const suMuRates = ref<Array<{ name: string; value: number }>>([]);
/** 六苏木序列（拓扑/地图两态共用 · mock 回落用设计稿基准） */
const suMuSix = computed<Array<{ name: string; value: number }>>(() =>
  suMuRates.value.length >= 6
    ? suMuRates.value.slice(0, 6)
    : [
        { name: '赛汉塔拉镇', value: 94.2 },
        { name: '乌日根塔拉镇', value: 91.5 },
        { name: '朱日和镇', value: 92.8 },
        { name: '赛汉乌力吉苏木', value: 90.1 },
        { name: '桑宝拉格苏木', value: 88.7 },
        { name: '额仁淖尔苏木', value: 86.3 },
      ],
);
const twinNodes = computed<TwinNode[]>(() => {
  const src = suMuRates.value.length ? suMuRates.value : mockData.projects.slice(0, 4).map((p) => ({ name: p.name.slice(0, 5), value: p.status === 'normal' ? 94 : 86 }));
  return src.slice(0, 4).map((s, i) => ({ ...s, name: s.name.length > 6 ? s.name.slice(0, 6) : s.name, ...NODE_ANCHORS[i] }));
});

const poolLevel = ref(82);

/* ---------- 漏斗（告警→处置 · alerts 状态推导） ---------- */
const funnelStages = computed(() => {
  const a = alerts.value;
  const n = (status: string) => a.filter((x) => x.status === status).length;
  return [
    { name: '告警接入', value: a.length },
    { name: '确认派单', value: n('已派单') + n('未签收') },
    { name: '到场处置', value: n('已派单') + n('已签收') },
    { name: '办结归档', value: a.filter((x) => x.status === '已销号').length },
  ].map((s) => ({ ...s, value: Math.max(s.value, 1) }));
});

/* ---------- 机组负载 spark（确定性形态 · kpi 频道推尾） ---------- */
const sparkBars = ref<number[]>([38, 52, 44, 61, 58, 72, 66, 80, 74, 88, 82, 94]);

/* ---------- 链路状态 / 更新时间 ---------- */
const sseLive = computed(() => realtimeState.sseConnected);
const liveTag = computed(() => (sseLive.value ? 'SSE' : 'MOCK'));
const updated = ref('--:--');
let clockTimer: ReturnType<typeof setInterval> | undefined;

function drill(path: string): void {
  if (route.path !== path) router.push(path);
}

/* ---------- 水合 ---------- */
const INITIAL_MOCK_IDS = new Set(mockData.alerts.map((a) => a.id));

async function hydrate(): Promise<void> {
  const [sum, projItems] = await Promise.all([
    apiFetch<{ kpi: Record<string, number>; ranking: Array<{ name: string; score: number }> }>('/api/assessment/summary'),
    apiFetch<{ items: unknown[] }>('/api/projects'),
  ]);

  if (sum) {
    kpiBand.value.onlineRate = sum.kpi.onlineRate;
    kpiBand.value.collectionRate = sum.kpi.collectionRate;
    ranking.value = sum.ranking.map((r) => ({ name: r.name, value: r.score }));
    suMuRates.value = sum.ranking.map((r) => ({ name: r.name, value: r.score }));
  }
  if (projItems) {
    const items = projItems.items as Array<Record<string, unknown>>;
    // 苏木在线率：按 su_mu 聚合 status=normal 占比（孪生远端节点数据源）
    const byMu = new Map<string, { total: number; ok: number }>();
    for (const p of items) {
      const mu = String(p['su_mu'] || '未分苏木');
      const rec = byMu.get(mu) ?? { total: 0, ok: 0 };
      rec.total += 1;
      if (String(p['status']) === 'normal') rec.ok += 1;
      byMu.set(mu, rec);
    }
    if (byMu.size) {
      suMuRates.value = [...byMu.entries()]
        .map(([name, r]) => ({ name, value: (r.ok / r.total) * 100 }))
        .sort((a, b) => b.value - a.value);
    }
  }
  const alertItems = await apiFetch<{ items: unknown[] }>('/api/alerts');
  if (alertItems) {
    const stock = new Set(alertItems.items.map((a) => String((a as Record<string, unknown>).id)));
    const pending = alerts.value.filter((a) => !stock.has(a.id) && !INITIAL_MOCK_IDS.has(a.id));
    alerts.value = [...pending, ...alertItems.items.map((a) => mapAlert(a as Record<string, unknown>))].slice(0, 12);
    kpiBand.value.alarm = alertItems.items.filter((a) => (a as Record<string, unknown>).status === '未签收').length;
  }
}

/* ---------- 生命周期 ---------- */
onMounted(() => {
  realtime.start({ monitors: mockData.monitors, alertPool: mockData.alerts });

  offs.push(onRealtime('kpi', (evt) => {
    const d = evt.data as Record<string, number>;
    if (d.totalFlow) {
      kpiBand.value.totalFlow = d.totalFlow;
      sparkBars.value = [...sparkBars.value.slice(1), Math.min(96, Math.max(30, d.totalFlow * 65))];
    }
    if (d.onlineRate) kpiBand.value.onlineRate = d.onlineRate;
    if (d.qualityRate) kpiBand.value.qualityRate = d.qualityRate;
  }));

  offs.push(onRealtime('alert', (evt) => {
    const a = evt.data as unknown as EmergencyEvent;
    alerts.value = [a, ...alerts.value].slice(0, 12);
    kpiBand.value.alarm += a.status === '未签收' ? 1 : 0;
  }));

  const p2 = (n: number) => String(n).padStart(2, '0');
  const tick = () => {
    const d = new Date();
    updated.value = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };
  tick();
  clockTimer = setInterval(tick, 30_000);

  void hydrate();
});

onBeforeUnmount(() => {
  realtime.stop();
  offs.forEach((off) => off());
  if (clockTimer) clearInterval(clockTimer);
});
</script>

<style scoped>
.bg-deco {
  position: absolute;
  inset: 0;
  background: url('/img/cockpit-bg.webp') center / cover no-repeat;
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}
.cockpit {
  /* 数据墨水风局部覆盖（避开全局 tokens） */
  --night-navy: #0f1a2b;
  --well-deep: #0a1220;
  --line-vein: rgba(0, 194, 255, 0.14);
  --ck-coral: #ff6f52;
  --ck-line: rgba(0, 194, 255, 0.16);
  --ck-line-strong: rgba(0, 194, 255, 0.32);

  position: relative;
  width: 100%;
  height: 100%;
  padding: 16px 18px;
  background: var(--well-deep);
  overflow: hidden;
}
.cockpit > :not(.bg-deco) {
  position: relative;
  z-index: 1;
  height: 100%;
}

/* ===== 入场编排 ===== */
.ed {
  animation: ed-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--d, 0ms);
}
@keyframes ed-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .ed { animation: none; }
}

/* ===== 两栏骨架 ===== */
.ck-body {
  display: flex;
  gap: 14px;
  height: 100%;
  min-height: 0;
}
.ck-side {
  flex: none;
  width: 392px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}
.ck-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--ck-line);
  background: linear-gradient(180deg, rgba(10, 18, 32, 0.6), rgba(6, 12, 22, 0.72));
}

/* ===== 侧栏 ===== */
.rank-panel { flex: 1; overflow: hidden; }
.rank-panel :deep(.rb) { height: calc(100% - 24px); }

/* KPI 四宫格 */
.kpis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.kpis > * { min-height: 74px; }

/* ===== 主区 hero 标签 ===== */
/* ===== 主区 hero 容器 ===== */
.hero-wrap {
  position: absolute;
  inset: 0;
}
.foot-sep {
  width: 1px;
  height: 14px;
  background: rgba(0, 194, 255, 0.25);
  margin: 0 2px;
}

.hero-tag {
  position: absolute; left: 20px; top: 16px; z-index: 5;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; font-size: 12px; color: var(--text-dim);
  background: rgba(10, 18, 32, 0.55);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--ck-line); border-radius: 8px;
  pointer-events: none;
}
.hero-tag b { color: var(--text); font-weight: 600; margin-right: 6px; }
.dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #00ffe0; box-shadow: 0 0 8px #00ffe0;
  animation: dot-pulse 1.6s infinite;
}
.dot.dim { background: #6b7a8f; box-shadow: none; animation: none; }
@keyframes dot-pulse { 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) { .dot { animation: none; } }

/* ===== 毛玻璃浮层 ===== */
.float {
  position: absolute; z-index: 10;
  background: rgba(15, 26, 43, 0.5);
  backdrop-filter: blur(18px) saturate(1.5);
  -webkit-backdrop-filter: blur(18px) saturate(1.5);
  border: 1px solid var(--ck-line-strong);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition: border-color 0.2s ease, transform 0.2s ease;
}
.float:hover { border-color: rgba(0, 194, 255, 0.5); }
.f-tr { right: 16px; top: 16px; width: 320px; height: 300px; display: flex; flex-direction: column; }
.f-bl { left: 16px; bottom: 62px; min-width: 200px; }
.f-br { right: 16px; bottom: 62px; width: 300px; }

.f-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.f-head::before { content: ''; width: 3px; height: 11px; background: #00c2ff; border-radius: 2px; }
.f-head h4 { font-size: 12px; font-weight: 600; color: var(--text); margin: 0; }
.f-head span { font-size: 10px; color: var(--text-dim); margin-left: auto; }
.fv { font-size: 30px; font-weight: 700; line-height: 1; }
.fv small { font-size: 12px; color: var(--text-dim); font-weight: 400; margin-left: 3px; }

/* 事件流浮层：AlertList 自带 Panel → 去实底融合毛玻璃 */
.stream-wrap { cursor: pointer; }
.stream-wrap:hover { border-color: rgba(0, 194, 255, 0.5); }
.ev-scroll { flex: 1; min-height: 0; overflow: auto; scrollbar-width: none; }
.ev-scroll::-webkit-scrollbar { display: none; }
.stream-wrap :deep(.panel) {
  background: transparent;
  border: none;
  padding: 0;
  backdrop-filter: none;
}
.stream-wrap :deep(.panel .p-top),
.stream-wrap :deep(.panel .cn) { display: none; }
.stream-wrap :deep(.ptitle) { display: none; }

/* 机组 spark */
.spark { display: flex; align-items: flex-end; gap: 4px; height: 34px; margin-top: 10px; }
.spark i {
  flex: 1;
  background: linear-gradient(180deg, #00c2ff, rgba(0, 194, 255, 0.15));
  border-radius: 2px 2px 0 0;
  opacity: 0.85;
  transition: height 0.6s ease;
}

/* 漏斗浮层 */
.f-funnel { height: 132px; }

/* ===== 底部状态条 ===== */
.ck-foot {
  position: absolute; z-index: 5; left: 20px; right: 20px; bottom: 14px;
  display: flex; align-items: center; gap: 10px; height: 34px;
  padding: 0 14px; font-size: 11px; color: var(--text-dim);
  background: rgba(15, 26, 43, 0.45);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--ck-line); border-radius: 9px;
}
.ck-foot .sm { color: var(--text); padding: 3px 9px; border-radius: 6px; cursor: pointer; transition: background 0.15s ease; }
.ck-foot .sm:hover { background: rgba(0, 194, 255, 0.12); }
.ck-foot .sm.on { color: #00ffe0; background: rgba(0, 255, 224, 0.08); }
.f-status { margin-left: auto; display: flex; align-items: center; gap: 6px; }
</style>
