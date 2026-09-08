/**
 * 监测点 mock 工厂
 * 50 个监测点：25 压力 + 12 流量 + 8 水质 + 5 液位
 * 坐标挂在工程附近 ±0.05° 抖动
 * 24h 历史：144 个采样点（10min 间隔），用 sin + noise
 * 状态：47 normal + 3 alarm
 * 确定性：mulberry32 seed=44
 */

import type { MonitorPoint, Project, Status } from '@shared/types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

type MonitorType = MonitorPoint['type'];

interface TypeSpec {
  type: MonitorType;
  valueRange: [number, number];
  valueRound: number;
  base: number;        // 历史基线
  amp: number;         // 历史振幅
  sampleCount: number; // 本类生成数
}

const SPECS: TypeSpec[] = [
  { type: 'pressure', valueRange: [0.15, 0.45], valueRound: 3, base: 0.3, amp: 0.05, sampleCount: 25 },
  { type: 'flow', valueRange: [5, 200], valueRound: 1, base: 80, amp: 30, sampleCount: 12 },
  { type: 'quality', valueRange: [0.3, 1.5], valueRound: 2, base: 0.8, amp: 0.3, sampleCount: 8 },
  { type: 'level', valueRange: [1, 5], valueRound: 2, base: 2.5, amp: 0.6, sampleCount: 5 },
];

/** 生成 144 点历史（24h × 10min），sin + noise 形态 */
function genHistory(rand: () => number, base: number, amp: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < 144; i++) {
    const phase = (i / 144) * Math.PI * 2;
    // 日内峰谷（早 8 / 晚 8 双峰）+ 噪声
    const daily = Math.sin(phase - Math.PI / 2) * amp;
    const noise = (rand() - 0.5) * amp * 0.4;
    arr.push(round(base + daily + noise, 3));
  }
  return arr;
}

/**
 * 生成 50 个监测点
 * @param projects A/B/C 主工程
 */
export function genMonitors(projects: Project[]): MonitorPoint[] {
  const rand = mulberry32(44);
  const mainProjects = projects.filter((p) => p.grade !== 'D');
  if (mainProjects.length === 0) return [];

  const points: MonitorPoint[] = [];

  // 状态分布：47 normal + 3 alarm
  const statusPool: Status[] = [];
  for (let i = 0; i < 47; i++) statusPool.push('normal');
  for (let i = 0; i < 3; i++) statusPool.push('alarm');
  // 打乱
  for (let i = statusPool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [statusPool[i], statusPool[j]] = [statusPool[j], statusPool[i]];
  }

  let statusIdx = 0;
  let idSeq = 1;

  for (const spec of SPECS) {
    for (let n = 0; n < spec.sampleCount; n++) {
      const proj = mainProjects[Math.floor(rand() * mainProjects.length)];
      const [lon, lat] = proj.coord;
      const jitterLon = lon + (rand() - 0.5) * 0.1;
      const jitterLat = lat + (rand() - 0.5) * 0.1;
      const status = statusPool[statusIdx++];
      const value =
        status === 'alarm'
          ? spec.valueRange[1] * (1.05 + rand() * 0.2) // 越上限
          : round(spec.base + (rand() - 0.5) * spec.amp * 2, spec.valueRound);
      points.push({
        id: `MON-${spec.type.toUpperCase()}-${String(idSeq++).padStart(3, '0')}`,
        type: spec.type,
        coord: [round(jitterLon, 6), round(jitterLat, 6)],
        projectId: proj.id,
        value: round(value, spec.valueRound),
        history: genHistory(rand, spec.base, spec.amp),
        status,
      });
    }
  }

  return points;
}
