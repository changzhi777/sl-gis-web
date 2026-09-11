/**
 * app.ts — 全局应用状态（全屏模式等）
 * 状态唯一事实源 = fullscreenchange 事件：按钮 click 只调 FS API，
 * ESC/F11 退出由事件监听回写状态，避免按钮态卡死
 */
import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    fullscreen: false,
    /** 渲染分辨率档：1080P（1920×1080·zoom1）/ 4K（3840×2160·zoom2） */
    scaleTier: '1080p' as '1080p' | '4k',
  }),
  getters: {
    /** 逻辑画布尺寸（px 设计值 × 档位倍率） */
    canvasW: (s) => (s.scaleTier === '4k' ? 3840 : 1920),
    canvasH: (s) => (s.scaleTier === '4k' ? 2160 : 1080),
    canvasZoom: (s) => (s.scaleTier === '4k' ? 2 : 1),
  },
  actions: {
    /** 档位切换 + localStorage 记忆（键 sl-gis.scale-tier） */
    setScaleTier(tier: '1080p' | '4k') {
      this.scaleTier = tier;
      localStorage.setItem('sl-gis.scale-tier', tier);
    },
    /** 首访按物理分辨率自动选档（screen.width×dpr ≥3840 → 4K），之后信任 localStorage */
    initScaleTier() {
      const saved = localStorage.getItem('sl-gis.scale-tier');
      if (saved === '1080p' || saved === '4k') {
        this.scaleTier = saved;
        return;
      }
      const physW = (window.screen?.width ?? 1920) * (window.devicePixelRatio || 1);
      const physH = (window.screen?.height ?? 1080) * (window.devicePixelRatio || 1);
      this.scaleTier = physW >= 3840 && physH >= 2160 ? '4k' : '1080p';
    },
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
