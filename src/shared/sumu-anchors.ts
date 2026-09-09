/**
 * sumu-anchors.ts — 苏尼特右旗苏木乡镇锚点（bbox 相对坐标 + 权重）
 * 供三处共用：CityLayer 建筑聚簇 / mock 工程分布 / 管网走向
 * fx/fy = 相对 banner bbox 的比例坐标（0-1），weight = 聚簇规模系数
 */

export interface SumuAnchor {
  name: string;
  /** bbox 相对坐标 0-1 */
  fx: number;
  fy: number;
  /** 建筑数量权重（旗驻地最大） */
  weight: number;
  /** 是否旗/镇政府驻地 */
  isSeat?: boolean;
}

/** 8 个苏木乡镇锚点（按真实地理大势分布在 bbox 内） */
export const SUMU_ANCHORS: SumuAnchor[] = [
  { name: '赛汉塔拉镇', fx: 0.24, fy: 0.48, weight: 3.0, isSeat: true },  // 旗驻地
  { name: '朱日和镇', fx: 0.34, fy: 0.22, weight: 1.6 },
  { name: '桑宝拉格苏木', fx: 0.16, fy: 0.68, weight: 1.0 },
  { name: '额仁淖尔苏木', fx: 0.42, fy: 0.55, weight: 1.0 },
  { name: '赛罕淖尔苏木', fx: 0.58, fy: 0.42, weight: 1.0 },
  { name: '乌日根塔拉苏木', fx: 0.52, fy: 0.8, weight: 1.0 },
  { name: '阿其图乌拉苏木', fx: 0.72, fy: 0.72, weight: 1.0 },
  { name: '巴彦朱日和苏木', fx: 0.48, fy: 0.28, weight: 0.9 },
];

/** 按 anchor 权重随机取一个（调用方传 rng） */
export function pickAnchor<T extends { weight: number }>(anchors: T[], rng: () => number): T {
  const total = anchors.reduce((s, a) => s + a.weight, 0);
  let r = rng() * total;
  for (const a of anchors) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return anchors[anchors.length - 1];
}
