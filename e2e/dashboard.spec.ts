import { test, expect } from '@playwright/test';

test.describe('SL-GIS 大屏视觉回归', () => {
  test('dashboard 1920×1080 渲染', async ({ page }) => {
    // 冻结 WebGL 动画（Stage 钩子）
    await page.addInitScript(() => {
      (window as any).STAGE_FREEZE = true;
    });

    // 启动 dev server 后跑（pnpm dev 已在外层起）
    await page.goto('/dashboard', { waitUntil: 'networkidle', timeout: 15000 });

    // 给 ECharts + 翻牌 + Stage 一点点时间稳定
    await page.waitForTimeout(800);

    // 关键动态区遮罩（避免告警滚动时间/数字翻牌导致非确定性）
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: false, // 1920×1080 视口已覆盖
      mask: [
        page.locator('.clock, .alist, .aitem'),
      ],
    });
  });
});
