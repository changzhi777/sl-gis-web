<template>
  <div id="app-loading">
    <div class="boot">
      <div class="title">SL-GIS · 旗县供水统管平台</div>
      <div class="sub">阶段 2.5 总装待启动</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 阶段 2.5 由主 agent 重写为 DashboardLayout + 路由接线
</script>

<style>
#app-loading{display:flex;align-items:center;justify-content:center;height:100vh;background:var(--well-deep)}
.boot{text-align:center}.title{font-size:24px;color:var(--flood-teal);font-weight:600;letter-spacing:2px}
.sub{margin-top:8px;font-size:13px;color:var(--text-dim)}
</style>
