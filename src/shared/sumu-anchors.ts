/**
 * 苏尼特右旗 · 8 苏木乡镇真实坐标（高德行政区 API 2026-09-10 实取）
 * 三种格式共用同一组真实坐标：
 *   SUMU_CENTERS — lon/lat（ TownshipLayer / mock 工程 / 管网分布）
 *   SUMU_ANCHORS — fx/fy bbox 相对坐标（CityLayer 建筑聚簇）
 *   nearestCenter(lon, lat) — 最近苏木查询
 */

export interface SumuCenter {
  name: string;
  adcode: string;
  center: [number, number];
  /** 建筑数量权重（旗驻地最大） */
  weight: number;
  isSeat?: boolean;
  isIndustrial?: boolean;
}

/** 真实坐标 + 权重 */
export const SUMU_CENTERS: SumuCenter[] = [
  { name: '赛汉塔拉镇', adcode: '15252405', center: [113.103398, 42.5655], weight: 3.0, isSeat: true },
  { name: '朱日和镇', adcode: '15252401', center: [113.402859, 42.477651], weight: 1.6 },
  { name: '乌日根塔拉镇', adcode: '15252403', center: [112.568865, 43.604927], weight: 1.0 },
  { name: '额仁淖尔苏木', adcode: '15252404', center: [111.977158, 43.169304], weight: 1.0 },
  { name: '桑宝拉格苏木', adcode: '15252406', center: [113.02006, 43.126702], weight: 1.0 },
  { name: '赛罕乌力吉苏木', adcode: '15252407', center: [113.725308, 42.469256], weight: 1.0 },
  { name: '阿其图乌拉苏木', adcode: '15252402', center: [113.204435, 43.079935], weight: 0.9 },
  { name: '朱日和工业园区', adcode: '15252408', center: [112.896731, 42.41697], weight: 0.6, isIndustrial: true },
];

/** banner bbox（来自 DataV 152524.json 实测） */
const BANNER_BBOX = { minLon: 111.15, maxLon: 114.55, minLat: 42.05, maxLat: 43.6 };
const spanLon = BANNER_BBOX.maxLon - BANNER_BBOX.minLon;
const spanLat = BANNER_BBOX.maxLat - BANNER_BBOX.minLat;

/** fx/fy 格式（CityLayer 建筑聚簇消费） */
export const SUMU_ANCHORS = SUMU_CENTERS.map(c => ({
  name: c.name,
  weight: c.weight,
  isSeat: c.isSeat,
  fx: (c.center[0] - BANNER_BBOX.minLon) / spanLon,
  fy: (c.center[1] - BANNER_BBOX.minLat) / spanLat,
}));

/** 最近苏木查询（mock 工程分配 / 乡镇区划着色） */
export function nearestCenter(lon: number, lat: number): SumuCenter {
  let best = SUMU_CENTERS[0];
  let bestD = Infinity;
  for (const c of SUMU_CENTERS) {
    const d = (c.center[0] - lon) ** 2 + (c.center[1] - lat) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** 按权重随机取锚点（调用方传 rng） */
export function pickAnchorByWeight<T extends { weight: number }>(anchors: T[], rng: () => number): T {
  const total = anchors.reduce((s, a) => s + a.weight, 0);
  let r = rng() * total;
  for (const a of anchors) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return anchors[anchors.length - 1];
}
