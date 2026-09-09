import { createHmac, createHash } from 'crypto';
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';

const NL = String.fromCharCode(10);
const SID = process.env['SL-GIS-SECRET-ID'];
const SKEY = process.env['SL-GIS-SECRET-KEY'];
const APPID = process.env['TENCENT_APPID'];
const BUCKET = process.env['TENCENT_BUCKET'] || 'sl-gis-static';
const REGION = process.env['TENCENT_REGION'] || 'ap-guangzhou';
const PREFIX = (process.env['TENCENT_PREFIX'] || 'sl-gis').split('/').filter(Boolean).join('/');
const DIST = 'dist';

if (!SID || !SKEY || !APPID) { console.error('missing env vars'); process.exit(1); }
if (!existsSync(DIST)) { console.error('no dist'); process.exit(1); }

const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const hmac = (k, s) => createHmac('sha1', k).update(s).digest('hex');

function auth(method, host, path) {
  const now = Math.floor(Date.now() / 1000);
  const kt = (now - 60) + ';' + (now + 600);
  const sk = hmac(SKEY, kt);
  const hs = [method.toLowerCase(), path.toLowerCase(), '', 'host=' + host.toLowerCase(), ''].join(NL);
  const sts = ['sha1', kt, sha1(hs), ''].join(NL);
  const sig = hmac(sk, sts);
  return 'q-sign-algorithm=sha1&q-ak=' + SID + '&q-sign-time=' + kt + '&q-key-time=' + kt + '&q-header-list=host&q-url-param-list=&q-signature=' + sig;
}

const MIME = { js:'application/javascript', css:'text/css', html:'text/html', json:'application/json', png:'image/png', svg:'image/svg+xml' };

const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else files.push(p); } })(DIST);
const host = BUCKET + '-' + APPID + '.cos.' + REGION + '.myqcloud.com';
console.log('uploading ' + files.length + ' files');
let ok = 0;
for (const f of files) {
  const key = PREFIX + '/' + relative(DIST, f);
  const ext = f.slice(f.lastIndexOf('.') + 1);
  const cache = ext === 'html' ? 'max-age=300' : ext === 'json' ? 'max-age=86400' : 'max-age=31536000';
  const res = await fetch('https://' + host + '/' + encodeURIComponent(key), {
    method: 'PUT',
    headers: { Host: host, Authorization: auth('PUT', host, '/' + key), 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'public, ' + cache },
    body: readFileSync(f),
  });
  if (res.ok) { ok++; console.log('  OK', key); } else { console.error('  FAIL', key, res.status, (await res.text()).slice(0, 100)); }
}
console.log(ok + '/' + files.length + ' uploaded');
if (ok !== files.length) process.exit(1);