/*
  billing/mock.ts — 收费服务页内确定性 mock（需求 §八 收费服务）
  口径与全站 mock 基线一致（牧区旗县行业数值）：
  · 用水户约 1.2 万户，牧户占比 85%+（牧户 / 嘎查村公共 / 养殖场 / 卫生院 / 学校）
  · 水价 2.5–4.5 元/m³（现行 3.5）· 牧区年人均用水 ~15 m³（户均月水费约 40 元）
  · 收缴率 76.3% · 产销差率 18.1%（9 月：出厂总表 59,000 − 用户分表 48,300 = 10,700）
  全部为字面量常量、无随机数 —— 同一份数据每次渲染一致（大屏演示口径）
*/

/* ---------- 类型 ---------- */

/** 收费服务 KPI */
export interface BillingKpi {
  /** 用水户总数（户）≈ 1.2 万 */
  totalUsers: number;
  /** 抄表到户率（%） */
  meterRate: number;
  /** 本月水费（万元） */
  monthFee: number;
  /** 收缴率（%） */
  collectionRate: number;
  /** 欠费户数（户） */
  arrearsUsers: number;
  /** 欠费金额合计（万元） */
  arrearsAmount: number;
  /** 产销差率（%） */
  lossRate: number;
  /** 服务人口（万人） */
  servedPopulation: number;
  /** 覆盖苏木乡镇数 */
  townships: number;
  /** 现行水价（元/m³，阶梯区间 2.5–4.5） */
  waterPrice: number;
}

/** 用水户构成（5 类） */
export interface UserMixRow {
  label: string;
  count: number;
  color: string;
}

/** 收缴率月度趋势 */
export interface CollectionTrend {
  months: string[];
  /** 实际收缴率（%） */
  actual: number[];
  /** 目标线（%） */
  target: number[];
}

/** 产销差三级水量月度对比（m³） */
export interface MeterTrend {
  months: string[];
  /** 水厂出厂总表 */
  factory: number[];
  /** 村级总表合计 */
  village: number[];
  /** 用户分表合计 */
  userMeters: number[];
  /** 产销差率（%），按 (出厂 − 用户) / 出厂 计算 */
  lossRate: number[];
}

/** 漏损排查状态 */
export type LeakStatus = '待排查' | '排查中' | '已确认漏损' | '已修复';

/** 疑似漏损清单行 */
export interface LeakRow {
  /** 嘎查村 */
  village: string;
  /** 月差值（m³，村级总表 − 用户分表合计） */
  delta: number;
  /** 偏差率（%） */
  bias: number;
  status: LeakStatus;
}

/** 缴费渠道（'已缴' 为真数据流水统一兜底标签 — 后端流水无渠道字段） */
export type PayChannel = '微信' | '营业厅' | '上门' | '已缴';

/** 欠费提醒行 */
export interface ArrearRow {
  /** 户名 / 单位名 */
  user: string;
  /** 所属工程短号（PRJ-A-01 → A-01） */
  project: string;
  /** 所属工程名 */
  projectName: string;
  /** 欠费金额（元） */
  amount: number;
  /** 欠费月数 */
  months: number;
}

/** 缴费流水行 */
export interface PaymentRow {
  /** 时间（HH:mm） */
  time: string;
  user: string;
  /** 金额（元） */
  amount: number;
  channel: PayChannel;
}

/* ---------- /api/billing/overview 真数据契约（nano-api router/billing.py） ---------- */

/** 月度收缴口径 */
export interface BillingMonthly {
  /** 账期 "2026-03" */
  month: string;
  /** 应缴（元） */
  due: number;
  /** 已缴（元） */
  paid: number;
  /** 收缴率（%） */
  rate: number;
}

/** 欠费户行（按欠费额降序前 12） */
export interface BillingArrearsItem {
  /** 户号 SL26E0058 */
  account: string;
  owner: string;
  /** 欠费合计（元） */
  amount: number;
  /** 欠费期数 */
  months: number;
}

/** 近期缴费流水行 */
export interface BillingPayment {
  account: string;
  owner: string;
  month: string;
  amount: number;
}

/** GET /api/billing/overview 响应 data */
export interface BillingOverview {
  households: number;
  composition: Record<string, number>;
  monthly: BillingMonthly[];
  collectionRate: number;
  arrears: { count: number; amount: number; items: BillingArrearsItem[] };
  recentPayments: BillingPayment[];
}

/* ---------- KPI（口径锚点） ---------- */

export const billingKpi: BillingKpi = {
  totalUsers: 12080, // 牧户 10,510 + 嘎查村公共 682 + 养殖场 638 + 卫生院 154 + 学校 96
  meterRate: 92.4, // 抄表到户率（D 级分散供水点仍按定额/人力抄表）
  monthFee: 48.6, // 本月水费（万元）：12,080 户 × 40.2 元/户
  collectionRate: 76.3, // 收缴率（全站基线）
  arrearsUsers: 326, // 欠费户数
  arrearsAmount: 9.62, // 欠费金额合计（万元）
  lossRate: 18.1, // 产销差率（全站基线，目标 ≤12%）
  servedPopulation: 3.87, // 服务人口（万人）：年人均 ~15 m³
  townships: 12, // 覆盖苏木乡镇
  waterPrice: 3.5, // 现行水价（元/m³），政策区间 2.5–4.5
};

/* ---------- 用水户构成（牧户占 87.0%，满足 85%+ 口径） ---------- */

export const userMix: UserMixRow[] = [
  { label: '牧户', count: 10510, color: 'var(--spring-green)' },
  { label: '嘎查村公共', count: 682, color: 'var(--flood-teal)' },
  { label: '养殖场', count: 638, color: 'var(--steppe-amber)' },
  { label: '卫生院', count: 154, color: 'var(--chart-6, #8FA8FF)' },
  { label: '学校', count: 96, color: 'var(--chart-3, #7EE081)' },
];

/* ---------- 收缴率 6 个月趋势（目标 85%） ---------- */

export const collectionTrend: CollectionTrend = {
  months: ['4月', '5月', '6月', '7月', '8月', '9月'],
  actual: [71.8, 73.5, 74.2, 75.0, 75.8, 76.3],
  target: [85, 85, 85, 85, 85, 85],
};

/*
  产销差三级水量对比（月累计，m³）
  9 月口径：出厂 59,000 − 村级 54,200（村网漏损 8.1%）− 用户 48,300（户表侧 10.0%）→ 产销差 18.1%
*/
export const meterTrend: MeterTrend = {
  months: ['4月', '5月', '6月', '7月', '8月', '9月'],
  factory: [52100, 54600, 57300, 55800, 58400, 59000],
  village: [47900, 50100, 52700, 51300, 53700, 54200],
  userMeters: [42800, 44700, 46900, 45500, 47700, 48300],
  lossRate: [17.9, 18.1, 18.2, 18.5, 18.3, 18.1],
};

/* ---------- 疑似漏损清单（村级总表 − 分表合计，按差值降序） ---------- */

export const leakSuspects: LeakRow[] = [
  { village: '查干淖尔嘎查', delta: 1240, bias: 22.6, status: '已确认漏损' },
  { village: '乌兰哈达嘎查', delta: 980, bias: 19.4, status: '排查中' },
  { village: '巴彦杭盖嘎查', delta: 865, bias: 17.2, status: '待排查' },
  { village: '都仁乌力吉', delta: 742, bias: 15.8, status: '排查中' },
  { village: '呼格吉勒图', delta: 618, bias: 14.3, status: '待排查' },
  { village: '赛罕塔拉', delta: 505, bias: 12.1, status: '已修复' },
  { village: '阿日善图', delta: 438, bias: 10.6, status: '待排查' },
];

/* ---------- 欠费提醒（TOP 8，金额 = 月费 × 欠费月数，牧区户均月费 30–50 元） ---------- */

export const arrearsList: ArrearRow[] = [
  { user: '达来养殖场', project: 'A-02', projectName: '宝格达乌拉水厂', amount: 512.0, months: 5 },
  { user: '查干淖尔嘎查委员会', project: 'D-09', projectName: '分散供水点', amount: 386.0, months: 6 },
  { user: '巴特尔', project: 'A-01', projectName: '查干诺尔水厂', amount: 268.4, months: 4 },
  { user: '特木尔', project: 'B-04', projectName: '赛罕塔拉联村', amount: 221.5, months: 4 },
  { user: '乌云其木格', project: 'B-03', projectName: '呼和乌苏联村', amount: 186.2, months: 3 },
  { user: '娜仁花', project: 'A-01', projectName: '查干诺尔水厂', amount: 173.8, months: 3 },
  { user: '哈斯', project: 'C-07', projectName: '阿日善图单村', amount: 112.9, months: 2 },
  { user: '那顺巴图', project: 'C-06', projectName: '巴彦高勒单村', amount: 94.6, months: 2 },
];

/* ---------- 最近缴费流水（今日，线上 + 线下） ---------- */

export const paymentFeed: PaymentRow[] = [
  { time: '09:47', user: '苏依拉图', amount: 86.0, channel: '微信' },
  { time: '09:41', user: '额尔登尼', amount: 172.5, channel: '微信' },
  { time: '09:35', user: '朝鲁门', amount: 240.0, channel: '营业厅' },
  { time: '09:28', user: '其木格', amount: 78.4, channel: '微信' },
  { time: '09:19', user: '乌恩奇', amount: 64.2, channel: '上门' },
  { time: '09:12', user: '宝音德力格尔', amount: 95.6, channel: '上门' },
  { time: '09:05', user: '阿拉腾花', amount: 132.8, channel: '营业厅' },
  { time: '08:58', user: '钢宝力达', amount: 158.0, channel: '微信' },
];
