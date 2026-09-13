<!--
  WeatherCard.vue — 旗县天气卡（和风真数据 · 供水联动引擎提示）
  · apiFetch /api/weather 聚合端点（实况/预警/分钟级/指数/空气/联动tips）· 失败回落 mock
  · 动效：预警横幅呼吸脉冲 + ⚠闪烁 + 联动提示轮播 + 太阳光晕 + stagger 入场（prefers-reduced-motion 静默）
  · tips 结构由后端规则引擎算好（大风→泵站电源 / 低温→防冻 / 连旱→保供 / 高温→高峰 / 短时雨→巡检窗口）
-->
<template>
  <GlassPanel title="旗县天气" :sub="`${county} · 实况${live ? '' : ' · 演示'}`" class="weather">
    <div class="w-now">
      <div>
        <div class="w-big num">{{ mock.now.temp }}<small>°C</small></div>
        <div class="w-phen"><span class="sun-ico">{{ wIcon }}</span> {{ mock.now.text }}</div>
      </div>
      <div class="w-desc">
        体感 {{ mock.now.feelsLike }}°C<br />
        湿度 {{ mock.now.humidity }}% · {{ mock.now.windDir }} {{ mock.now.windScale }}级<br />
        降水 {{ mock.now.precip }}mm
      </div>
    </div>

    <!-- 预警横幅（后端 tips.kind=warning · 官方预警 + 联动动作） -->
    <div v-if="warnTip" class="w-alert" :title="`${warnTip.detail} → ${warnTip.action}`">
      <span class="wa-ico">{{ warnTip.icon }}</span>
      <div class="wa-txt">
        <b>{{ warnTip.text }}</b>
        <span>联动：{{ warnTip.action }}</span>
      </div>
    </div>

    <!-- 供水联动提示轮播（连旱/防冻/高峰/短时雨） -->
    <div v-if="rotateTips.length" class="w-tips">
      <div class="wt-track" :class="{ paused: rotateTips.length < 2 }">
        <div v-for="t in rotateTips" :key="t.kind" class="wt-item">{{ t.icon }} {{ t.text }} · {{ t.action }}</div>
        <div v-if="rotateTips.length > 1" class="wt-item" aria-hidden="true">{{ rotateTips[0].icon }} {{ rotateTips[0].text }} · {{ rotateTips[0].action }}</div>
      </div>
    </div>

    <div class="w-days">
      <div v-for="(d, i) in days" :key="d.fxDate" class="w-day" :title="`${d.textDay}转${d.textNight}`">
        <div class="wd">{{ dayLabel(i, d.fxDate) }}</div>
        <div class="wdi">{{ dIcon(d) }}</div>
        <div class="wdt num">{{ d.tempMax }}° <i>/ {{ d.tempMin }}°</i></div>
      </div>
    </div>
  </GlassPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiFetch } from '@/composables/realtime';
import GlassPanel from '@/components/cockpit/GlassPanel.vue';

/** 后端 /api/weather 聚合结构（精简字段） */
interface WeatherTip {
  kind: string;
  level: string;
  icon: string;
  text: string;
  detail: string;
  action: string;
}
interface WeatherDay {
  fxDate: string;
  textDay: string;
  textNight: string;
  iconDay: string;
  tempMax: string;
  tempMin: string;
  precip: string;
}
interface WeatherData {
  enabled?: boolean;
  updateTime?: string;
  now: {
    temp: string;
    feelsLike: string;
    text: string;
    icon: string;
    windDir: string;
    windScale: string;
    windSpeed?: string;
    humidity: string;
    precip: string;
  };
  daily: WeatherDay[];
  warning?: Array<{ title: string; typeName: string; level: string }>;
  tips: WeatherTip[];
}

const props = withDefaults(defineProps<{ county?: string; lon?: number; lat?: number }>(), {
  county: '苏尼特右旗',
  lon: 112.65,
  lat: 42.74,
});

/** mock 基准（后端不可达时回落 · 与设计稿一致） */
const mock = ref<WeatherData>({
  now: { temp: '10', feelsLike: '8', text: '晴', icon: '100', windDir: '西北风', windScale: '4级', humidity: '41', precip: '0.0' },
  daily: [
    { fxDate: '', textDay: '晴', textNight: '晴', iconDay: '100', tempMax: '18', tempMin: '6', precip: '0.0' },
    { fxDate: '', textDay: '晴', textNight: '晴', iconDay: '100', tempMax: '22', tempMin: '11', precip: '0.0' },
    { fxDate: '', textDay: '晴', textNight: '晴', iconDay: '100', tempMax: '28', tempMin: '11', precip: '0.0' },
    { fxDate: '', textDay: '晴', textNight: '晴', iconDay: '100', tempMax: '28', tempMin: '15', precip: '0.0' },
  ],
  tips: [
    { kind: 'warning', level: '蓝色', icon: '⚠', text: '大风蓝色预警（生效中）', detail: '内蒙古气象台发布', action: '泵站备用电源检查' },
    { kind: 'drought', level: '黄色', icon: '🌵', text: '连旱 5 日 · 旱情保供预案', detail: '未来一周无有效降水', action: '水源水位加密监测' },
  ],
});
const live = ref(false);

const warnTip = computed<WeatherTip | undefined>(() => mock.value.tips.find((t) => t.kind === 'warning'));
const rotateTips = computed<WeatherTip[]>(() => mock.value.tips.filter((t) => t.kind !== 'warning'));
const days = computed<WeatherDay[]>(() => mock.value.daily.slice(0, 4));

const wIcon = computed(() => {
  const icon = mock.value.now.icon;
  if (icon === '100' || icon === '150') return '☀️';
  if (icon.startsWith('1')) return '🌤️';
  if (icon.startsWith('2')) return '🌫️';
  if (icon.startsWith('3')) return '☁️';
  if (icon.startsWith('4')) return '🌧️';
  if (icon.startsWith('5')) return '🌨️';
  return '☀️';
});

function dIcon(d: WeatherDay): string {
  if (d.iconDay === '100' || d.iconDay === '150') return '☀️';
  if (d.iconDay.startsWith('1')) return '🌤️';
  if (d.iconDay.startsWith('3')) return '☁️';
  if (d.iconDay.startsWith('4')) return '🌧️';
  if (d.iconDay.startsWith('5')) return '🌨️';
  return '⛅';
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function dayLabel(i: number, fxDate: string): string {
  if (i === 0) return '今天';
  if (!fxDate) return `+${i}天`;
  const d = new Date(`${fxDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? `+${i}天` : WEEK[d.getDay()];
}

onMounted(async () => {
  const data = await apiFetch<WeatherData>(`/api/weather?lon=${props.lon}&lat=${props.lat}`);
  if (data && data.enabled && data.now) {
    mock.value = data;
    live.value = true;
  }
});
</script>

<style scoped>
/* ===== 天气卡 v2（毛玻璃 · 墨水风局部） ===== */
.weather {
  background: linear-gradient(160deg, rgba(0, 194, 255, 0.10), rgba(15, 26, 43, 0.6) 55%);
}
.w-now { display: flex; align-items: center; gap: 16px; }
.w-big { font-size: 42px; font-weight: 700; line-height: 1; color: var(--text); animation: w-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both 0.15s; }
.w-big small { font-size: 15px; color: var(--text-dim); font-weight: 400; margin-left: 2px; }
.w-phen { font-size: 13px; color: var(--spring-green); font-weight: 600; margin-top: 2px; animation: w-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both 0.25s; }
.sun-ico { display: inline-block; animation: sun-breathe 3.2s ease-in-out infinite; filter: drop-shadow(0 0 5px rgba(255, 205, 90, 0.75)); }
.w-desc { margin-left: auto; text-align: right; font-size: 12px; color: var(--text-dim); line-height: 1.8; animation: w-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both 0.35s; }

/* 预警横幅（呼吸脉冲 · 图标闪烁） */
.w-alert {
  display: flex; gap: 9px; align-items: center; margin-top: 11px; padding: 7px 10px; border-radius: 7px;
  background: rgba(255, 111, 82, 0.10); border: 1px solid rgba(255, 111, 82, 0.35);
  animation: w-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both 0.45s, alert-breathe 2.2s ease-in-out infinite 1.2s;
  cursor: pointer;
}
.w-alert:hover { border-color: rgba(255, 111, 82, 0.7); }
.wa-ico { color: var(--ck-coral); font-size: 14px; animation: alert-blink 1.2s steps(2) infinite; }
.wa-txt { min-width: 0; }
.wa-txt b { display: block; font-size: 12px; color: #ff9e8a; }
.wa-txt span { font-size: 10px; color: var(--text-dim); }

/* 联动提示轮播 */
.w-tips {
  height: 27px; overflow: hidden; margin-top: 8px; border-radius: 7px;
  border: 1px solid rgba(0, 194, 255, 0.12); background: rgba(0, 194, 255, 0.04);
  animation: w-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both 0.55s;
}
.wt-track { display: flex; flex-direction: column; animation: tips-roll 8s cubic-bezier(0.4, 0, 0.2, 1) infinite 1.5s; }
.wt-track.paused { animation: none; }
.wt-item { height: 27px; line-height: 26px; font-size: 11px; color: var(--steppe-amber); padding: 0 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.w-days { display: flex; margin-top: 10px; gap: 6px; animation: w-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both 0.65s; }
.w-day { flex: 1; text-align: center; padding: 8px 4px; background: rgba(0, 194, 255, 0.05); border: 1px solid rgba(0, 194, 255, 0.1); border-radius: 8px; transition: border-color 0.18s ease, background 0.18s ease; }
.w-day:hover { border-color: rgba(0, 194, 255, 0.45); background: rgba(0, 194, 255, 0.09); }
.w-day .wd { font-size: 11px; color: var(--text-dim); }
.w-day .wdi { font-size: 15px; margin: 3px 0; }
.w-day .wdt { font-size: 13px; font-weight: 600; }
.w-day .wdt i { font-style: normal; color: var(--text-dim); font-weight: 400; }

@keyframes w-in { from { opacity: 0; transform: translateY(8px); } }
@keyframes sun-breathe { 50% { transform: scale(1.14); filter: drop-shadow(0 0 11px rgba(255, 205, 90, 1)); } }
@keyframes alert-breathe { 50% { background: rgba(255, 111, 82, 0.17); border-color: rgba(255, 111, 82, 0.62); } }
@keyframes alert-blink { 50% { opacity: 0.3; } }
@keyframes tips-roll { 0%, 42% { transform: translateY(0); } 54%, 96% { transform: translateY(-27px); } 100% { transform: translateY(0); } }

@media (prefers-reduced-motion: reduce) {
  .w-big, .w-phen, .w-desc, .w-alert, .w-tips, .w-days { animation: none; }
  .sun-ico, .wa-ico, .wt-track { animation: none !important; }
}
</style>
