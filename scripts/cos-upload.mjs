/**
 * cos-upload.mjs — CNB CI 内把 dist/ 同步到腾讯云 COS
 * 凭证来源（CI 环境变量，勿硬编码）：
 *   SL-GIS-SECRET-ID / SL-GIS-SECRET-KEY / TENCENT_APPID
 *   TENCENT_BUCKET(默认 sl-gis-static) / TENCENT_REGION(默认 ap-guangzhou) / TENCENT_PREFIX(默认 sl-gis/)
 */
import COS from 'cos-nodejs-sdk-v5';
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
  console.error('❌ 缺少 COS 凭证环境变量（SL-GIS-SECRET-ID/SL-GIS-SECRET-KEY/TENCENT_APPID）— 在仓库 设置→密钥 配置');
  process.exit(1);
}
if (!existsSync(DIST)) {
  console.error('❌ dist/ 不存在，先 pnpm build');
  process.exit(1);
}

const cos = new COS({ SecretId: SECRET_ID, SecretKey: SECRET_KEY });
const Bucket = `${BUCKET}-${APPID}`;

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(DIST);

const MIME = {
  '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.html': 'text/html', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

async function putOne(file) {
  const key = `${PREFIX}/${relative(DIST, file)}`;
  const ext = file.slice(file.lastIndexOf('.'));
  const cache = ext === '.html' ? 'max-age=300' : ext === '.json' ? 'max-age=86400' : 'max-age=31536000';
  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket, Region,
      Key: key,
      Body: readFileSync(file),
      ContentType: MIME[ext] || 'application/octet-stream',
      CacheControl: `public, ${cache}`,
    }, (err) => (err ? reject(new Error(`${key}: ${err.message || err}`)) : resolve(key)));
  });
}

console.log(`→ 上传 ${files.length} 个文件到 ${Bucket}/${PREFIX}/`);
let ok = 0;
for (const f of files) {
  try { await putOne(f); ok++; console.log('  ✓', relative(DIST, f)); }
  catch (e) { console.error('  ✗', e.message); process.exitCode = 1; }
}
console.log(`✓ 完成 ${ok}/${files.length}`);
if (ok !== files.length) process.exit(1);
