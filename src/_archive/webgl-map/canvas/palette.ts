/**
 * 场景色常量 — 与 src/styles/tokens.css 同源（深蓝科技风）
 * 不重新定义颜色，只搬运 / 衍生 shared/types 已冻结的语义色
 */
import { STATUS_COLOR, MONITOR_COLOR, GRADE_SHAPE } from '@/shared/types';

// tokens.css 字符串色（与 CSS vars 一一对应，避免运行时拉 CSS 变量）
export const TOKENS = {
  wellDeep: '#030812',
  nightNavy: '#071525',
  surfaceBlue: '#0C2340',
  lineVein: 'rgba(0,194,255,0.18)',
  floodTeal: '#00C2FF',
  springGreen: '#00FFE0',
  steppeAmber: '#FFB454',
  statusAlarm: '#FF5C5C',
  statusStop: '#6B7A8F',
  statusOffline: '#3A4A5E',
  monPressure: '#00C2FF',
  monFlow: '#00FFE0',
  monQuality: '#7EE081',
  monLevel: '#8FA8FF',
} as const;

/** Stage 场景用色（基底 / 描边 / 流光 / 建筑） */
export const SCENE_PALETTE = {
  /** 旗县边界描边 */
  boundaryLine: TOKENS.floodTeal,
  /** 地面底色（与 --surface-blue 同源） */
  groundBase: TOKENS.surfaceBlue,
  /** 管网暗线底 */
  pipeDim: '#1E4D66',
  /** 管网流光高亮 */
  pipeFlow: TOKENS.springGreen,
  /** 建筑侧面 */
  buildingSide: '#1A4A7A',
  /** 建筑顶面（半透明） */
  buildingTop: 'rgba(0,255,224,0.28)',
  /** 飞线尾迹 */
  flyLineTrail: TOKENS.springGreen,
  /** 围幕 / 雷达默认 */
  wallFlow: TOKENS.floodTeal,
  /** 告警主色 */
  alertMain: TOKENS.statusAlarm,
  /** 光晕球（球内透出） */
  monitorGlow: '#FFFFB3',
} as const;

/** 语义色（来自 shared/types，重导出便于 Stage/各 Layer 一处导入） */
export { STATUS_COLOR, MONITOR_COLOR, GRADE_SHAPE };

/** 5 状态 → render style（ProjectLayer / ProjectSprite 用） */
export const STATUS_STYLE = {
  normal: 'breathe',
  alarm: 'pulse',
  repair: 'wrench',
  stop: 'hollow',
  offline: 'dashed',
} as const;