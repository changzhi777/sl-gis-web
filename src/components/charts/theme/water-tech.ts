/**
 * SL-GIS · ECharts 主题 'water-tech'
 * 与 src/styles/tokens.css 完全同源色（设计系统 §2.5 图表序列色）
 *
 * 使用：
 *   import { registerWaterTechTheme } from '@charts/theme/water-tech';
 *   registerWaterTechTheme(echarts);          // 一次性注册
 *   <TrendLine :theme="'water-tech'" />
 */

import type { EChartsType } from 'echarts/core';

/** 解析 CSS 变量为实际色值（fallback 硬编码与 tokens.css 完全一致） */
const TOKENS = {
  // 基础背景
  wellDeep: '#030812',
  nightNavy: '#071525',
  surfaceBlue: '#0C2340',
  lineVein: 'rgba(0, 194, 255, .18)',

  // 强调色
  floodTeal: '#00C2FF',
  springGreen: '#00FFE0',
  steppeAmber: '#FFB454',

  // 状态语义
  statusNormal: '#00FFE0',
  statusAlarm: '#FF5C5C',
  statusRepair: '#FFB454',
  statusStop: '#6B7A8F',
  statusOffline: '#3A4A5E',

  // 图表序列色（§2.5）
  chart1: '#00C2FF',
  chart2: '#00FFE0',
  chart3: '#7EE081',
  chart4: '#FFB454',
  chart5: '#FF7A9E',
  chart6: '#8FA8FF',

  // 文字
  text: '#E8F1F8',
  textDim: '#9DB2C6',
} as const;

/** 6 系列序列色（与 --chart-1..6 同源，1:1 对应） */
export const WATER_TECH_PALETTE = [
  TOKENS.chart1,
  TOKENS.chart2,
  TOKENS.chart3,
  TOKENS.chart4,
  TOKENS.chart5,
  TOKENS.chart6,
] as const;

/** ECharts theme option 对象 */
export const WATER_TECH_THEME_OPTION = {
  color: [...WATER_TECH_PALETTE],

  backgroundColor: 'transparent',

  textStyle: {
    fontFamily: "'Rajdhani', 'Noto Sans SC', system-ui, sans-serif",
    color: TOKENS.text,
  },

  title: {
    textStyle: { color: TOKENS.text, fontWeight: 600, fontSize: 16 },
    subtextStyle: { color: TOKENS.textDim, fontSize: 12 },
  },

  /** 折线图系列：光滑 + symbol 描边 */
  line: {
    itemStyle: { borderWidth: 2, borderColor: TOKENS.wellDeep },
    lineStyle: { width: 2 },
    symbolSize: 6,
    symbol: 'circle',
    smooth: false,
    emphasis: {
      focus: 'series' as const,
      lineStyle: { width: 3 },
    },
  },

  /** 柱图：与状态色一致 */
  bar: {
    itemStyle: {
      borderRadius: [1, 1, 0, 0],
      color: TOKENS.floodTeal,
    },
  },

  /** 坐标轴：暗底 + 暗线 + dim 文字 */
  categoryAxis: {
    axisLine: { show: false, lineStyle: { color: TOKENS.lineVein } },
    axisTick: { show: false },
    axisLabel: {
      color: TOKENS.textDim,
      fontSize: 12,
      fontFamily: "'Rajdhani', sans-serif",
      margin: 8,
    },
    splitLine: { show: false },
    splitArea: { show: false },
  },

  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: TOKENS.textDim,
      fontSize: 12,
      fontFamily: "'Rajdhani', sans-serif",
      margin: 8,
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: 'rgba(0, 194, 255, .08)',
        width: 1,
        type: 'solid',
      },
    },
    splitArea: { show: false },
  },

  /** 图例：dot 风格（与 status sub 一致） */
  legend: {
    itemWidth: 8,
    itemHeight: 8,
    itemGap: 16,
    textStyle: {
      color: TOKENS.textDim,
      fontSize: 12,
      fontFamily: "'Noto Sans SC', sans-serif",
    },
    icon: 'roundRect',
  },

  /** tooltip：深底 + 1px 边框 + 刻度角标母题 */
  tooltip: {
    backgroundColor: 'rgba(3, 8, 18, .92)',
    borderColor: TOKENS.lineVein,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: {
      color: TOKENS.text,
      fontSize: 12,
      fontFamily: "'Noto Sans SC', sans-serif",
    },
    extraCssText: 'backdrop-filter: blur(4px); border-radius: 2px;',
    axisPointer: {
      lineStyle: { color: TOKENS.floodTeal, width: 1, type: 'dashed' },
      crossStyle: { color: TOKENS.floodTeal, width: 1, type: 'dashed' },
    },
  },

  /** 网格：边距紧凑（趋势带场景） */
  grid: {
    left: 8,
    right: 8,
    top: 24,
    bottom: 24,
    containLabel: true,
  },

  /** 折线 area style 默认透明，由调用方控制 */
  categoryAxisPointer: {
    lineStyle: { color: TOKENS.floodTeal },
  },

  timeAxis: {
    axisLine: { lineStyle: { color: TOKENS.lineVein } },
    axisLabel: { color: TOKENS.textDim, fontSize: 12 },
    splitLine: { lineStyle: { color: 'rgba(0, 194, 255, .08)' } },
  },

  logAxis: {
    axisLine: { lineStyle: { color: TOKENS.lineVein } },
    axisLabel: { color: TOKENS.textDim, fontSize: 12 },
    splitLine: { lineStyle: { color: 'rgba(0, 194, 255, .08)' } },
  },
} as const;

export const WATER_TECH_THEME_NAME = 'water-tech';

/** 类型守卫：传入的 echarts 实例含 registerTheme 即可 */
export type EChartsLike = { registerTheme: (name: string, opt: object) => void };

/** 一次性注册 water-tech 主题（重复调用安全：内部去重） */
let registered = false;
export function registerWaterTechTheme(echarts: EChartsLike | EChartsType): void {
  if (registered) return;
  // echarts 5 的 registerTheme 接受 ThemeOption（结构与 object 一致）
  (echarts as EChartsLike).registerTheme(WATER_TECH_THEME_NAME, WATER_TECH_THEME_OPTION as unknown as object);
  registered = true;
}

/** 暴露 tokens 方便组件直接读色（SVG 组件用） */
export const TOKENS_RAW = TOKENS;

/** 兼容命名（一些调用方可能传完整 echarts 包对象） */
export function ensureWaterTechTheme(echarts: EChartsType | EChartsLike): void {
  registerWaterTechTheme(echarts);
}