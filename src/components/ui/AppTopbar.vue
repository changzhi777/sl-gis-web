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

    <!-- 页面菜单：下拉分组（v8.1 侧栏 → 顶栏下拉） -->
    <div class="page-menu" ref="menuRoot">
      <button class="page-trigger" type="button" @click.stop="menuOpen = !menuOpen" :aria-expanded="menuOpen">
        <span class="page-title">{{ pageTitle }}</span>
        <span class="caret" aria-hidden="true">{{ menuOpen ? '▴' : '▾' }}</span>
      </button>
      <div v-if="menuOpen" class="menu-panel">
        <div v-for="g in MENU_GROUPS" :key="g.title" class="menu-group">
          <div class="menu-gtitle">{{ g.title }}</div>
          <button
            v-for="m in g.items"
            :key="m.path"
            type="button"
            class="menu-item"
            :class="{ active: isActive(m.path) }"
            @click="go(m.path)"
          >
            <svg class="mi" viewBox="0 0 16 16" aria-hidden="true"><path :d="m.icon" /></svg>
            <span>{{ m.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="search" role="search">
      <input
        v-model="query"
        class="search-input"
        type="text"
        placeholder="搜索工程名称 / 编码…"
        aria-label="全局搜索工程"
        @input="onQuery"
        @focus="openList = true"
        @blur="closeList"
        @keydown.enter="onPick(suggestions[0])"
        @keydown.esc="query = ''; openList = false"
      />
      <ul v-if="openList && suggestions.length" class="search-list">
        <li v-for="s in suggestions" :key="s.id">
          <button type="button" @mousedown.prevent="onPick(s)">
            <b class="num">{{ s.id }}</b><span>{{ s.name }}</span>
          </button>
        </li>
      </ul>
    </div>

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
import { useRoute, useRouter } from 'vue-router';
import { apiFetch, onRealtime } from '@/composables/realtime';
import { unpackItems } from '@shared/backend';
import { useMapFocusStore } from '@stores/mapFocus';
import { MENU_GROUPS } from '@ui/appMenu';
import type { Project } from '@shared/types';

/* ---------- 旗县切换（搬 TopBar.vue 口径：本地视觉状态，1 期不落库） ---------- */
const BANNERS = ['苏尼特右旗', '苏尼特左旗', '阿巴嘎旗', '西乌珠穆沁旗', '东乌珠穆沁旗'];
const banner = ref(BANNERS[0]);

/* ---------- 当前页名：meta.title 优先，缺省回退路由 path ---------- */
const route = useRoute();
const router = useRouter();
const menuRoot = ref<HTMLElement | null>(null);
const menuOpen = ref(false);
const pageTitle = computed(() => {
  const t = route.meta.title;
  return typeof t === 'string' && t ? t : route.path;
});
function isActive(path: string): boolean {
  return route.path === path || (path === '/archives' && route.path.startsWith('/archives'));
}
function go(path: string): void {
  menuOpen.value = false;
  if (route.path !== path) router.push(path);
}
function onDocClick(e: MouseEvent): void {
  if (menuOpen.value && menuRoot.value && !menuRoot.value.contains(e.target as Node)) {
    menuOpen.value = false;
  }
}

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

/* ---------- 全局搜索：工程名/编码前缀匹配 → 跳一张图定位 ---------- */
const focusStore = useMapFocusStore();
const query = ref('');
const openList = ref(false);
const projects = ref<Project[]>([]);

const suggestions = computed<Project[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return projects.value
    .filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    .slice(0, 5);
});

function onQuery(): void {
  openList.value = true;
}
function closeList(): void {
  // 延时让 mousedown.pick 先于 blur 生效
  setTimeout(() => { openList.value = false; }, 120);
}
function onPick(p?: Project): void {
  if (!p) return;
  query.value = '';
  openList.value = false;
  focusStore.request(p);
  if (route.path !== '/dashboard') router.push('/dashboard');
}

onMounted(async () => {
  document.addEventListener('click', onDocClick);
  // 搜索数据源（一次性缓存）
  const projItems = unpackItems(await apiFetch('/api/projects'));
  if (projItems) projects.value = projItems.map((p) => ({
    id: String(p['code']),
    name: String(p['name']),
    grade: p['grade'] as Project['grade'],
    status: p['status'] as Project['status'],
    coord: [Number(p['lon']), Number(p['lat'])],
    suMu: String(p['su_mu']),
    responsible: '',
    metrics: {},
  }));

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
  document.removeEventListener('click', onDocClick);
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

/* 全局搜索 */
.search {
  position: relative;
  margin-left: 4px;
}
.search-input {
  width: 200px;
  padding: 5px 10px;
  font-size: 12px;
  color: var(--text);
  background: rgba(3, 8, 18, 0.6);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  outline: none;
  transition: border-color 0.15s ease, width 0.2s ease;
}
.search-input::placeholder { color: var(--text-dim); opacity: 0.7; }
.search-input:focus {
  border-color: rgba(0, 255, 224, 0.5);
  width: 240px;
}
.search-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: rgba(3, 8, 18, 0.95);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
}
.search-list button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text);
  background: none;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  text-align: left;
}
.search-list button:hover { background: rgba(0, 194, 255, 0.1); }
.search-list b { color: var(--spring-green); flex: none; }
.search-list span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-menu { position: relative; }
.page-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: transparent;
  border: var(--border-w) solid transparent;
  border-radius: var(--radius);
  cursor: pointer;
}
.page-trigger:hover { border-color: var(--line-vein); }
.page-trigger .page-title { color: var(--text); overflow: visible; }
.caret { font-size: 10px; color: var(--text-dim); }
.menu-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 40;
  display: flex;
  gap: 18px;
  padding: 14px 16px;
  background: rgba(3, 8, 18, 0.96);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.menu-group { min-width: 110px; }
.menu-gtitle {
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--text-dim);
  opacity: 0.6;
  padding-bottom: 6px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--line-vein);
  white-space: nowrap;
}
.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  font-size: 13px;
  color: var(--text);
  background: none;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
}
.menu-item:hover { background: rgba(0, 194, 255, 0.1); }
.menu-item.active { color: #00ffe0; background: rgba(0, 255, 224, 0.07); }
.mi {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
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
