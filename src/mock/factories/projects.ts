/**
 * 工程 mock 工厂
 * 苏尼特右旗 · 中等牧区旗县量级
 * - A 重点 12 + B 联村 8 + C 单村 26 + D 分散 1842（仅元数据，D 不入大屏点位）
 * - 坐标在旗中心 (114.0, 42.7) ±0.4° 抖动，且落在 banner.json bbox 内
 * - 状态分布：35 normal + 3 alarm + 2 repair + 1 stop + 5 offline
 * - 确定性：mulberry32 seed=42
 */

import type { Project, Grade, Status } from '@shared/types';

// ---------- 确定性 PRNG (mulberry32) ----------
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

// 苏尼特右旗旗中心（来自 banner.json bbox 中心估算）
export const FLAG_CENTER: [number, number] = [114.0, 42.7];

// 苏木乡镇名（锡盟苏尼特右旗行政区划）
const SU_MU_LIST = [
  '赛汉塔拉镇', '朱日和镇', '桑宝拉格苏木', '额仁淖尔苏木',
  '赛罕淖尔苏木', '阿其图乌拉苏木', '巴彦朱日和苏木', '乌日根塔拉苏木',
];

const GACHA_LIST = [
  '巴彦杭盖嘎查', '阿尔善图嘎查', '巴彦德力格尔嘎查', '额尔敦敖包嘎查',
  '乌兰淖尔嘎查', '浩勒报吉嘎查', '巴彦淖尔嘎查', '查干楚鲁嘎查',
];

const RESPONSIBLE_NAMES = [
  '巴特尔', '斯日娜', '朝鲁', '乌云娜', '阿木尔', '格日勒',
  '图雅', '哈斯', '达楞太', '苏乙拉', '其木德', '乌力吉',
];

// 状态分布（A+B+C=46 项）
const STATUS_DIST: Status[] = (() => {
  const arr: Status[] = [];
  for (let i = 0; i < 35; i++) arr.push('normal');
  for (let i = 0; i < 3; i++) arr.push('alarm');
  for (let i = 0; i < 2; i++) arr.push('repair');
  arr.push('stop');
  for (let i = 0; i < 5; i++) arr.push('offline');
  return arr;
})();

function jitterCoord(rand: () => number, center: [number, number], span = 0.4): [number, number] {
  const lon = center[0] + (rand() - 0.5) * 2 * span;
  const lat = center[1] + (rand() - 0.5) * 2 * span;
  return [round(lon, 6), round(lat, 6)];
}

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)];
}

function genMetrics(rand: () => number, grade: Grade, status: Status): Project['metrics'] {
  if (status === 'offline' || status === 'stop') {
    return { pressure: 0, flow: 0, level: 0 };
  }
  if (grade === 'A') {
    return {
      pressure: round(0.2 + rand() * 0.2, 3),
      flow: round(20 + rand() * 150, 1),
      level: round(2 + rand() * 3, 2),
      turbidity: round(0.3 + rand() * 0.8, 2),
      chlorine: round(0.3 + rand() * 0.6, 2),
      ph: round(7.0 + rand() * 1.0, 2),
      temperature: round(5 + rand() * 15, 1),
      pumpCurrent: round(8 + rand() * 30, 1),
    };
  }
  if (grade === 'B') {
    return {
      pressure: round(0.18 + rand() * 0.22, 3),
      flow: round(10 + rand() * 80, 1),
      level: round(1.5 + rand() * 3, 2),
      pumpCurrent: round(5 + rand() * 20, 1),
    };
  }
  if (grade === 'C') {
    return {
      pressure: round(0.15 + rand() * 0.2, 3),
      flow: round(5 + rand() * 40, 1),
      level: round(1 + rand() * 2, 2),
    };
  }
  // D 类：基础档案
  return {
    pressure: round(0.15 + rand() * 0.15, 3),
    flow: round(1 + rand() * 5, 1),
  };
}

function genName(grade: Grade, idx: number, rand: () => number): string {
  const su = pick(rand, SU_MU_LIST);
  const idStr = String(idx).padStart(2, '0');
  if (grade === 'A') return `${su}·A-${idStr} 集中供水工程`;
  if (grade === 'B') return `${su}·B-${idStr} 水源井站`;
  if (grade === 'C') return `${su}·C-${idStr} 高位水池`;
  // D
  const gacha = pick(rand, GACHA_LIST);
  const dStr = String(idx).padStart(3, '0');
  return `${gacha}·D-${dStr} 供水点`;
}

/**
 * 生成 46 处集中供水工程 + 1842 个 D 级分散供水点元数据
 * 注：返回数组中前 46 项为 A/B/C 主体，第 47+ 项为 D 级占位
 */
export function genProjects(): Project[] {
  const rand = mulberry32(42);
  const result: Project[] = [];

  // 状态分布打乱（确定性）
  const statusPool = [...STATUS_DIST];
  for (let i = statusPool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [statusPool[i], statusPool[j]] = [statusPool[j], statusPool[i]];
  }

  // ---------- A 级 12 处 ----------
  for (let i = 1; i <= 12; i++) {
    const grade: Grade = 'A';
    const status = statusPool[i - 1];
    const coord = jitterCoord(rand, FLAG_CENTER, 0.4);
    result.push({
      id: `PRJ-A-${String(i).padStart(2, '0')}`,
      name: genName(grade, i, rand),
      grade,
      status,
      coord,
      suMu: pick(rand, SU_MU_LIST),
      responsible: pick(rand, RESPONSIBLE_NAMES),
      metrics: genMetrics(rand, grade, status),
    });
  }

  // ---------- B 级 8 处 ----------
  for (let i = 1; i <= 8; i++) {
    const grade: Grade = 'B';
    const status = statusPool[12 + i - 1];
    const coord = jitterCoord(rand, FLAG_CENTER, 0.4);
    result.push({
      id: `PRJ-B-${String(i).padStart(2, '0')}`,
      name: genName(grade, i, rand),
      grade,
      status,
      coord,
      suMu: pick(rand, SU_MU_LIST),
      responsible: pick(rand, RESPONSIBLE_NAMES),
      metrics: genMetrics(rand, grade, status),
    });
  }

  // ---------- C 级 26 处 ----------
  for (let i = 1; i <= 26; i++) {
    const grade: Grade = 'C';
    const status = statusPool[20 + i - 1];
    const coord = jitterCoord(rand, FLAG_CENTER, 0.4);
    result.push({
      id: `PRJ-C-${String(i).padStart(2, '0')}`,
      name: genName(grade, i, rand),
      grade,
      status,
      coord,
      suMu: pick(rand, SU_MU_LIST),
      responsible: pick(rand, RESPONSIBLE_NAMES),
      metrics: genMetrics(rand, grade, status),
    });
  }

  // ---------- D 级 1842 处（仅元数据，dashboard 按需采样 30 展示） ----------
  for (let i = 1; i <= 1842; i++) {
    const grade: Grade = 'D';
    // D 级分散供水状态分布更保守（多为 normal，少量 offline）
    const status: Status = rand() < 0.05 ? 'offline' : 'normal';
    const coord = jitterCoord(rand, FLAG_CENTER, 0.4);
    result.push({
      id: `PRJ-D-${String(i).padStart(4, '0')}`,
      name: genName(grade, i, rand),
      grade,
      status,
      coord,
      suMu: pick(rand, SU_MU_LIST),
      responsible: pick(rand, RESPONSIBLE_NAMES),
      metrics: genMetrics(rand, grade, status),
    });
  }

  return result;
}

/** 仅导出 A/B/C 主体的工程列表（用于大屏点位） */
export function genMainProjects(): Project[] {
  return genProjects().filter((p) => p.grade !== 'D');
}
