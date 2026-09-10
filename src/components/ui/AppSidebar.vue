<!--
  AppSidebar.vue — 全局侧边栏分组导航（弹性布局骨架 T1）
  · 6 组 10 页菜单；展开 216px / 折叠 56px（200ms ease）
  · 激活态：左缘 2px spring-green 竖条 + 文字 #00FFE0 + 背景 rgba(0,255,224,.07)
  · 折叠态：只显 16px 图标，hover 单项浮出 140px 名称 tooltip
  · 折叠切换结束（等 200ms CSS 过渡）后 emit('collapsed-change') 供主区图表 resize
-->
<template>
  <aside class="sidebar" :class="{ collapsed }">
    <nav class="nav" aria-label="主导航">
      <template v-for="g in GROUPS" :key="g.title">
        <div class="gtitle">{{ g.title }}</div>
        <router-link
          v-for="it in g.items"
          :key="it.path"
          :to="it.path"
          class="item"
          :class="{ active: isActive(it.path) }"
        >
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
            <path :d="it.icon" />
          </svg>
          <span class="label">{{ it.label }}</span>
          <span class="tip" role="tooltip">{{ it.label }}</span>
        </router-link>
      </template>
    </nav>

    <button
      class="toggle"
      type="button"
      :aria-label="collapsed ? '展开侧栏' : '收起侧栏'"
      @click="toggleCollapsed"
    >
      <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
        <path :d="collapsed ? CHEV_RIGHT : CHEV_LEFT" />
      </svg>
    </button>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';

/** 折叠切换结束后通知（AppShell → contentResizeTick → 图表 resize） */
const emit = defineEmits<{ (e: 'collapsed-change'): void }>();

/* ---------- 菜单数据（与 router 一一对应；icon 为 16×16 描边 SVG path） ---------- */
interface MenuItem {
  path: string;
  label: string;
  /** 16×16 描边图标 path（stroke 用） */
  icon: string;
}
interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const GROUPS: MenuGroup[] = [
  {
    title: '态势总览',
    items: [
      { path: '/dashboard', label: '工程一张图', icon: 'M1.5 3.5 5.5 2l5 1.5 4-1.5v10l-4 1.5-5-1.5-4 1.5zM5.5 2v10.5M10.5 3.5V14' },
    ],
  },
  {
    title: '运行监测',
    items: [
      { path: '/scada', label: '运行监控', icon: 'M1 8.5h3.5L6.5 4l3 8 1.5-3.5H15' },
      { path: '/water-quality', label: '水质管理', icon: 'M8 1.8C8 1.8 3.2 7 3.2 10.2a4.8 4.8 0 0 0 9.6 0C12.8 7 8 1.8 8 1.8Z' },
    ],
  },
  {
    title: '应急管理',
    items: [
      { path: '/emergency', label: '应急调度', icon: 'M8 2.2 14.6 13.6H1.4L8 2.2ZM8 6.8v3M8 12.2v.01' },
    ],
  },
  {
    title: '业务管理',
    items: [
      { path: '/archives', label: '工程档案', icon: 'M2.2 5.2h11.6V14H2.2V5.2ZM2.2 5.2 3.6 2h8.8l1.4 3.2M6.3 8.6h3.4' },
      { path: '/patrol', label: '巡检工单', icon: 'M5.2 2.6h5.6v2H5.2v-2ZM4.2 3.6H2.4V14h11.2V3.6h-1.8M5.2 8h5.6M5.2 11h3.6' },
      { path: '/billing', label: '收费服务', icon: 'M8 1.6a6.4 6.4 0 1 0 0 12.8A6.4 6.4 0 0 0 8 1.6ZM5.6 4.6 8 8l2.4-3.4M8 8v4.2M5.9 9.3h4.2M5.9 11h4.2' },
      { path: '/public-service', label: '公众服务', icon: 'M5.8 7.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8ZM1.6 13.6c0-2.5 1.9-3.9 4.2-3.9s4.2 1.4 4.2 3.9M11 3a2.2 2.2 0 0 1 0 4.4M12.2 9.9c1.5.5 2.4 1.7 2.4 3.7' },
    ],
  },
  {
    title: '决策支持',
    items: [
      { path: '/assessment', label: '统计考核', icon: 'M1.8 14.2h12.4M4.2 14V9.4M8 14V4.6M11.8 14V6.8' },
    ],
  },
  {
    title: '系统',
    items: [
      { path: '/system', label: '系统管理', icon: 'M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8ZM8 1.6v1.8M8 12.6v1.8M1.6 8h1.8M12.6 8h1.8M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3' },
    ],
  },
];

/** 收合按钮 chevron */
const CHEV_LEFT = 'M9.5 3.5 5 8l4.5 4.5';
const CHEV_RIGHT = 'M6.5 3.5 11 8l-4.5 4.5';

/* ---------- 折叠状态 ---------- */
const collapsed = ref(false);
let toggleTimer: ReturnType<typeof setTimeout> | null = null;

/** 激活项跟随路由：精确匹配或子路径（/archives/:id 归入 工程档案） */
const route = useRoute();
function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}

/** 折叠切换：220ms（等 200ms CSS 过渡结束）后再 emit，供图表按最终尺寸 resize */
function toggleCollapsed(): void {
  collapsed.value = !collapsed.value;
  if (toggleTimer) clearTimeout(toggleTimer);
  toggleTimer = setTimeout(() => emit('collapsed-change'), 220);
}
</script>

<style scoped>
.sidebar {
  flex: none;
  width: 216px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--night-navy);
  border-right: var(--border-w) solid var(--line-vein);
  transition: width 0.2s ease;
  overflow: visible; /* 折叠态 tooltip 需浮出右缘 */
}
.sidebar.collapsed {
  width: 56px;
}

.nav {
  flex: 1;
  min-height: 0;
  padding: 8px 0 4px;
  overflow-y: auto;
  overflow-x: hidden;
}
/* 折叠态不裁剪，tooltip 才能浮出 */
.sidebar.collapsed .nav {
  overflow: visible;
  padding-top: 8px;
}

/* ===== 组标题 ===== */
.gtitle {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--text-dim);
  opacity: 0.6;
  white-space: nowrap;
  user-select: none;
}
.sidebar.collapsed .gtitle {
  /* 折叠态隐藏组标题（保高度节奏：占 28px 透明占位会让间距更碎，直接不渲染视觉） */
  height: 12px;
  font-size: 0;
  padding: 0;
}
.sidebar.collapsed .gtitle::before {
  content: '';
  display: block;
  width: 24px;
  height: 1px;
  margin: 0 auto;
  background: var(--line-vein);
}

/* ===== 菜单项 ===== */
.item {
  position: relative;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 0 18px;
  font-size: 13px;
  color: var(--text);
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.14s ease, color 0.14s ease;
}
.item:hover {
  background: rgba(0, 194, 255, 0.08);
}
/* 激活态：左缘 2px 竖条 + 高亮文字 */
.item.active {
  color: #00ffe0;
  background: rgba(0, 255, 224, 0.07);
}
.item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--spring-green);
}
.item:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: -2px;
}

.icon {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.sidebar.collapsed .item {
  justify-content: center;
  padding: 0;
}

.label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== 折叠态 tooltip（hover 浮出 140px 名称） ===== */
.tip {
  display: none;
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  width: max-content;
  max-width: 140px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text);
  background: var(--surface-blue);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  box-shadow: none;
  pointer-events: none;
  z-index: 30;
}
.sidebar.collapsed .item:hover .tip {
  display: block;
}

/* ===== 折叠态 hover：整栏临时展开为覆盖层（absolute · 不推挤主区地图） ===== */
.sidebar.collapsed:hover .nav {
  position: absolute;
  top: 0;
  left: 0;
  width: 216px;
  height: 100%;
  background: var(--night-navy);
  border-right: var(--border-w) solid var(--line-vein);
  box-shadow: 8px 0 24px rgba(0, 0, 0, 0.45);
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 30;
}
.sidebar.collapsed:hover .gtitle {
  height: 28px;
  font-size: 11px;
  letter-spacing: 2px;
  padding: 0 16px;
  opacity: 0.6;
}
.sidebar.collapsed:hover .gtitle::before {
  display: none;
}
.sidebar.collapsed:hover .item {
  justify-content: flex-start;
  padding: 0 12px 0 18px;
}
.sidebar.collapsed:hover .item .tip {
  display: none; /* 整栏已展开，tooltip 冗余 */
}

/* ===== 底部收合按钮 ===== */
.toggle {
  flex: none;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  background: transparent;
  border: none;
  border-top: var(--border-w) solid var(--line-vein);
  cursor: pointer;
  transition: color 0.14s ease, background 0.14s ease;
}
.toggle:hover {
  color: var(--spring-green);
  background: rgba(0, 194, 255, 0.08);
}
.toggle:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: -2px;
}
</style>
