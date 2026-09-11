/**
 * app.ts — 全局应用状态（全屏模式等）
 * 状态唯一事实源 = fullscreenchange 事件：按钮 click 只调 FS API，
 * ESC/F11 退出由事件监听回写状态，避免按钮态卡死
 */
import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    fullscreen: false,
    /** 视口尺寸（AppShell resize 时同步）——等效分辨率由此推导 */
    viewport: { w: window.innerWidth, h: window.innerHeight },
  }),
  getters: {
    /** fit 等比：min(vw/1920, vh/1080) · 任何屏铺满无裁切 */
    fitScale: (s) => Math.min(s.viewport.w / 1920, s.viewport.h / 1080),
    /** 等效渲染宽度 = 1920 × fit：≥3600 显示 4K · ≥1800 显示 1080P · 否则 HD */
    resTier(): string {
      const eff = this.fitScale * 1920;
      return eff >= 3600 ? '4K' : eff >= 1800 ? '1080P' : 'HD';
    },
  },
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
