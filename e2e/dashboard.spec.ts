import { test, expect } from '@playwright/test';

test.describe('SL-GIS 大屏视觉回归', () => {
  test('dashboard 1920×1080 渲染', async ({ page }) => {
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

test.describe('全站导航冒烟', () => {
  const routes = [
    ['/dashboard', '工程一张图'],
    ['/scada', '运行监控'],
    ['/emergency', '应急调度'],
    ['/water-quality', '水质管理'],
    ['/archives', '工程档案'],
    ['/patrol', '巡检工单'],
    ['/billing', '收费服务'],
    ['/public-service', '公众服务'],
    ['/assessment', '统计考核'],
    ['/system', '系统管理'],
  ];

  for (const [path, title] of routes) {
    test(`路由 ${path} 渲染`, async ({ page }) => {
      await page.goto('/sl-gis' + path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.screen')).toBeVisible();
      await expect(page).toHaveTitle(/SL-GIS/);
      // 当前路由所在组恰有一个一级按钮高亮
      await expect(page.locator('.nav-gbtn.active')).toHaveCount(1);
    });
  }
});
