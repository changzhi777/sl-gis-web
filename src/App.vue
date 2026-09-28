<template>
  <!-- meta.bare 路由（登录页）：独立布局；其余：AppShell 壳 -->
  <router-view v-if="route.meta.bare" />
  <AppShell v-else />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import AppShell from '@/layouts/AppShell.vue';

const route = useRoute();
</script>

<style>
/* 纵向铺满不出滚动；min-width:1366px 兜底时允许横向滚动 */
body { overflow-x: auto; overflow-y: hidden; }
</style>
