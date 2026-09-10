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
  <div class="shell">
    <div class="main">
      <AppTopbar />
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import AppTopbar from '@ui/AppTopbar.vue';
import { useAppStore } from '@stores/app';
import { realtime } from '@/composables/realtime';

const app = useAppStore();

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

function onWindowResize(): void {
  bumpTick();
}

onMounted(() => {
  realtime.start(); // 无参启动：仅 SSE 告警频道；页面随后传入数据池时因 _running 幂等跳过
  window.addEventListener('resize', onWindowResize);
  unbindFs = app.bindFullscreenSync();
  watch(() => app.fullscreen, () => bumpTick()); // 全屏切换 → 面板显隐 → 图表 resize
});

let unbindFs: (() => void) | null = null;

onBeforeUnmount(() => {
  unbindFs?.();
  window.removeEventListener('resize', onWindowResize);
  if (resizeTimer) clearTimeout(resizeTimer);
});
</script>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  min-width: 1366px; /* 非 16:9 / 窄屏兜底：超出出横滚 */
  background: var(--well-deep);
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
