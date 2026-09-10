/**
 * app.ts — 全局应用状态（全屏模式等）
 * 状态唯一事实源 = fullscreenchange 事件：按钮 click 只调 FS API，
 * ESC/F11 退出由事件监听回写状态，避免按钮态卡死
 */
import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    fullscreen: false,
  }),
  actions: {
    async toggleFullscreen(): Promise<void> {
      try {
        if (!this.fullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        /* 非用户手势 / iframe 未授权等被拒：状态由 fullscreenchange 统一管理，静默即可 */
      }
    },
    bindFullscreenSync(): () => void {
      const sync = () => {
        this.fullscreen = !!document.fullscreenElement;
      };
      document.addEventListener('fullscreenchange', sync);
      sync();
      return () => document.removeEventListener('fullscreenchange', sync);
    },
  },
});
