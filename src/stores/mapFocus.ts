/**
 * mapFocus.ts — 全局搜索 → 一张图定位的跨页状态
 * AppTopbar 搜索选中 → request(project) + 跳转 /dashboard
 * Dashboard 页 watch pending → 选中 + 地图聚焦后 acknowledge()
 */
import { defineStore } from 'pinia';
import type { Project } from '@shared/types';

export const useMapFocusStore = defineStore('map-focus', {
  state: () => ({
    pending: null as Project | null,
    /** 请求序号：同一工程连续请求也能触发 watch */
    tick: 0,
  }),
  actions: {
    request(project: Project) {
      this.pending = project;
      this.tick++;
    },
    acknowledge() {
      this.pending = null;
    },
  },
});
