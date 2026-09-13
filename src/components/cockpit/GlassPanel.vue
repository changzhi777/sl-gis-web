<!--
  GlassPanel.vue — 驾驶舱毛玻璃面板（数据墨水风 · backdrop-blur）
  与全局 Panel.vue（L 形角标实底风）区分：本组件是 cockpit v2 两栏体系的圆角毛玻璃风
  · 标题竖条渐变 + 副标 · hover 边框提亮 · 可下钻（drill 模式显示 ↗）
-->
<template>
  <section class="gp" :class="{ drill }">
    <span v-if="drill" class="drill-mark" aria-hidden="true">↗</span>
    <header v-if="title || sub" class="gp-head">
      <i class="gp-bar" aria-hidden="true" />
      <h3>{{ title }}</h3>
      <span v-if="sub" class="gp-sub">{{ sub }}</span>
      <slot name="extra" />
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string; sub?: string; drill?: boolean }>(), {
  title: '',
  sub: '',
  drill: false,
});
</script>

<style scoped>
.gp {
  position: relative;
  background: rgba(15, 26, 43, 0.55);
  backdrop-filter: blur(24px) saturate(1.5);
  -webkit-backdrop-filter: blur(24px) saturate(1.5);
  border: 1px solid rgba(0, 194, 255, 0.16);
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 6px 20px rgba(0, 0, 0, 0.3);
  transition: border-color 0.2s ease;
  min-height: 0;
}
.gp.drill { cursor: pointer; }
.gp.drill:hover { border-color: rgba(0, 194, 255, 0.45); }
.drill-mark {
  position: absolute; top: 12px; right: 14px; z-index: 2;
  font-size: 12px; color: rgba(157, 178, 198, 0.6);
  transition: color 0.18s ease, transform 0.18s ease;
}
.gp.drill:hover .drill-mark { color: #00ffe0; transform: translate(1px, -1px); }

.gp-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
.gp-bar {
  width: 3px; height: 13px; border-radius: 2px; align-self: center; flex: none;
  background: linear-gradient(180deg, #00c2ff, #00ffe0);
}
.gp-head h3 { font-size: 14px; font-weight: 600; margin: 0; line-height: 1.2; }
.gp-sub { font-size: 11px; color: var(--text-dim); }
</style>
