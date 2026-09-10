/**
 * 骨架阶段本地 mock（牧区旗县口径）
 * 口径：水价 3.5 元/m³，户均月用水 8-20 m³
 * 后端接入规划：https://nanoai.fun/api（FastAPI + JWT），届时替换为真实接口
 */

/** 用户信息 */
export interface UserProfile {
  name: string
  account: string // 户号
  address: string
  balance: number // 账户余额（元）
}

/** 停水公告 */
export interface WaterNotice {
  id: number
  title: string
  type?: string // 停水/限时供水/水质检测/恢复供水
  area: string
  date: string
  content: string
}

/** 当月账单 */
export interface MonthBill {
  month: string
  usage: number // 用水量（m³）
  price: number // 水价（元/m³）
  amount: number // 应缴金额（元）
  status: '已缴' | '未缴'
}

/** 月度用量 */
export interface UsageMonth {
  month: string
  usage: number
}

/** 缴费记录 */
export interface PayRecord {
  id: number
  time: string
  amount: number
  channel: string
}

/** 当前用户（mock） */
export const USER: UserProfile = {
  name: '巴特尔',
  account: '0210-0086',
  address: '锡林浩特市宝力根苏木哈那乌拉嘎查',
  balance: 46.5,
}

/** 当月账单（mock） */
export const CURRENT_BILL: MonthBill = {
  month: '2026年9月',
  usage: 14,
  price: 3.5,
  amount: 49.0,
  status: '未缴',
}

/** 近 6 个月用量（mock，m³） */
export const USAGE_6M: UsageMonth[] = [
  { month: '4月', usage: 12 },
  { month: '5月', usage: 16 },
  { month: '6月', usage: 18 },
  { month: '7月', usage: 20 },
  { month: '8月', usage: 15 },
  { month: '9月', usage: 14 },
]

/** 缴费记录（mock） */
export const PAY_RECORDS: PayRecord[] = [
  { id: 1, time: '2026-08-21 10:26', amount: 70.0, channel: '微信支付' },
  { id: 2, time: '2026-07-18 09:12', amount: 63.0, channel: '微信支付' },
  { id: 3, time: '2026-06-15 16:40', amount: 56.0, channel: '营业厅现金' },
]

/** 停水公告（mock） */
export const NOTICES: WaterNotice[] = [
  {
    id: 1,
    title: '哈那乌拉嘎查管网冲洗停水',
    area: '宝力根苏木',
    date: '09-13 08:00-12:00',
    content: '供水管网冲洗消毒，请牧户提前储水。',
  },
  {
    id: 2,
    title: '查干淖尔水厂设备检修停水',
    area: '查干淖尔镇',
    date: '09-16 09:00-15:00',
    content: '水泵机组检修，影响周边 3 个嘎查供水。',
  },
]

/** 报修问题类型 */
export const REPAIR_TYPES = ['水管漏水', '水龙头/阀门损坏', '水质异常', '水压不足', '水表故障', '其他']
