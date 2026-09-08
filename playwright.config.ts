import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 500,
      maxDiffPixelRatio: 0.005,
      animations: 'disabled',
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:5173/sl-gis/',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // 大屏静态稿视觉回归；本地开发不强制（CI 才卡）
  ignoreSnapshots: !process.env.CI,
});
