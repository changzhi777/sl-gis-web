import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';
const PORT = process.env.PORT || 5180;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const p = await ctx.newPage();
await p.addInitScript(() => { window.STAGE_FREEZE = true; });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type()==='error') errs.push('console.error: ' + m.text()); });
const resp = await p.goto(`http://127.0.0.1:${PORT}/sl-gis/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
await p.waitForTimeout(2500);
const buf = await p.screenshot({ fullPage: false, type: 'png' });
writeFileSync('docs/dashboard.png', buf);
console.log('saved bytes:', buf.length);
console.log('title:', await p.title());
console.log('errors:', JSON.stringify(errs, null, 2));
const stats = await p.evaluate(() => ({
  canvases: document.querySelectorAll('canvas').length,
  panels: document.querySelectorAll('[class*=panel]').length,
  topbar: document.querySelector('header') ? 'yes' : 'no',
}));
console.log('stats:', JSON.stringify(stats, null, 2));
await b.close();
