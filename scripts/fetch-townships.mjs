/**
 * fetch-townships.mjs — 从高德行政区 API 拉取苏尼特右旗下辖苏木乡镇边界
 * 用法（用户本地执行，key 不进对话/代码库）：
 *   AMAP_KEY=你的Web服务key node scripts/fetch-townships.mjs
 * 输出：public/geo/townships.json（前端 TownshipLayer 消费）
 *
 * 前置：高德企业认证账号 → lbs.amap.com 应用管理 → key（Web服务类型）
 *       需开通「行政区查询」API 配额
 */
import { writeFileSync, existsSync, readFileSync } from 'fs';

const KEY = process.env.AMAP_KEY;
if (!KEY) {
  console.error('❌ 缺少 AMAP_KEY 环境变量。用法: AMAP_KEY=你的key node scripts/fetch-townships.mjs');
  process.exit(1);
}

const ADcode = '152524'; // 苏尼特右旗
const API = `https://restapi.amap.com/v3/config/district?keywords=${ADcode}&subdistrict=3&extensions=all&key=${KEY}`;

console.log('→ 请求高德行政区 API...');
const res = await fetch(API);
const data = await res.json();

if (data.status !== '1') {
  console.error(`❌ 高德 API 错误: ${data.info} (${data.infocode})`);
  if (data.infocode === '10001') console.error('   key 无效 — 确认是「Web服务」类型 key');
  if (data.infocode === '10044') console.error('   配额超限 — 企业认证账号今日配额已用尽');
  process.exit(1);
}

const banner = data.districts?.[0];
if (!banner) { console.error('❌ 未找到该行政区'); process.exit(1); }

console.log(`✓ ${banner.name}（adcode ${banner.adcode}）`);
const townships = banner.districts || [];
console.log(`✓ 下辖 ${townships.length} 个苏木乡镇:`);

// 高德 extensions=all 时区县级返回 polyline；乡镇级（subdistrict 层级）polyline 需逐个查
const features = [];

// 旗本级边界（若返回了 polyline）
if (banner.polyline) {
  features.push({
    type: 'Feature',
    properties: { name: banner.name, adcode: banner.adcode, level: 'banner' },
    geometry: polylineToGeometry(banner.polyline),
  });
}

// 逐个乡镇查边界（高德要求 keywords=乡镇名 单查才有 polyline）
for (const tw of townships) {
  console.log(`  → ${tw.name} (${tw.adcode})`);
  const r = await fetch(
    `https://restapi.amap.com/v3/config/district?keywords=${tw.adcode}&subdistrict=0&extensions=all&key=${KEY}`
  );
  const d = await r.json();
  const twDetail = d.districts?.[0];
  if (twDetail?.polyline) {
    features.push({
      type: 'Feature',
      properties: {
        name: twDetail.name,
        adcode: twDetail.adcode,
        level: 'township',
        center: twDetail.center,
      },
      geometry: polylineToGeometry(twDetail.polyline),
    });
    console.log(`    ✓ 边界获取成功`);
  } else {
    console.log(`    ✗ 无边界数据（高德乡镇级边界覆盖不全时发生）`);
  }
  // 高德 QPS 限制 3/s（个人）50/s（企业）— 保守间隔
  await new Promise(r => setTimeout(r, 350));
}

function polylineToGeometry(polyline) {
  // 高德 polyline 格式: "lng,lat;lng,lat|lng,lat;lng,lat"（| 分隔多个环）
  const rings = polyline.split('|').map(ring =>
    ring.split(';').map(pair => pair.split(',').map(Number))
  );
  // 单环 → Polygon，多环 → MultiPolygon（简化处理为第一个环集合）
  return rings.length === 1
    ? { type: 'Polygon', coordinates: [rings[0]] }
    : { type: 'MultiPolygon', coordinates: rings.map(r => [r]) };
}

const out = {
  type: 'FeatureCollection',
  meta: { banner: banner.name, adcode: banner.adcode, fetchedAt: new Date().toISOString() },
  features,
};

const dest = 'public/geo/townships.json';
writeFileSync(dest, JSON.stringify(out, null, 0));
console.log(`\n✓ 已写入 ${dest}（${features.length} 个边界要素）`);
console.log('→ 前端 TownshipLayer 将自动加载此文件渲染乡镇区划');
