/**
 * 管网 mock 工厂
 * 200 段管网，从旗中心放射到各苏木乡镇
 * 材质分布：60% PE / 20% PPR / 15% 球墨铸铁 / 5% 钢管
 * 直径 50-300 mm，长度 100-5000m
 * 确定性：mulberry32 seed=43
 */

import type { PipeSegment, Project } from '@shared/types';

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

type Material = PipeSegment['material'];
const MATERIALS: Material[] = ['PE', 'PE', 'PE', 'PE', 'PE', 'PE', 'PPR', 'PPR', '球墨铸铁', '球墨铸铁', '球墨铸铁', '钢管'];

function pickMaterial(rand: () => number): Material {
  return MATERIALS[Math.floor(rand() * MATERIALS.length)];
}

const FLAG_CENTER: [number, number] = [114.0, 42.7];

/**
 * 生成 200 段管网
 * @param projects A/B/C 主工程（46 处），管网放射连接到这些点位
 */
export function genPipes(projects: Project[]): PipeSegment[] {
  const rand = mulberry32(43);
  const mainProjects = projects.filter((p) => p.grade !== 'D');
  if (mainProjects.length === 0) return [];

  const pipes: PipeSegment[] = [];

  // 第一阶段：主干管网（旗中心 → 每个 A 级工程 1 条 + 每个 B 级 1 条）
  // 大致 12 + 8 = 20 条主干
  const trunkTargets = mainProjects.filter((p) => p.grade === 'A' || p.grade === 'B');
  for (let i = 0; i < trunkTargets.length; i++) {
    const target = trunkTargets[i];
    pipes.push({
      id: `PIPE-T-${String(i + 1).padStart(3, '0')}`,
      start: FLAG_CENTER,
      end: target.coord,
      diameter: Math.round(150 + rand() * 150), // 150-300
      material: pickMaterial(rand),
      length: Math.round(1000 + rand() * 4000), // 1000-5000
      projectId: target.id,
      installYear: 2015 + Math.floor(rand() * 10),
    });
  }

  // 第二阶段：剩余 180 条，C 级工程间互联 + A/B 间支管
  // 循环保险确保生成 180 条（重复起始点时复用主干节点）
  let i = 0;
  let attempts = 0;
  while (i < 180 && attempts < 500) {
    attempts++;
    const a = mainProjects[Math.floor(rand() * mainProjects.length)];
    let b = mainProjects[Math.floor(rand() * mainProjects.length)];
    if (a.id === b.id) {
      // 用旗中心作为中转，避免重复起点
      pipes.push({
        id: `PIPE-B-${String(i + 1).padStart(3, '0')}`,
        start: a.coord,
        end: FLAG_CENTER,
        diameter: Math.round(50 + rand() * 150),
        material: pickMaterial(rand),
        length: Math.round(100 + rand() * 4900),
        projectId: a.id,
        installYear: 2010 + Math.floor(rand() * 15),
      });
    } else {
      pipes.push({
        id: `PIPE-B-${String(i + 1).padStart(3, '0')}`,
        start: a.coord,
        end: b.coord,
        diameter: Math.round(50 + rand() * 150),
        material: pickMaterial(rand),
        length: Math.round(100 + rand() * 4900),
        projectId: a.id,
        installYear: 2010 + Math.floor(rand() * 15),
      });
    }
    i++;
  }

  return pipes;
}
