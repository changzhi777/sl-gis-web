import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const p = await ctx.newPage();
const logs = [];
p.on('console', m => { if (m.type()==='error' || m.type()==='warning') logs.push(m.type()+': '+m.text().slice(0,200)); });
p.on('pageerror', e => logs.push('PAGEERR: '+e.message));
await p.goto('http://127.0.0.1:5180/sl-gis/dashboard', { waitUntil: 'networkidle' });
await p.waitForTimeout(4500);
const probe = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const r = c?.getBoundingClientRect();
  return {
    hasCanvas: !!c,
    cssW: r?.width, cssH: r?.height,
    pxW: c?.width, pxH: c?.height,
    pxToCssRatio: c ? c.width/r.width : null,
  };
});
console.log('PROBE:', JSON.stringify(probe, null, 2));
console.log('LOGS:'); logs.forEach(l => console.log('  '+l));
await b.close();
