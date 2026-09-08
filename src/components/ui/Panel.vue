<!--
  Panel.vue — 基础面板（取代 IofTV 的 ItemWrap）
  视觉标准：docs/design/preview.html `.panel` + design-system §4 / §6.1
  · 1px line-vein 边框 + 圆角 2px + night-navy 底
  · 四角 12px L 形刻度角标（2px 粗，默认 flood-teal 50%，主角面板 75%）
  · 顶部 2px 状态条：default = flood-teal / alarm = alarm-red
  · 标题指针短线 24×2px（默认在标题左侧 = preview 事实标准，可切 under）
-->
<template>
  <section
    class="panel"
    :class="[`is-${variant}`, { 'is-hero': hero, 'line-under': titleLine === 'under' }]"
    :tabindex="focusable ? 0 : undefined"
    :role="focusable ? 'group' : undefined"
    :aria-label="title || undefined"
  >
    <!-- 顶部状态条（放在角标之前，保证角标压在上层） -->
    <i class="p-top" aria-hidden="true"></i>
    <i class="cn tl" aria-hidden="true"></i>
    <i class="cn tr" aria-hidden="true"></i>
    <i class="cn bl" aria-hidden="true"></i>
    <i class="cn br" aria-hidden="true"></i>

    <header v-if="title || sub || $slots.sub || $slots.extra" class="ptitle">
      <h3 v-if="title" class="pt">{{ title }}</h3>
      <span v-if="sub || $slots.sub" class="psub">
        <slot name="sub">{{ sub }}</slot>
      </span>
      <slot name="extra" />
    </header>

    <div class="pbody">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** default = flood-teal 顶条 · alarm = alarm-red 顶条 + 红色副标题 */
    variant?: 'default' | 'alarm';
    title?: string;
    sub?: string;
    /** 主角面板（地图/告警/弹窗）角标提亮至 75% */
    hero?: boolean;
    /** 标题指针短线位置：left（preview 事实标准）/ under（design-system §6.1 文字口径） */
    titleLine?: 'left' | 'under';
    /** 键盘可达（design-system §9 Tab 焦点可见） */
    focusable?: boolean;
  }>(),
  {
    variant: 'default',
    title: '',
    sub: '',
    hero: false,
    titleLine: 'left',
    focusable: true,
  },
);
</script>

<style scoped>
.panel {
  --corner: rgba(0, 194, 255, 0.5);
  --pbar: rgba(0, 194, 255, 0.45);
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--night-navy);
  border: var(--border-w) solid var(--line-vein);
  border-radius: var(--radius);
  padding: 16px 20px;
  transition: border-color 0.18s ease;
}
.panel.is-hero {
  --corner: rgba(0, 194, 255, 0.75);
}
.panel.is-alarm {
  --pbar: var(--status-alarm);
}

/* 顶部 2px 状态条 —— 绝对定位，不改变盒模型 */
.p-top {
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  height: var(--border-w-thick);
  background: var(--pbar);
  pointer-events: none;
}

/* 四角刻度角标 */
.cn {
  position: absolute;
  width: 12px;
  height: 12px;
  border: var(--border-w-thick) solid var(--corner);
  pointer-events: none;
  transition: border-color 0.18s ease;
}
.tl { top: -2px; left: -2px; border-right: none; border-bottom: none; }
.tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
.bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
.br { bottom: -2px; right: -2px; border-left: none; border-top: none; }

/* hover / focus 反馈 */
.panel:hover {
  border-color: rgba(0, 194, 255, 0.32);
}
.panel:hover .cn {
  border-color: rgba(0, 194, 255, 0.85);
}
.panel:focus-visible {
  outline: 2px solid var(--spring-green);
  outline-offset: 2px;
}

/* 标题行 */
.ptitle {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
  flex: none;
}
.ptitle::before {
  content: '';
  width: 24px;
  height: var(--border-w-thick);
  background: var(--flood-teal);
  align-self: center;
  flex: none;
}
.pt {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  margin: 0;
}
.psub {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.is-alarm .psub {
  color: var(--status-alarm);
  font-weight: 500;
}

/* 标题下短线变体（design-system §6.1 文字口径 / ModelViewer 同款） */
.line-under .ptitle {
  align-items: flex-start;
}
.line-under .ptitle::before {
  display: none;
}
.line-under .pt::after {
  content: '';
  display: block;
  width: 24px;
  height: var(--border-w-thick);
  background: var(--flood-teal);
  margin-top: 5px;
}

.pbody {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
