<!--
  AppShell.vue — 全局弹性布局壳（T1 轨道）
  · 根：flex 横向，100vh 铺满，min-width 1366px 兜底横滚
  · 主区全宽（AppTopbar 56px + router-view）· 菜单收进顶栏下拉（v8.1）
  · onMounted 启动全局实时引擎（realtime 模块级单例，_running 防重入；
    页面内的 start 调用幂等无害）——顶栏告警灯需要全局引擎
  · contentResizeTick：侧栏折叠 / 窗口 resize 后 +150ms（等 CSS 过渡结束）自增，
    图表组件 inject 后 watch 该 tick 补一次 resize
-->
<template>
  <div class="stage">
    <div class="shell" :style="shellStyle">
    <div class="main">
      <AppTopbar :res-tier="app.resTier" />
      <main class="content">
        <router-view />
      </main>
    </div>
    </div>
    <div v-if="dev" class="res-badge num">{{ resLabel }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import AppTopbar from '@ui/AppTopbar.vue';
import { useAppStore } from '@stores/app';
import { realtime } from '@/composables/realtime';

const app = useAppStore();
const dev = import.meta.env.DEV;

/** 统一模式：恒 1920×1080 逻辑画布 · fit 等比铺满任何屏（非 16:9 居中留黑）· 无手动档位 */
const shellStyle = computed(() => ({
  width: '1920px',
  height: '1080px',
  transform: `scale(${app.fitScale.toFixed(4)})`,
}));
const resLabel = computed(() => `${app.resTier} · s${app.fitScale.toFixed(2)}`);

function syncViewport(): void {
  app.viewport = { w: window.innerWidth, h: window.innerHeight };
}

/** 图表 resize 信号（轻量 provide/inject，替代事件总线） */
const contentResizeTick = ref(0);
provide('contentResizeTick', contentResizeTick);

let resizeTimer: ReturnType<typeof setTimeout> | null = null;
/** 150ms 防抖：等侧栏 200ms 过渡近尾/窗口布局稳定后再 bump */
function bumpTick(): void {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    contentResizeTick.value++;
  }, 150);
}



function onWinResize(): void {
  syncViewport();
  bumpTick();
}

onMounted(() => {
  syncViewport();
  realtime.start(); // 无参启动：仅 SSE 告警频道；页面随后传入数据池时因 _running 幂等跳过
  window.addEventListener('resize', onWinResize);
  unbindFs = app.bindFullscreenSync();
  watch(() => app.fullscreen, () => bumpTick()); // 全屏切换 → 面板显隐 → 图表 resize
});

let unbindFs: (() => void) | null = null;

onBeforeUnmount(() => {
  unbindFs?.();
  window.removeEventListener('resize', onWinResize);
  if (resizeTimer) clearTimeout(resizeTimer);
});
</script>

<style scoped>
.stage {
  width: 100vw;
  height: 100vh;
  background: #000; /* 留黑边：与屏体融合 */
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.shell {
  flex: none;
  display: flex;
  transform-origin: center center;
  background: var(--well-deep);
  overflow: hidden;
  position: relative;
}
.res-badge {
  position: absolute;
  right: 8px;
  bottom: 6px;
  z-index: 99;
  font-size: 11px;
  color: var(--text-dim);
  opacity: 0.4;
  pointer-events: none;
}
.main {
  position: relative; /* 全屏态顶栏浮层的定位锚点 */
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.content {
  flex: 1;
  min-height: 0;
}
</style>
