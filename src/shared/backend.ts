/**
 * backend.ts — nano-api 数据 → 前端 shared 类型映射
 * 水合帮手：字段适配（code→id / su_mu→suMu / lon,lat→coord）+ 缺失字段合成（history 曲线）
 */
import type { Grade, MonitorPoint, PipeSegment, Project, Status } from '@shared/types';

type ProjectRow = Record<string, unknown>;
type MonitorRow = Record<string, unknown>;

/** 后端值域（与 mock 工厂 SPECS 同口径）→ 历史振幅 */
const HISTORY_AMP: Record<MonitorPoint['type'], number> = {
  pressure: 0.05,
  flow: 30,
  quality: 0.3,
  level: 0.6,
};

/** 按 value 基线合成 24h 历史形态（双峰 sin + 噪声，144 点中抽 24）——真时序接入前的展示兜底 */
function synthHistory(value: number, type: MonitorPoint['type']): number[] {
  const amp = HISTORY_AMP[type];
  const out: number[] = [];
  for (let i = 0; i < 24; i++) {
    const phase = (i / 24) * Math.PI * 2;
    const jitter = Math.sin(i * 12.9898) * 0.5; // 确定性伪噪声
    out.push(+(value + Math.sin(phase - Math.PI / 2) * amp + jitter * amp * 0.2).toFixed(3));
  }
  return out;
}

export function mapProject(p: ProjectRow): Project {
  return {
    id: String(p.code),
    name: String(p.name),
    grade: p.grade as Grade,
    status: p.status as Status,
    coord: [Number(p.lon), Number(p.lat)],
    suMu: String(p.su_mu),
    responsible: String(p.responsible ?? ''),
    metrics: {},
  };
}

export function mapMonitor(m: MonitorRow): MonitorPoint {
  const value = Number(m.value);
  const type = m.type as MonitorPoint['type'];
  return {
    id: String(m.code),
    type,
    coord: [Number(m.lon), Number(m.lat)],
    projectId: String(m.project_code),
    value,
    history: synthHistory(value, type),
    status: (m.status === 'alarm' ? 'alarm' : 'normal') as Status,
  };
}

export function mapPipe(p: Record<string, unknown>): PipeSegment {
  const from = p.from as Record<string, unknown>;
  const to = p.to as Record<string, unknown>;
  return {
    id: String(p.code),
    start: [Number(from.lon), Number(from.lat)],
    end: [Number(to.lon), Number(to.lat)],
    diameter: Number(p.diameter),
    material: p.material as PipeSegment['material'],
    length: Number(p.length_m),
    projectId: String(p.project_code),
    installYear: Number(p.install_year),
  };
}

/** 解包 nano-api 统一响应 {code, data:{total, items}} */
export function unpackItems<T = never>(payload: unknown): T[] | null {
  const d = payload as { items?: T[] } | null;
  return d?.items?.length ? d.items : null;
}
