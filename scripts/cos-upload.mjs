/**
 * cos-upload.mjs — 零依赖把 dist/ 上传腾讯云 COS（CNB CI 用）
 * 自实现 COS XML API 签名（q-sign-algorithm=sha1），无需 cos-nodejs-sdk-v5
 * 环境变量：SL-GIS-SECRET-ID / SL-GIS-SECRET-KEY / TENCENT_APPID
 *          TENCENT_BUCKET(默认 sl-gis-static) / TENCENT_REGION(默认 ap-guangzhou) / TENCENT_PREFIX(默认 sl-gis)
 */
import { createHmac, createHash } from 'crypto';
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';

const SECRET_ID = process.env['SL-GIS-SECRET-ID'];
const SECRET_KEY = process.env['SL-GIS-SECRET-KEY'];
const APPID = process.env['TENCENT_APPID'];
const BUCKET = process.env['TENCENT_BUCKET'] || 'sl-gis-static';
const REGION = process.env['TENCENT_REGION'] || 'ap-guangzhou';
const PREFIX = (process.env['TENCENT_PREFIX'] || 'sl-gis').replace(/\/+$/, '');
const DIST = 'dist';

if (!SECRET_ID || !SECRET_KEY || !APPID) {
  console.error('❌ 缺少 SL-GIS-SECRET-ID / SL-GIS-SECRET-KEY / TENCENT_APPID（仓库 设置→密钥 配置）');
  process.exit(1);
}
if (!existsSync(DIST)) { console.error('❌ dist/ 不存在'); process.exit(1); }

const sha1hex = (s) => createHash('sha1').update(s).digest('hex');
const hmac = (k, s) => createHmac('sha1', k).update(s).digest('hex');

/** COS 签名（仅签 host 头） */
function authHeader(method, host, pathname) {
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now - 60};${now + 600}`;
  const signKey = hmac(SECRET_KEY, keyTime);
  const httpString = `${method.toLowerCase()}\n${pathname.toLowerCase()}\n\nhost=${host.toLowerCase()}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1hex(httpString)}\n`;
  const sig = hmac(signKey, stringToSign);
  return `q-sign-algorithm=sha1&q-ak=${SECRET_ID}&q-sign-time=${keyTime}&q-key-time=${keyTime}` +
    `&q-header-list=host&q-url-param-list=&q-signature=${sig}`;
}

const MIME = {
  '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css',
  '.html': 'text/html', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.map': 'application/json',
};

const files = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
})(DIST);

const host = `${BUCKET}-${APPID}.cos.${REGION}.myqcloud.com`;
console.log(`→ 上传 ${files.length} 文件 → ${host}/${PREFIX}/`);

let ok = 0, fail = 0;
for (const f of files) {
  const key = `${PREFIX}/${relative(DIST, f).split('\\').join('/')}`;
  const ext = f.slice(f.lastIndexOf('.'));
  const cache = ext === '.html' ? 'max-age=300' : ext === '.json' ? 'max-age=86400' : 'max-age=31536000';
  const res = await fetch(`https://${host}/${key.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    headers: {
      Host: host,
      Authorization: authHeader('PUT', host, '/' + key),
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': `public, ${cache}`,
    },
    body: readFileSync(f),
  });
  if (res.ok) { ok++; console.log('  ✓', relative(DIST, f)); }
  else { fail++; console.error('  ✗', relative(DIST, f), res.status, (await res.text()).slice(0, 120)); }
}
console.log(`✓ ${ok}/${files.length} 成功${fail ? `，${fail} 失败` : ''}`);
if (fail) process.exit(1);
