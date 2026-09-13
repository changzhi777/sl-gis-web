<!--
  ProcessFlow.vue — 供水全流程工艺流水线（C 稿落地 · 驾驶舱可切换视图）
  · 六站点横向流水线（水源→泵站→净水车间→清水池→配水泵房→牧户）+ 回水支线 + 四阶段分组
  · 数据绑定：清水池挂真液位 · 净水车间挂真水质合格率 · 其余为工艺基准口径
  · 动效纪律：仅 transform/background-position/opacity · prefers-reduced-motion 静默
-->
<template>
  <div class="pf">
    <div class="pf-phases">
      <div v-for="p in PHASES" :key="p.t" class="pf-phase">
        <b>{{ p.t }}</b><span class="ps">{{ p.s }}</span><span class="pf-arrow">→</span>
      </div>
    </div>

    <div class="pf-line">
      <template v-for="(s, i) in stations" :key="s.name">
        <div v-if="i > 0" class="pf-pipe">
          <span class="pf-pv num">{{ s.in }}</span>
          <i />
        </div>
        <div class="pf-station" :class="{ warn: s.warn }">
          <span class="st-dot" aria-hidden="true" />
          <div class="st-head">
            <span class="st-ico">{{ s.icon }}</span>
            <div class="st-tt">
              <div class="st-name">{{ s.name }}</div>
              <div class="st-sub">{{ s.sub }}</div>
            </div>
          </div>
          <div class="st-val num">{{ s.value }}<small>{{ s.unit }}</small></div>
          <div class="st-k">{{ s.k }}</div>
        </div>
      </template>
    </div>

    <div class="pf-return" aria-hidden="true"><i /></div>
    <span class="pf-return-tag">⤴ 反冲洗排水 / 污泥回流 · 22 m³/h 回收处理</span>
    <div class="pf-note">水源 → 牧户 · {{ stations.length }} 站点实时贯通</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface FlowStation {
  name: string;
  icon: string;
  sub: string;
  value: string;
  unit: string;
  k: string;
  in?: string;
  warn?: boolean;
}

const props = withDefaults(
  defineProps<{
    /** 清水池真液位 % */
    poolLevel?: number;
    /** 水质合格率真值 % */
    qualityRate?: number;
  }>(),
  {
    poolLevel: 82,
    qualityRate: 98.2,
  },
);

const PHASES = [
  { t: '水源段', s: '取水保障' },
  { t: '制水段', s: '净化处理' },
  { t: '输配段', s: '加压输送' },
  { t: '用户段', s: '牧户末端' },
];

/** 站点序列 · 管道流量 in 沿程递减（工艺基准口径 · 清水池/净水挂真值） */
const stations = computed<FlowStation[]>(() => {
  const flow = ['512 m³/h', '508 m³/h', '502 m³/h', '498 m³/h', '495 m³/h'];
  return [
    { name: '深井水源', icon: '🕳️', sub: '6 眼 · 静水位 42m', value: '2,140', unit: 'm³', k: '日取水量 · 动水位 55m' },
    { name: '取水泵站', icon: '⚙️', sub: '3 机组 · 2运1备', value: '0.38', unit: 'MPa', k: '出口压力 · 电流 42A', warn: true },
    { name: '净水车间', icon: '🧪', sub: '四段工艺 · 达标', value: props.qualityRate.toFixed(1), unit: '%', k: '水质合格率 · 全段达标', in: flow[2] },
    { name: '清水池', icon: '💧', sub: '2×1500m³', value: String(props.poolLevel), unit: '%', k: '液位 · 3,020m³', in: flow[3] },
    { name: '配水泵房', icon: '🔧', sub: '变频恒压', value: '0.32', unit: 'MPa', k: '管网压力 · 2运1备', in: flow[4] },
    { name: '牧户用水', icon: '🏠', sub: '4,860 户 · 抄表 92.4%', value: '486', unit: 'm³/h', k: '实时末端流量 · 0.21MPa' },
  ];
});
</script>

<style scoped>
.pf {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 20px 88px;
  gap: 0;
}
.pf::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(560px 300px at 50% 52%, rgba(0, 194, 255, 0.1), transparent 70%),
    linear-gradient(rgba(0, 194, 255, 0.05) 1px, transparent 1px) 0 0 / 100% 132px,
    radial-gradient(900px 520px at 50% 52%, transparent 58%, rgba(0, 194, 255, 0.05) 59%, transparent 61%);
}

.pf-phases {
  position: absolute;
  top: 86px;
  left: 4%;
  right: 4%;
  display: flex;
  gap: 8px;
  pointer-events: none;
}
.pf-phase {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 2px;
  border: 1px dashed rgba(0, 194, 255, 0.18);
  border-radius: 8px;
  background: rgba(0, 194, 255, 0.03);
}
.pf-phase b { color: #00c2ff; font-weight: 600; }
.pf-phase .ps { letter-spacing: 1px; }
.pf-arrow { color: rgba(0, 194, 255, 0.4); letter-spacing: 0; }

.pf-line {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 0;
  position: relative;
  z-index: 1;
}
.pf-station {
  position: relative;
  flex: none;
  width: 172px;
  background: rgba(15, 26, 43, 0.68);
  backdrop-filter: blur(16px) saturate(1.5);
  -webkit-backdrop-filter: blur(16px) saturate(1.5);
  border: 1px solid rgba(0, 194, 255, 0.16);
  border-radius: 12px;
  padding: 14px 13px 12px;
  transition: border-color 0.2s ease, transform 0.2s ease;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.pf-station:hover { border-color: rgba(0, 194, 255, 0.45); transform: translateY(-3px); }
.pf-station .st-dot {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7ee081;
  box-shadow: 0 0 8px #7ee081;
  animation: pf-pulse 1.8s infinite;
}
.pf-station.warn .st-dot { background: var(--steppe-amber); box-shadow: 0 0 8px var(--steppe-amber); }
@keyframes pf-pulse { 50% { opacity: 0.3; } }

.st-head { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
.st-ico {
  width: 34px;
  height: 34px;
  flex: none;
  display: grid;
  place-items: center;
  background: rgba(0, 194, 255, 0.1);
  border: 1px solid rgba(0, 194, 255, 0.3);
  border-radius: 9px;
  font-size: 17px;
}
.st-tt { min-width: 0; }
.st-name { font-size: 13.5px; font-weight: 600; }
.st-sub { font-size: 10px; color: var(--text-dim); }
.st-val { font-size: 24px; font-weight: 700; color: #00ffe0; line-height: 1.15; }
.st-val small { font-size: 11px; color: var(--text-dim); font-weight: 400; margin-left: 2px; }
.st-k { font-size: 10px; color: var(--text-dim); margin-top: 3px; }

.pf-pipe {
  position: relative;
  flex: none;
  width: 52px;
  align-self: center;
  height: 56px;
}
.pf-pipe::before {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  top: 50%;
  height: 8px;
  transform: translateY(-50%);
  background: rgba(0, 194, 255, 0.12);
  border-top: 1px solid rgba(0, 194, 255, 0.3);
  border-bottom: 1px solid rgba(0, 194, 255, 0.3);
}
.pf-pipe i {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  background: repeating-linear-gradient(90deg, #00c2ff 0 8px, transparent 8px 20px);
  background-size: 20px 4px;
  animation: pf-flow 1.2s linear infinite;
  border-radius: 2px;
  filter: drop-shadow(0 0 4px rgba(0, 194, 255, 0.8));
}
@keyframes pf-flow { to { background-position-x: -20px; } }
.pf-pv {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--text-dim);
  white-space: nowrap;
}

.pf-return {
  position: absolute;
  left: 12%;
  right: 12%;
  bottom: 96px;
  height: 2px;
  background: repeating-linear-gradient(90deg, rgba(255, 180, 84, 0.7) 0 6px, transparent 6px 16px);
  background-size: 16px 2px;
  animation: pf-flow 2.4s linear infinite reverse;
  opacity: 0.6;
}
.pf-return i {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 100%;
}
.pf-return-tag {
  position: absolute;
  bottom: 68px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--steppe-amber);
  background: rgba(255, 180, 84, 0.08);
  border: 1px solid rgba(255, 180, 84, 0.22);
  padding: 3px 10px;
  border-radius: 6px;
}
.pf-note {
  position: absolute;
  bottom: 34px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 11px;
  color: var(--text-dim);
  opacity: 0.8;
}

@media (prefers-reduced-motion: reduce) {
  .pf-pipe i, .pf-return, .pf-station .st-dot { animation: none; }
}
</style>
