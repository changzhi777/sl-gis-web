<!--
  AppTopbar.vue — 全局顶栏 56px（弹性布局骨架 T1）
  · 左：产品名「旗县供水统管平台」+ 旗县切换下拉 + 当前页名（route.meta.title）
  · 右：时钟 HH:mm:ss（每秒）+ 告警灯（未签收数 + 红色脉冲圆点）
  · 告警灯：apiFetch('/api/alerts') 取存量未签收数，onRealtime('alert') 增量 +1
-->
<template>
  <header class="topbar" :class="{ 'fs-mode': app.fullscreen, 'fs-idle': fsIdle }">
    <div class="brand">
      <span class="name">旗县供水统管平台</span>
      <select v-model="banner" class="county-sel" aria-label="旗县切换">
        <option v-for="b in BANNERS" :key="b" :value="b">{{ b }}</option>
      </select>
    </div>

    <!-- 页面菜单：一级按钮横排 + 点击弹出二级（v8.5） -->
    <nav class="nav-groups" ref="menuRoot" aria-label="主导航">
      <div v-for="(g, gi) in MENU_GROUPS" :key="g.title" class="nav-group">
        <button
          class="nav-gbtn"
          :class="{ open: openGroup === gi, active: groupActive(gi) }"
          type="button"
          :aria-expanded="openGroup === gi"
          @click.stop="toggleGroup(gi)"
        >
          {{ g.title }}
          <span class="caret" aria-hidden="true">{{ openGroup === gi ? '▴' : '▾' }}</span>
        </button>
          <div v-if="openGroup === gi" class="sub-panel">
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
    </nav>

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
      <span v-show="!app.fullscreen" class="clock num">{{ clock }}</span>
      <span v-show="!app.fullscreen" class="lamp" :title="`未签收告警 ${alarmCount} 条`">
        <i class="dot" aria-hidden="true"></i>
        <b class="num">{{ alarmCount }}</b>
        <span class="lamp-text">未签收告警</span>
      </span>
      <span v-show="!app.fullscreen" class="res-tier num" :title="`等效渲染分辨率 ${resTier}`">{{ resTier }}</span>
      <button
        class="fs-btn"
        type="button"
        :aria-label="app.fullscreen ? '退出全屏' : '进入全屏'"
        :title="app.fullscreen ? '退出全屏' : '进入全屏'"
        @click="app.toggleFullscreen()"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path :d="app.fullscreen ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'" />
        </svg>
        <span v-if="!app.fullscreen" class="fs-text">全屏</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiFetch, onRealtime } from '@/composables/realtime';
import { unpackItems } from '@shared/backend';
import { useMapFocusStore } from '@stores/mapFocus';
import { useAppStore } from '@stores/app';
import { MENU_GROUPS } from '@ui/appMenu';
import type { Project } from '@shared/types';

defineProps<{ resTier: string }>();

/* ---------- 旗县切换（搬 TopBar.vue 口径：本地视觉状态，1 期不落库） ---------- */
const BANNERS = ['苏尼特右旗', '苏尼特左旗', '阿巴嘎旗', '西乌珠穆沁旗', '东乌珠穆沁旗'];
const banner = ref(BANNERS[0]);

/* ---------- 当前页名：meta.title 优先，缺省回退路由 path ---------- */
const route = useRoute();
const router = useRouter();
const menuRoot = ref<HTMLElement | null>(null);
const openGroup = ref<number | null>(null);
function toggleGroup(gi: number): void {
  openGroup.value = openGroup.value === gi ? null : gi;
}
/** 当前路由所在组的序号（一级按钮高亮） */
function groupActive(gi: number): boolean {
  return MENU_GROUPS[gi].items.some((m) => isActive(m.path));
}
function isActive(path: string): boolean {
  return route.path === path || (path === '/archives' && route.path.startsWith('/archives'));
}
function go(path: string): void {
  openGroup.value = null;
  if (route.path !== path) router.push(path);
}
function onDocClick(e: MouseEvent): void {
  if (openGroup.value !== null && menuRoot.value && !menuRoot.value.contains(e.target as Node)) {
    openGroup.value = null;
  }
}

/* ---------- 时钟 HH:mm:ss 每秒 ---------- */
const clock = ref('');
let clockTimer: ReturnType<typeof setInterval> | undefined;
const app = useAppStore();
let unbindFs: (() => void) | null = null;
/** 全屏态静置 8s 淡出迷你条；鼠标活动唤回 */
const fsIdle = ref(false);
let idleTimer: ReturnType<typeof setTimeout> | null = null;
function wakeFsBar(): void {
  if (!app.fullscreen) return;
  fsIdle.value = false;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { fsIdle.value = true; }, 8000);
}
function onFsPointer(): void {
  if (app.fullscreen) wakeFsBar();
}
/** 4K 档在非 4K 物理屏的提示（一次性） */
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
  document.addEventListener('mousemove', onFsPointer);
  unbindFs = app.bindFullscreenSync();
  watch(() => app.fullscreen, (fs) => {
    if (fs) wakeFsBar();
    else if (idleTimer) clearTimeout(idleTimer);
  });
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
  document.removeEventListener('mousemove', onFsPointer);
  unbindFs?.();
  if (clockTimer) clearInterval(clockTimer);
  offAlert?.();
});
</script>

<style scoped>
.topbar {
  flex: none;
  height: 56px;
  transition: opacity 0.3s ease;
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

.nav-groups {
  display: flex;
  align-items: stretch;
  gap: 2px;
  min-width: 0;
}
.nav-group { position: relative; }
.nav-gbtn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--text);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.nav-gbtn:hover { color: var(--spring-green); }
/* 当前路由所在组：文字高亮 + 下缘指示条 */
.nav-gbtn.active {
  color: #00ffe0;
  border-bottom-color: var(--spring-green);
}
/* 打开态：保持高亮 */
.nav-gbtn.open {
  color: #00ffe0;
  background: rgba(0, 194, 255, 0.08);
}
.caret { font-size: 10px; color: var(--text-dim); }

/* 二级下拉 */
.sub-panel {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  z-index: 40;
  min-width: 168px;
  padding: 6px;
  background: rgba(3, 8, 18, 0.96);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.sub-panel::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 20px;
  width: 8px;
  height: 8px;
  transform: rotate(45deg);
  background: rgba(3, 8, 18, 0.96);
  border-left: var(--border-w) solid var(--line-vein);
  border-top: var(--border-w) solid var(--line-vein);
}
.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
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
.res-tier {
  flex: none;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--spring-green);
  background: rgba(0, 194, 255, 0.08);
  border: var(--border-w) solid rgba(0, 194, 255, 0.3);
  border-radius: var(--radius);
  letter-spacing: 1px;
}

.fs-btn {
  flex: none;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px;
  font-size: 12px;
  color: var(--text-dim);
  background: transparent;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}
.fs-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}
.fs-btn:hover {
  color: var(--spring-green);
  background: rgba(0, 194, 255, 0.1);
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

/* ===== 全屏态：32px 迷你浮条（absolute 不占布局 · 静置 8s 淡出） ===== */
.topbar.fs-mode {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  height: 32px;
  gap: 14px;
  padding: 0 14px;
  background: linear-gradient(180deg, rgba(3, 8, 18, 0.72), rgba(3, 8, 18, 0));
  border-bottom: none;
}
.topbar.fs-mode.fs-idle {
  opacity: 0;
  pointer-events: none;
}
.topbar.fs-mode .brand .name,
.topbar.fs-mode .search {
  display: none;
}
.topbar.fs-mode .county-sel { font-size: 12px; }
.topbar.fs-mode .clock { font-size: 14px; }
.topbar.fs-mode .fs-text { display: none; }
.topbar.fs-mode .res-tier { display: none; }
</style>
