/**
 * public-service/mock.ts — 公众服务大屏页内确定性 mock（需求 §十 公众服务）
 * 口径：
 *  · 通过公众号 / 小程序 / 服务热线发布停水、限时供水、水质检测、恢复供水信息
 *  · 水量水费查询、在线报修、投诉建议、进度查询、满意度评价、便民联系方式
 *  · 饮水安全 / 水源保护 / 冬季防冻 / 管护知识宣传
 * 全部为静态常量，无随机数，多次刷新画面一致；公告/工单已接 /api/portal/notices 与 /api/repairs
 * 真值水合（后端不可达回落本文件），满意度/知识宣传/便民服务仍为本文件口径
 */

/* ============ 顶部 KPI 条（本月口径） ============ */
export interface PageKpi {
  label: string;
  value: number;
  unit: string;
}

export const pageKpis: PageKpi[] = [
  { label: '本月公告', value: 18, unit: '条' },
  { label: '在线报修', value: 42, unit: '单' },
  { label: '投诉建议', value: 9, unit: '条' },
  { label: '办结率', value: 95.6, unit: '%' },
  { label: '平均响应时长', value: 1.8, unit: 'h' },
  { label: '群众满意度', value: 4.6, unit: '分' },
];

/* ============ 信息公告（四类标签 × 三渠道，词表对齐后端 biz_notice） ============ */
export type NoticeType = '停水' | '限时供水' | '水质检测' | '恢复供水';
export type NoticeChannel = '公众号' | '小程序' | '热线';
export type NoticeStatus = '已发布' | '已过期';

export interface NoticeItem {
  id: string;
  type: NoticeType;
  title: string;
  channel: NoticeChannel;
  /** 发布时间 MM-DD HH:mm */
  publishAt: string;
  status: NoticeStatus;
}

/** 公告类型 → 标签文字 + 着色（停水红 / 限时暖 / 检测青 / 恢复绿） */
export const NOTICE_TYPE_META: Record<NoticeType, { label: string; color: string }> = {
  停水: { label: '停水', color: 'var(--status-alarm)' },
  限时供水: { label: '限时供水', color: 'var(--steppe-amber)' },
  水质检测: { label: '水质检测', color: 'var(--flood-teal)' },
  恢复供水: { label: '恢复供水', color: 'var(--spring-green)' },
};

/** 发布渠道 → 图标字符 + 文字（公众号/小程序/热线） */
export const CHANNEL_META: Record<NoticeChannel, { icon: string; label: string; color: string }> = {
  公众号: { icon: '公', label: '公众号', color: 'var(--flood-teal)' },
  小程序: { icon: '小', label: '小程序', color: 'var(--spring-green)' },
  热线: { icon: '话', label: '热线', color: 'var(--steppe-amber)' },
};

export const notices: NoticeItem[] = [
  { id: 'N-0910-01', type: '停水', title: '朱日和镇区主管网抢修停水（07:00–13:00）', channel: '小程序', publishAt: '09-10 05:30', status: '已发布' },
  { id: 'N-0910-02', type: '恢复供水', title: '巴彦杭盖嘎查供水管网抢修完成，恢复正常供水', channel: '公众号', publishAt: '09-10 11:20', status: '已发布' },
  { id: 'N-0909-03', type: '水质检测', title: '桑宝拉格苏木供水站第三季度水质检测公示', channel: '公众号', publishAt: '09-09 16:00', status: '已发布' },
  { id: 'N-0909-04', type: '限时供水', title: '查干淖尔嘎查限时供水（06:00–09:00 / 17:00–20:00）', channel: '热线', publishAt: '09-09 07:45', status: '已发布' },
  { id: 'N-0908-05', type: '恢复供水', title: '乌兰陶勒盖嘎查管网冲洗消毒完成，恢复供水', channel: '小程序', publishAt: '09-08 15:10', status: '已过期' },
  { id: 'N-0908-06', type: '停水', title: '赛罕塔拉嘎查泵房年度检修停水 8 小时', channel: '热线', publishAt: '09-08 08:00', status: '已过期' },
  { id: 'N-0907-07', type: '水质检测', title: '出厂水浊度·余氯日检结果公示（每日更新）', channel: '小程序', publishAt: '09-07 17:30', status: '已发布' },
  { id: 'N-0907-08', type: '限时供水', title: '冬季枯水期宝楞嘎查分时段供水安排', channel: '公众号', publishAt: '09-07 09:00', status: '已发布' },
  { id: 'N-0906-09', type: '停水', title: '都希乌苏嘎查水源井清洗消毒停水 6 小时', channel: '热线', publishAt: '09-06 07:00', status: '已过期' },
  { id: 'N-0906-10', type: '恢复供水', title: '哈日阿图嘎查新水源井启用，供水全面恢复', channel: '公众号', publishAt: '09-06 12:40', status: '已过期' },
];

/* ============ 报修 / 投诉工单池（阶段对齐后端 biz_repair 真三态） ============ */
export type TicketStage = '待受理' | '处理中' | '已办结';
export type TicketType = '报修' | '投诉';

export interface TicketItem {
  /** 工单编号：GX=报修 GT=投诉 + 日期 + 流水 */
  id: string;
  type: TicketType;
  village: string;
  summary: string;
  stage: TicketStage;
  handler: string;
  /** 当前阶段已时长 */
  elapsed: string;
}

/** 进度管道三阶段（顺序即流转方向，与后端 status 机一致：待受理→处理中→已办结） */
export const STAGE_ORDER: TicketStage[] = ['待受理', '处理中', '已办结'];

/** 阶段着色：待受理暖 / 处理中青 / 已办结绿 */
export const STAGE_COLORS: Record<string, string> = {
  待受理: 'var(--steppe-amber)',
  处理中: 'var(--flood-teal)',
  已办结: 'var(--spring-green)',
};

/** 问题类型着色：mock 报修/投诉 + 后端真类别（漏水/无水/水质/设施损坏/其他） */
export const TICKET_TYPE_COLORS: Record<string, string> = {
  报修: 'var(--flood-teal)',
  投诉: 'var(--chart-5)',
  漏水: 'var(--flood-teal)',
  无水: 'var(--status-alarm)',
  水质: 'var(--chart-6)',
  设施损坏: 'var(--steppe-amber)',
  其他: 'var(--text-dim)',
};

export const tickets: TicketItem[] = [
  { id: 'GX-0910-001', type: '报修', village: '查干淖尔嘎查', summary: '供水站变频器报警，出水中断', stage: '待受理', handler: '—', elapsed: '0.5h' },
  { id: 'GT-0910-001', type: '投诉', village: '桑宝拉格苏木呼格吉勒图嘎查', summary: '维修开挖后未恢复草皮，请求补植', stage: '待受理', handler: '—', elapsed: '1.5h' },
  { id: 'GX-0910-003', type: '报修', village: '查干淖尔嘎查', summary: '牧户支管接口滴漏，水压偏低', stage: '待受理', handler: '—', elapsed: '0.8h' },
  { id: 'GX-0909-006', type: '报修', village: '巴彦杭盖嘎查', summary: '主管道法兰渗漏，更换密封垫', stage: '处理中', handler: '那日苏', elapsed: '6.5h' },
  { id: 'GX-0910-002', type: '报修', village: '宝楞嘎查', summary: '井房水泵启动异常，异响明显', stage: '处理中', handler: '那日苏', elapsed: '3h' },
  { id: 'GX-0909-007', type: '报修', village: '乌兰陶勒盖嘎查', summary: '冬季防冻保温层破损，管段外露', stage: '处理中', handler: '额尔敦', elapsed: '9h' },
  { id: 'GX-0910-004', type: '报修', village: '呼格吉勒图嘎查', summary: '供水点总阀门无法关闭', stage: '处理中', handler: '巴特尔', elapsed: '1.2h' },
  { id: 'GT-0909-002', type: '投诉', village: '乌日根塔拉镇查干淖尔嘎查', summary: '夜间停水频繁，请求错峰公示', stage: '处理中', handler: '娜仁高娃', elapsed: '20h' },
  { id: 'GX-0909-005', type: '报修', village: '哈日阿图嘎查', summary: '管道排气阀失效，气堵不出水', stage: '处理中', handler: '朝鲁', elapsed: '14h' },
  { id: 'GX-0908-004', type: '报修', village: '赛罕塔拉嘎查', summary: '入户水表冻裂（夜间低温）', stage: '已办结', handler: '朝鲁', elapsed: '2天3h' },
  { id: 'GT-0908-003', type: '投诉', village: '都希乌苏嘎查', summary: '水费公示不及时，请求按月公示', stage: '已办结', handler: '娜仁高娃', elapsed: '1天8h' },
  { id: 'GX-0907-003', type: '报修', village: '乌兰陶勒盖嘎查', summary: '水塔液位计失灵，持续溢流', stage: '已办结', handler: '巴特尔', elapsed: '3天6h' },
  { id: 'GX-0906-002', type: '报修', village: '赛罕乌力吉苏木宝楞嘎查', summary: '消毒设备加药管堵塞，加药中断', stage: '已办结', handler: '朝鲁', elapsed: '4天2h' },
  { id: 'GT-0907-001', type: '投诉', village: '巴彦杭盖嘎查', summary: '报修 24 小时未响应，请求督办', stage: '已办结', handler: '娜仁高娃', elapsed: '2天18h' },
];

/* ============ 后端真数据行契约（/api/portal/notices · /api/repairs） ============ */

/** GET /api/portal/notices items 行 */
export interface NoticeApiRow {
  id: number | string;
  title: string;
  type: string;
  content: string;
  /** 涉及苏木乡镇 */
  su_mu: string | null;
  channel: string;
  created: string;
}

/** GET /api/repairs items 行 */
export interface RepairApiRow {
  ticket: string;
  category: string;
  phone: string;
  location: string;
  description: string | null;
  status: string;
  created: string;
}

/* ============ 近 7 日受理趋势（TrendLine 数据） ============ */
export const weekTrend = {
  xLabels: ['09-04', '09-05', '09-06', '09-07', '09-08', '09-09', '09-10'],
  repair: [5, 6, 4, 7, 6, 8, 6],
  complaint: [1, 2, 1, 0, 2, 1, 2],
};

/* ============ 满意度评价（五星分布） ============ */
export interface SatisfactionData {
  /** 综合得分（5 分制） */
  overall: number;
  /** 评价总人次 */
  total: number;
  /** 五星 → 一星 评价数 */
  stars: Array<{ level: number; count: number }>;
}

export const satisfaction: SatisfactionData = {
  overall: 4.6,
  total: 312,
  stars: [
    { level: 5, count: 218 },
    { level: 4, count: 72 },
    { level: 3, count: 16 },
    { level: 2, count: 4 },
    { level: 1, count: 2 },
  ],
};

/** 星级条着色：五星金 / 四星绿 / 三星青 / 二星紫 / 一星灰 */
export const STAR_COLORS: Record<number, string> = {
  5: 'var(--steppe-amber)',
  4: 'var(--spring-green)',
  3: 'var(--flood-teal)',
  2: 'var(--chart-6)',
  1: 'var(--status-stop)',
};

/* ============ 知识宣传 ============ */
export type ArticleCategory = '饮水安全' | '水源保护' | '冬季防冻' | '管护知识';

export interface ArticleItem {
  id: string;
  category: ArticleCategory;
  title: string;
  /** 阅读量（次） */
  reads: number;
  publishedAt: string;
}

export const ARTICLE_META: Record<ArticleCategory, { color: string }> = {
  饮水安全: { color: 'var(--spring-green)' },
  水源保护: { color: 'var(--flood-teal)' },
  冬季防冻: { color: 'var(--chart-6)' },
  管护知识: { color: 'var(--steppe-amber)' },
};

export const articles: ArticleItem[] = [
  { id: 'K-01', category: '饮水安全', title: '牧区饮水安全四项指标解读（浊度/余氯/pH/菌落）', reads: 1286, publishedAt: '09-08' },
  { id: 'K-02', category: '冬季防冻', title: '入冬前水表与入户管道防冻五步法', reads: 1123, publishedAt: '09-07' },
  { id: 'K-03', category: '水源保护', title: '水源井周边 30 米保护区禁牧禁建须知', reads: 967, publishedAt: '09-05' },
  { id: 'K-04', category: '管护知识', title: '家中漏水自查与关阀步骤图解', reads: 854, publishedAt: '09-04' },
  { id: 'K-05', category: '饮水安全', title: '发现水质异常怎么办？三步上报流程', reads: 742, publishedAt: '09-02' },
  { id: 'K-06', category: '管护知识', title: '远传水表使用常见问题 10 问', reads: 631, publishedAt: '09-01' },
];

/* ============ 便民服务卡 ============ */
export const serviceInfo = {
  hotline: '0479-6231 234',
  hotlineLabel: '供水服务热线 · 24 小时值守',
  supervise: '0479-6212 345',
  superviseLabel: '服务质量监督电话',
  hours: '营业厅 周一至周五 08:30–17:30',
  online: '公众号「右旗供水」· 小程序「牧区供水」',
  /** 支持的在线事项（对应需求：水量水费查询/在线报修/进度查询/满意度评价） */
  items: ['水量水费查询', '在线报修', '进度查询', '满意度评价'],
} as const;
