<!--
  TopBar.vue — 顶栏 48px
  视觉标准：preview.html `header`
  · 左：平台名 + 旗县下拉 + 视图下拉
  · 右：4 KPI（Rajdhani 26px glow）+ 告警红徽标（描边块 + 20px 大数字 + 脉冲灯）+ 时间 16px
-->
<template>
  <header class="topbar">
    <div class="logo">
      {{ platform }} ·
      <select class="county-sel" :value="banner" aria-label="旗县切换" @change="onBanner">
        <option v-for="b in banners" :key="b" :value="b">{{ b }}</option>
      </select>
    </div>
  <NavTabs />
    <div class="county">
      视图
      <select :value="view" aria-label="视图切换" @change="onView">
        <option v-for="v in views" :key="v" :value="v">{{ v }}</option>
      </select>
    </div>

    <div class="k">
      <KpiCard
        v-for="k in kpis"
        :key="k.label"
        layout="inline"
        glow
        :value="k.value"
        :unit="k.unit"
        :label="k.label"
      />
      <button
        class="alarm-lamp"
        type="button"
        :aria-label="`${alarmCount} 条告警，点击查看`"
        @click="emit('alarm-click')"
      >
        <i aria-hidden="true"></i><b class="num">{{ alarmCount }}</b> 条告警
      </button>
    </div>

    <div class="clock num">{{ time || clock }}</div>
  </header>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import KpiCard from './KpiCard.vue';
import NavTabs from './NavTabs.vue';

interface TopKpi {
  value: number;
  unit?: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    platform?: string;
    banner?: string;
    banners?: string[];
    view?: string;
    views?: string[];
    kpis?: TopKpi[];
    alarmCount?: number;
    /** 外部注入时间字符串；缺省用内部时钟 */
    time?: string;
  }>(),
  {
    platform: '旗县供水统管平台',
    banner: '苏尼特右旗',
    banners: () => ['苏尼特右旗', '苏尼特左旗', '阿巴嘎旗', '西乌珠穆沁旗', '东乌珠穆沁旗'],
    view: '全域',
    views: () => ['全域', '按苏木乡镇'],
    kpis: () => [
      { value: 46, label: '集中供水工程' },
      { value: 98.2, unit: '%', label: '水质合格率' },
      { value: 91.6, unit: '%', label: '设备在线率' },
      { value: 1.42, unit: '万m³', label: '当日供水量' },
    ],
    alarmCount: 3,
    time: '',
  },
);

const emit = defineEmits<{
  (e: 'update:banner', v: string): void;
  (e: 'update:view', v: string): void;
  (e: 'alarm-click'): void;
}>();

function onBanner(ev: Event) {
  emit('update:banner', (ev.target as HTMLSelectElement).value);
}
function onView(ev: Event) {
  emit('update:view', (ev.target as HTMLSelectElement).value);
}

/** 内部时钟 MM-DD HH:mm */
const clock = ref('');
let timer: ReturnType<typeof setInterval> | undefined;
const p2 = (n: number) => String(n).padStart(2, '0');

function tick() {
  const d = new Date();
  clock.value = `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

onMounted(() => {
  if (props.time) return;
  tick();
  timer = setInterval(tick, 15_000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.topbar {
  height: 48px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 20px;
  border-bottom: var(--border-w) solid var(--line-vein);
  background: linear-gradient(180deg, rgba(12, 35, 64, 0.9), rgba(7, 21, 37, 0.4));
}
.logo {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 1px;
  white-space: nowrap;
}
.county-sel {
  background: transparent;
  border: none;
  color: var(--spring-green);
  font-family: var(--cn);
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 1px;
  padding: 0 2px;
  cursor: pointer;
}
.county-sel option {
  background: var(--surface-blue);
  color: var(--text);
  font-size: 13px;
  font-weight: 400;
}
.county {
  font-size: 13px;
  color: var(--text-dim);
  white-space: nowrap;
}
.county select {
  background: var(--surface-blue);
  color: var(--text);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  padding: 2px 8px;
  font-family: var(--cn);
  cursor: pointer;
}

.k {
  margin-left: auto;
  display: flex;
  gap: 28px;
  align-items: baseline;
}

/* 告警红徽标：描边块 + 20px 大数字 + 脉冲灯 */
.alarm-lamp {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #ff9e9e;
  padding: 4px 12px 4px 16px;
  border: var(--border-w) solid rgba(255, 92, 92, 0.55);
  background: rgba(255, 92, 92, 0.1);
  border-radius: var(--radius);
  margin-left: 16px;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease;
}
.alarm-lamp:hover {
  background: rgba(255, 92, 92, 0.18);
  border-color: rgba(255, 92, 92, 0.8);
}
.alarm-lamp b {
  font-weight: 700;
  font-size: 20px;
  color: var(--status-alarm);
}
.alarm-lamp i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-alarm);
  box-shadow: 0 0 8px var(--status-alarm);
  animation: lamp-pulse 1.2s infinite;
}
@keyframes lamp-pulse {
  50% { opacity: 0.3; }
}

.clock {
  font-size: 16px;
  color: var(--text-dim);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .alarm-lamp i { animation: none; }
}
</style>
