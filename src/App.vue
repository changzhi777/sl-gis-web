<template>
  <AppShell />
</template>

<script setup lang="ts">
import AppShell from '@/layouts/AppShell.vue';
</script>

<style>
/* 纵向铺满不出滚动；min-width:1366px 兜底时允许横向滚动 */
body { overflow-x: auto; overflow-y: hidden; }
</style>
