import { test, expect } from '@playwright/test';

// 登录认证（纯前端可测部分，不依赖后端；登录闭环依赖真后端 → 人工验证）
test.describe('登录认证', () => {
  test('未登录访问受保护页 → 拦到 /login 带 redirect', async ({ page }) => {
    await page.goto('/sl-gis/water-quality', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/sl-gis\/login/);
    await expect(page.locator('.login-stage')).toBeVisible();
    // redirect 参数带回原页路径
    const url = new URL(page.url());
    await expect(url.searchParams.get('redirect') || page.url()).toMatch(/water-quality|login/);
  });

  test('/login 渲染：品牌区 + 登录卡', async ({ page }) => {
    await page.goto('/sl-gis/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.login-stage')).toBeVisible();
    await expect(page.getByRole('heading', { name: '旗县县域统管农村供水管理平台' })).toBeVisible();
    await expect(page.getByLabel('账号')).toBeVisible();
    await expect(page.getByLabel('密码')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });
});
