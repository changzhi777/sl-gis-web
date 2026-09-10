<template>
  <nav class="nav-tabs">
    <router-link
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="nav-tab"
      :class="{ active: isActive(tab.path) }"
    >{{ tab.label }}</router-link>
  </nav>
</template>
<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
const tabs = [
  { path: '/dashboard', label: '工程一张图' },
  { path: '/scada', label: '运行监控' },
  { path: '/emergency', label: '应急调度' },
  { path: '/archives', label: '工程档案' },
  { path: '/water-quality', label: '水质管理' },
  { path: '/patrol', label: '巡检工单' },
  { path: '/billing', label: '收费服务' },
  { path: '/public-service', label: '公众服务' },
  { path: '/assessment', label: '统计考核' },
  { path: '/system', label: '系统管理' },
];
const isActive = (path: string) => route.path === path;
</script>
<style scoped>
.nav-tabs { display: flex; gap: 4px; }
.nav-tab {
  color: #9DB2C6; font-size: 13px; padding: 4px 14px;
  border: 1px solid rgba(0,194,255,.15); border-radius: 2px;
  text-decoration: none; transition: all .2s; background: rgba(7,21,37,.6);
}
.nav-tab.active, .nav-tab:hover {
  color: #00FFE0; border-color: rgba(0,255,224,.4);
  background: rgba(0,194,255,.08);
}
</style>
