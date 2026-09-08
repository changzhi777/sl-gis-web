import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:5180/sl-gis/dashboard', { waitUntil: 'networkidle' });
await p.waitForTimeout(4500);
const info = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  // 测 9 个点
  const pts = [];
  for (const [dx, dy] of [[0,0],[0.25,0.25],[-0.25,-0.25],[0.4,0.4],[-0.4,-0.4],[0,0.45],[0,-0.45],[0.45,0],[-0.45,0]]) {
    const x = Math.floor(c.width*(0.5+dx));
    const y = Math.floor(c.height*(0.5+dy));
    const px = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    pts.push(`${(dx*100)|0},${(dy*100)|0}%: rgba=${[...px].join(',')}`);
  }
  // 找 canvas 在 stage 的 bbox 数据
  return pts.join('\n');
});
console.log(info);
await b.close();
