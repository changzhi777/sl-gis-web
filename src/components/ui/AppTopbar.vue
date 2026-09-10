<!--
  AppTopbar.vue — 全局顶栏 56px（弹性布局骨架 T1）
  · 左：产品名「旗县供水统管平台」+ 旗县切换下拉 + 当前页名（route.meta.title）
  · 右：时钟 HH:mm:ss（每秒）+ 告警灯（未签收数 + 红色脉冲圆点）
  · 告警灯：apiFetch('/api/alerts') 取存量未签收数，onRealtime('alert') 增量 +1
-->
<template>
  <header class="topbar">
    <div class="brand">
      <span class="name">旗县供水统管平台</span>
      <select v-model="banner" class="county-sel" aria-label="旗县切换">
        <option v-for="b in BANNERS" :key="b" :value="b">{{ b }}</option>
      </select>
    </div>

    <span class="page-title">{{ pageTitle }}</span>

    <div class="right">
      <span class="clock num">{{ clock }}</span>
      <span class="lamp" :title="`未签收告警 ${alarmCount} 条`">
        <i class="dot" aria-hidden="true"></i>
        <b class="num">{{ alarmCount }}</b>
        <span class="lamp-text">未签收告警</span>
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { apiFetch, onRealtime } from '@/composables/realtime';
import { unpackItems } from '@shared/backend';

/* ---------- 旗县切换（搬 TopBar.vue 口径：本地视觉状态，1 期不落库） ---------- */
const BANNERS = ['苏尼特右旗', '苏尼特左旗', '阿巴嘎旗', '西乌珠穆沁旗', '东乌珠穆沁旗'];
const banner = ref(BANNERS[0]);

/* ---------- 当前页名：meta.title 优先，缺省回退路由 path ---------- */
const route = useRoute();
const pageTitle = computed(() => {
  const t = route.meta.title;
  return typeof t === 'string' && t ? t : route.path;
});

/* ---------- 时钟 HH:mm:ss 每秒 ---------- */
const clock = ref('');
let clockTimer: ReturnType<typeof setInterval> | undefined;
const p2 = (n: number) => String(n).padStart(2, '0');
function tickClock(): void {
  const d = new Date();
  clock.value = `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

/* ---------- 告警灯：存量未签收数 + alert 频道增量 ---------- */
const alarmCount = ref(0);
let offAlert: (() => void) | null = null;

onMounted(async () => {
  tickClock();
  clockTimer = setInterval(tickClock, 1000);

  // 存量：GET /api/alerts → 未签收计数（无后端静默为 0，由 SSE/mock 增量接管）
  const items = unpackItems(await apiFetch('/api/alerts'));
  if (items) {
    alarmCount.value = items.filter((a) => a['status'] === '未签收').length;
  }

  // 增量：每条告警事件 +1（全局引擎 AppShell 已启动，此处只订阅）
  offAlert = onRealtime('alert', () => {
    alarmCount.value += 1;
  });
});

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
  offAlert?.();
});
</script>

<style scoped>
.topbar {
  flex: none;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 20px;
  background: linear-gradient(180deg, rgba(12, 35, 64, 0.9), rgba(7, 21, 37, 0.4));
  border-bottom: var(--border-w) solid var(--line-vein);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}
.name {
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 1px;
}
.county-sel {
  background: transparent;
  border: none;
  color: var(--spring-green);
  font-family: var(--cn);
  font-weight: 700;
  font-size: 15px;
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

.page-title {
  font-size: 13px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.page-title::before {
  content: '/';
  margin-right: 10px;
  color: var(--line-vein);
}

.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 24px;
}

.clock {
  font-size: 16px;
  color: var(--text-dim);
  white-space: nowrap;
}

/* 告警灯：数字 + 红色脉冲圆点 */
.lamp {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  font-size: 13px;
  color: #ff9e9e;
  background: rgba(255, 92, 92, 0.1);
  border: var(--border-w) solid rgba(255, 92, 92, 0.55);
  border-radius: var(--radius);
  white-space: nowrap;
}
.lamp b {
  font-weight: 700;
  font-size: 16px;
  color: var(--status-alarm);
}
.lamp-text {
  font-size: 12px;
}
.lamp .dot {
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

@media (prefers-reduced-motion: reduce) {
  .lamp .dot { animation: none; }
}
</style>
