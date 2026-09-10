/**
 * assessment/mock.ts — 统计考核页内确定性 mock
 * 口径：需求 §十一（日报/月报/年报自动生成 + 七项统计率）
 *      + §十二（考核六维指标表：供水保障/水质安全/设施运行/巡检维修/运营管理/服务监督/数据管理）
 * 全部为静态常量、无随机数 —— 多次渲染结果完全一致。
 * 数值基准：牧区旗县行业量级（千吨水电耗 ~380kWh/千m³、单位供水成本 ~2.8 元/m³）。
 */

/* ============ 顶部 KPI 条（统计七率取六项核心） ============ */

export interface AssessKpi {
  /** 指标名 */
  label: string;
  value: number;
  unit: string;
  /** 同比变化幅度（%），口径全部向好 */
  delta: number;
  /** 小数位 */
  decimals: number;
}

export const ASSESS_KPIS: AssessKpi[] = [
  { label: '规模化供水覆盖率', value: 87.5, unit: '%', delta: 2.3, decimals: 1 },
  { label: '工程正常运行率', value: 93.6, unit: '%', delta: 2.2, decimals: 1 },
  { label: '设备在线率', value: 94.6, unit: '%', delta: 0.7, decimals: 1 },
  { label: '水质合格率', value: 98.4, unit: '%', delta: 0.6, decimals: 1 },
  { label: '收费率', value: 96.3, unit: '%', delta: 2.4, decimals: 1 },
  { label: '工单办结率', value: 96.8, unit: '%', delta: 1.3, decimals: 1 },
];

/* ============ 考核六维 + 指标明细（§十二 考核指标表） ============ */

export interface AssessIndicator {
  /** 指标名称 */
  name: string;
  /** 实际值 */
  actual: number;
  /** 目标值（考核基准） */
  target: number;
  /** 单位 */
  unit: string;
  /** 方向：high = 越高越好 / low = 越低越好 */
  betterWhen: 'high' | 'low';
  /** 展示小数位 */
  decimals: number;
}

export interface AssessDimension {
  key: string;
  name: string;
  /** 维度综合得分（0-100） */
  score: number;
  indicators: AssessIndicator[];
}

export const DIMENSIONS: AssessDimension[] = [
  {
    key: 'supply',
    name: '供水保障',
    score: 92.4,
    indicators: [
      { name: '工程正常运行率', actual: 93.6, target: 92, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '连续供水保障率', actual: 98.2, target: 97, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '重大停水事件数', actual: 1, target: 2, unit: '次', betterWhen: 'low', decimals: 0 },
      { name: '平均恢复供水时间', actual: 3.6, target: 4, unit: 'h', betterWhen: 'low', decimals: 1 },
    ],
  },
  {
    key: 'quality',
    name: '水质安全',
    score: 94.1,
    indicators: [
      { name: '检测计划完成率', actual: 96.5, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '水质综合合格率', actual: 98.4, target: 96, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '异常处置及时率', actual: 97.1, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '复检销号率', actual: 94.8, target: 90, unit: '%', betterWhen: 'high', decimals: 1 },
    ],
  },
  {
    key: 'facility',
    name: '设施运行',
    score: 89.7,
    indicators: [
      { name: '设备在线率', actual: 94.6, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '数据完整率', actual: 96.2, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '设备完好率', actual: 97.3, target: 96, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '预防性养护完成率', actual: 91.5, target: 92, unit: '%', betterWhen: 'high', decimals: 1 },
    ],
  },
  {
    key: 'patrol',
    name: '巡检维修',
    score: 87.6,
    indicators: [
      { name: '巡检完成率', actual: 95.4, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '告警签收及时率', actual: 93.2, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '工单按时办结率', actual: 96.8, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '重复故障率', actual: 4.6, target: 5, unit: '%', betterWhen: 'low', decimals: 1 },
      { name: '平均修复时间', actual: 5.8, target: 6, unit: 'h', betterWhen: 'low', decimals: 1 },
    ],
  },
  {
    key: 'operation',
    name: '运营管理',
    score: 85.9,
    indicators: [
      { name: '计量率', actual: 92.7, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '收费率', actual: 96.3, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '产销差率', actual: 12.4, target: 14, unit: '%', betterWhen: 'low', decimals: 1 },
      { name: '千吨水电耗', actual: 381.5, target: 400, unit: 'kWh', betterWhen: 'low', decimals: 1 },
      { name: '单位供水成本', actual: 2.82, target: 3.0, unit: '元/m³', betterWhen: 'low', decimals: 2 },
    ],
  },
  {
    key: 'service',
    name: '服务监督',
    score: 90.3,
    indicators: [
      { name: '报修响应率', actual: 98.1, target: 98, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '投诉办结率', actual: 97.5, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '群众满意度', actual: 93.6, target: 90, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '信息公告及时率', actual: 96.2, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
    ],
  },
  {
    key: 'data',
    name: '数据管理',
    score: 88.2,
    indicators: [
      { name: '档案完整率', actual: 94.8, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '数据更新及时率', actual: 92.3, target: 95, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '报表自动生成率', actual: 98.6, target: 98, unit: '%', betterWhen: 'high', decimals: 1 },
      { name: '问题数据整改率', actual: 90.5, target: 90, unit: '%', betterWhen: 'high', decimals: 1 },
    ],
  },
];

/** 指标总数（供面板副标题使用） */
export const INDICATOR_COUNT = DIMENSIONS.reduce((s, d) => s + d.indicators.length, 0);

/** 达标判定：high 方向 current >= target 达标；low 方向 current <= target 达标 */
export function met(current: number, target: number, betterWhen: 'high' | 'low'): boolean {
  return betterWhen === 'high' ? current >= target : current <= target;
}

/* ============ 报表中心（日报 / 月报 / 年报自动生成口径） ============ */

export type ReportKind = '日报' | '月报' | '年报';

export interface ReportRow {
  /** 指标名 */
  name: string;
  unit: string;
  /** 本期值 */
  current: number;
  /** 上期值 */
  previous: number;
  /** 考核目标 */
  target: number;
  /** 方向：high = 越高越好 / low = 越低越好 */
  betterWhen: 'high' | 'low';
  /** 展示小数位 */
  decimals: number;
}

export const REPORTS: Record<ReportKind, ReportRow[]> = {
  日报: [
    { name: '取供水量', unit: '万m³', current: 1.42, previous: 1.38, target: 1.3, betterWhen: 'high', decimals: 2 },
    { name: '工程正常运行率', unit: '%', current: 93.6, previous: 92.8, target: 92, betterWhen: 'high', decimals: 1 },
    { name: '设备在线率', unit: '%', current: 94.6, previous: 93.9, target: 95, betterWhen: 'high', decimals: 1 },
    { name: '水质检测合格率', unit: '%', current: 98.4, previous: 97.6, target: 96, betterWhen: 'high', decimals: 1 },
    { name: '工单按时办结率', unit: '%', current: 96.8, previous: 95.2, target: 95, betterWhen: 'high', decimals: 1 },
    { name: '千吨水电耗', unit: 'kWh', current: 381.5, previous: 392.6, target: 400, betterWhen: 'low', decimals: 1 },
  ],
  月报: [
    { name: '取供水量', unit: '万m³', current: 42.6, previous: 40.1, target: 38, betterWhen: 'high', decimals: 1 },
    { name: '收费率', unit: '%', current: 96.3, previous: 94.8, target: 95, betterWhen: 'high', decimals: 1 },
    { name: '产销差率', unit: '%', current: 12.4, previous: 13.1, target: 14, betterWhen: 'low', decimals: 1 },
    { name: '水质综合合格率', unit: '%', current: 98.4, previous: 97.9, target: 96, betterWhen: 'high', decimals: 1 },
    { name: '巡检完成率', unit: '%', current: 95.4, previous: 93.7, target: 96, betterWhen: 'high', decimals: 1 },
    { name: '维修工单办结率', unit: '%', current: 96.8, previous: 95.5, target: 95, betterWhen: 'high', decimals: 1 },
    { name: '消毒药剂药耗', unit: '元/千m³', current: 46.8, previous: 47.6, target: 45, betterWhen: 'low', decimals: 1 },
  ],
  年报: [
    { name: '年度供水量', unit: '万m³', current: 512.4, previous: 486.2, target: 480, betterWhen: 'high', decimals: 1 },
    { name: '规模化供水覆盖率', unit: '%', current: 87.5, previous: 85.2, target: 85, betterWhen: 'high', decimals: 1 },
    { name: '工程正常运行率', unit: '%', current: 93.6, previous: 91.4, target: 92, betterWhen: 'high', decimals: 1 },
    { name: '水质综合合格率', unit: '%', current: 98.4, previous: 97.8, target: 96, betterWhen: 'high', decimals: 1 },
    { name: '综合收费率', unit: '%', current: 96.3, previous: 93.9, target: 95, betterWhen: 'high', decimals: 1 },
    { name: '平均产销差率', unit: '%', current: 12.4, previous: 14.2, target: 14, betterWhen: 'low', decimals: 1 },
    { name: '千吨水电耗', unit: 'kWh', current: 381.5, previous: 402.3, target: 400, betterWhen: 'low', decimals: 1 },
    { name: '更新改造完成投资', unit: '万元', current: 1560, previous: 1210, target: 1500, betterWhen: 'high', decimals: 0 },
  ],
};

/** 同比变化（%）：本期相对上期的变化幅度，保留 1 位小数 */
export function yoy(row: ReportRow): number {
  if (row.previous === 0) return 0;
  return +(((row.current - row.previous) / row.previous) * 100).toFixed(1);
}

/** 同比变化是否向好（结合指标方向判断，而非单纯涨跌） */
export function yoyGood(row: ReportRow): boolean {
  const d = yoy(row);
  return row.betterWhen === 'high' ? d >= 0 : d <= 0;
}

/* ============ 苏木乡镇综合排名（7 个苏木乡镇 · 得分降序） ============ */

export interface TownshipRank {
  name: string;
  /** 综合得分（0-100） */
  score: number;
}

export const TOWNSHIP_RANKS: TownshipRank[] = [
  { name: '赛汉塔拉镇', score: 93.8 },
  { name: '朱日和镇', score: 91.2 },
  { name: '桑宝拉格苏木', score: 90.4 },
  { name: '乌日根塔拉镇', score: 88.6 },
  { name: '额仁淖尔苏木', score: 87.3 },
  { name: '阿其图乌拉苏木', score: 86.1 },
  { name: '赛罕乌力吉苏木', score: 85.2 },
];

/* ============ 成本分析（千吨水电耗 / 药耗 / 人工 / 维修） ============ */

export interface CostItem {
  label: string;
  value: number;
  /** 条形满格上限 */
  max: number;
  unit: string;
  decimals: number;
  color: string;
}

export const COST_ITEMS: CostItem[] = [
  { label: '千吨水电耗', value: 381.5, max: 500, unit: 'kWh', decimals: 1, color: 'var(--spring-green)' },
  { label: '药耗', value: 46.8, max: 80, unit: '元/千m³', decimals: 1, color: 'var(--flood-teal)' },
  { label: '人工成本', value: 128.5, max: 200, unit: '万元', decimals: 1, color: 'var(--mon-level)' },
  { label: '维修成本', value: 86.2, max: 200, unit: '万元', decimals: 1, color: 'var(--steppe-amber)' },
];

/** 成本同比摘要文案 */
export const COST_YOY = '同比：电耗 -2.8% · 药耗 -1.6% · 人工 +3.4% · 维修 -6.1%';

/** 单位供水成本（元/m³）：实际值 / 考核上限 / 同比 */
export const UNIT_WATER_COST = { value: 2.82, target: 3.0, yoy: -4.4 } as const;

/* ============ 年度更新改造项目库（§十一：按故障频次/设施年限/水源趋势/服务人口排序） ============ */

export interface RenovationProject {
  /** 工程名称 */
  name: string;
  /** 改造原因（依据四类判据） */
  reason: string;
  /** 优先级评分（0-100，高分优先，≥80 红色提示） */
  priority: number;
  /** 资金需求（万元） */
  fund: number;
}

export const RENOVATION_PROJECTS: RenovationProject[] = [
  { name: '朱日和镇供水管网改造', reason: '管网老化 · 爆管故障频发', priority: 92, fund: 680 },
  { name: '赛汉塔拉镇净水设备更新', reason: '设施超期服役 · 故障频次高', priority: 88, fund: 520 },
  { name: '额仁淖尔苏木水源井替换', reason: '水源水位持续下降趋势', priority: 83, fund: 410 },
  { name: '桑宝拉格苏木消毒系统改造', reason: '设施年限到期 · 水质风险', priority: 79, fund: 260 },
  { name: '乌日根塔拉镇管网延伸', reason: '服务人口增长 · 供水半径扩大', priority: 74, fund: 350 },
  { name: '阿其图乌拉苏木远传水表改造', reason: '计量率不达标 · 产销差偏高', priority: 68, fund: 190 },
  { name: '赛罕乌力吉苏木蓄水池修缮', reason: '设施年限长 · 冬季冻堵频发', priority: 61, fund: 150 },
];

/** 资金需求合计（万元） */
export const RENOVATION_FUND_TOTAL = RENOVATION_PROJECTS.reduce((s, p) => s + p.fund, 0);
