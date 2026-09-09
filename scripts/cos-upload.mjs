import { createHmac, createHash } from 'crypto';
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';

const SID = process.env['SL-GIS-SECRET-ID'];
const SKEY = process.env['SL-GIS-SECRET-KEY'];
const APPID = process.env['TENCENT_APPID'];
const BUCKET = process.env['TENCENT_BUCKET'] || 'sl-gis-static';
const REGION = process.env['TENCENT_REGION'] || 'ap-guangzhou';
const PREFIX = (process.env['TENCENT_PREFIX'] || 'sl-gis').replace(//+$/, '');
const DIST = 'dist';

if (!SID || !SKEY || !APPID) { console.error('missing env'); process.exit(1); }
if (!existsSync(DIST)) { console.error('no dist/'); process.exit(1); }

const sha1hex = (s) => createHash('sha1').update(s).digest('hex');
const hmac = (k, s) => createHmac('sha1', k).update(s).digest('hex');

function auth(method, host, path) {
  const now = Math.floor(Date.now() / 1000);
  const kt = (now - 60) + ';' + (now + 600);
  const sk = hmac(SKEY, kt);
  const hs = method.toLowerCase() + '\n' + path.toLowerCase() + '\n\nhost=' + host.toLowerCase() + '\n';
  const sts = 'sha1\n' + kt + '\n' + sha1hex(hs) + '\n';
  const sig = hmac(sk, sts);
  return 'q-sign-algorithm=sha1&q-ak=' + SID + '&q-sign-time=' + kt + '&q-key-time=' + kt + '&q-header-list=host&q-url-param-list=&q-signature=' + sig;
}

const MIME = { '.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2' };

const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d,n); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(DIST);
const host = BUCKET + '-' + APPID + '.cos.' + REGION + '.myqcloud.com';
console.log('upload ' + files.length + ' files to ' + host + '/' + PREFIX + '/');
let ok = 0;
for (const f of files) {
  const key = PREFIX + '/' + relative(DIST, f);
  const ext = f.slice(f.lastIndexOf('.'));
  const cache = ext === '.html' ? 'max-age=300' : ext === '.json' ? 'max-age=86400' : 'max-age=31536000';
  const res = await fetch('https://' + host + '/' + key, {
    method: 'PUT',
    headers: { Host: host, Authorization: auth('PUT', host, '/' + key), 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'public, ' + cache },
    body: readFileSync(f),
  });
  if (res.ok) { ok++; console.log('  OK', key); } else { console.error('  FAIL', key, res.status); }
}
console.log(ok + '/' + files.length);
if (ok !== files.length) process.exit(1);