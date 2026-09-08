/**
 * Track D — ECharts 图表组件统一导出
 * 公共 surface：主 agent（src/main.ts / DashboardLayout.vue）按需引入
 */

export { default as TrendLine } from './TrendLine.vue';
export { default as StatusBars } from './StatusBars.vue';
export { default as MiniRings } from './MiniRings.vue';
export { default as MicroBar } from './MicroBar.vue';
export { default as SparkLine } from './SparkLine.vue';

export {
  registerWaterTechTheme,
  ensureWaterTechTheme,
  WATER_TECH_THEME_NAME,
  WATER_TECH_THEME_OPTION,
  WATER_TECH_PALETTE,
  TOKENS_RAW,
} from './theme/water-tech';

export type { EChartsLike } from './theme/water-tech';