/** 跨端共享类型 — 阶段 1 冻结的契约（与 docs/design + 需求 docx 对齐） */

export type Status = 'normal' | 'alarm' | 'repair' | 'stop' | 'offline';
export type Grade = 'A' | 'B' | 'C' | 'D';

export interface Project {
  id: string;
  name: string;        // 如 "朱日和镇 · B-03 水源井站"
  grade: Grade;        // A-D
  status: Status;
  coord: [number, number];  // [lon, lat]
  suMu: string;       // 苏木乡镇
  responsible: string;
  /** A 级点击 → 3D 模型 */
  modelUrl?: string;
  /** 关键实时值（按点位类型） */
  metrics: Partial<{
    pressure: number;   // MPa
    flow: number;       // m³/h
    level: number;      // m
    turbidity: number;  // NTU
    chlorine: number;   // mg/L
    ph: number;
    temperature: number;// °C
    pumpCurrent: number;// A
  }>;
}

export interface PipeSegment {
  id: string;
  start: [number, number];
  end: [number, number];
  diameter: number;     // mm
  material: 'PE' | 'PPR' | '球墨铸铁' | '钢管';
  length: number;       // m
  projectId: string;
  installYear: number;
}

export interface MonitorPoint {
  id: string;
  type: 'pressure' | 'flow' | 'quality' | 'level';
  coord: [number, number];
  projectId: string;
  /** 当前值 */
  value: number;
  /** 24h 历史（144 个 10min 采样） */
  history: number[];
  status: Status;
}

export interface EmergencyEvent {
  id: string;
  time: string;          // ISO
  type: 'burst' | 'water_quality' | 'power_outage' | 'frost' | 'equipment';
  level: '一般' | '较大' | '重大';
  suMu: string;
  projectId?: string;
  location: string;
  description: string;
  status: '未签收' | '已派单' | '已签收' | '已销号';
  receivedBy?: string;
  resolvedAt?: string;
}

export interface CockpitKpi {
  totalProjects: number;
  statusBreakdown: Record<Status, number>;
  coverage: {
    villages: number;        // 已覆盖嘎查村
    totalVillages: number;
    population: number;      // 万人
    rate: number;            // 集中供水率 %
  };
  water: {
    todaySupply: number;     // 万 m³
    todayPowerKwh: number;
  };
  quality: {
    qualifiedRate: number;   // %
    deviceOnlineRate: number;
    dataCompleteRate: number;
  };
  ops: {
    workOrderCloseRate: number;
    paymentRate: number;
    lossRate: number;        // 漏损率
  };
  alarms: { total: number; unsigned: number };
}

/** A-D 分级形状编码（spec §2.4 形状双编码） */
export const GRADE_SHAPE: Record<Grade, 'hex' | 'square' | 'circle' | 'triangle'> = {
  A: 'hex',
  B: 'square',
  C: 'circle',
  D: 'triangle',
};

/** 5 状态色（spec §2.3 全屏唯一映射） */
export const STATUS_COLOR: Record<Status, string> = {
  normal: '#00FFE0',
  alarm: '#FF5C5C',
  repair: '#FFB454',
  stop: '#6B7A8F',
  offline: '#3A4A5E',
};

/** 监测点分色（spec §2.4 监测点分色） */
export const MONITOR_COLOR: Record<MonitorPoint['type'], string> = {
  pressure: '#00C2FF',
  flow: '#00FFE0',
  quality: '#7EE081',
  level: '#8FA8FF',
};
