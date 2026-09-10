/**
 * system/mock.ts — 系统管理大屏页内确定性 mock（需求 §十二 组织权限与系统管理）
 * 口径：
 * · 权限模型参考 mini-rbac：用户/角色/菜单 + user_role/role_menu（菜单即权限）
 * · 组织树：旗水利局 → 旗农村供水统管公司 → 7 苏木乡镇站 → 嘎查村管水员
 *   （7 个苏木乡镇名与 src/shared/sumu-anchors.ts 实取坐标同名，勿虚构）
 * · 全部字面量、无随机；时间口径 2026-09-10
 */

/* ============ 组织架构树 ============ */

export type OrgLevel = 'county' | 'company' | 'township' | 'village';

export interface OrgNode {
  id: string;
  name: string;
  level: OrgLevel;
  /** 本节点直挂用户数（嘎查村末级 = 管水员 1 人口径） */
  userCount: number;
  children: OrgNode[];
}

/** 7 个苏木乡镇站下的嘎查村（mock 命名，符合牧区嘎查口径） */
function village(id: string, name: string): OrgNode {
  return { id, name, level: 'village', userCount: 1, children: [] };
}

/** 苏木乡镇站：直挂管理员/运维 2 人 + 旗下嘎查村各 1 名管水员 */
function township(id: string, name: string, villages: Array<[string, string]>): OrgNode {
  return {
    id,
    name,
    level: 'township',
    userCount: 2,
    children: villages.map(([vid, vname]) => village(vid, vname)),
  };
}

export const orgTree: OrgNode[] = [
  {
    id: 'org-county',
    name: '苏尼特右旗水利局',
    level: 'county',
    userCount: 3,
    children: [
      {
        id: 'org-company',
        name: '旗农村供水统管公司',
        level: 'company',
        userCount: 8,
        children: [
          township('org-shtt', '赛汉塔拉镇站', [
            ['org-v-shtt-1', '巴彦杭盖嘎查'],
            ['org-v-shtt-2', '陶力嘎查'],
            ['org-v-shtt-3', '乌兰嘎查'],
            ['org-v-shtt-4', '都呼木嘎查'],
          ]),
          township('org-zrhe', '朱日和镇站', [
            ['org-v-zrhe-1', '哈日淖尔嘎查'],
            ['org-v-zrhe-2', '巴彦高勒嘎查'],
            ['org-v-zrhe-3', '查干乌苏嘎查'],
          ]),
          township('org-wrgt', '乌日根塔拉镇站', [
            ['org-v-wrgt-1', '巴彦敖包嘎查'],
            ['org-v-wrgt-2', '乌日根塔拉嘎查'],
            ['org-v-wrgt-3', '赛汉呼都嘎嘎查'],
          ]),
          township('org-erne', '额仁淖尔苏木站', [
            ['org-v-erne-1', '巴彦杭盖嘎查'],
            ['org-v-erne-2', '呼嘎日吉嘎查'],
            ['org-v-erne-3', '阿尔善图嘎查'],
          ]),
          township('org-sblg', '桑宝拉格苏木站', [
            ['org-v-sblg-1', '巴彦乌拉嘎查'],
            ['org-v-sblg-2', '查干楚鲁图嘎查'],
          ]),
          township('org-shwl', '赛罕乌力吉苏木站', [
            ['org-v-shwl-1', '舒图嘎查'],
            ['org-v-shwl-2', '巴彦楚鲁嘎查'],
            ['org-v-shwl-3', '都希乌苏嘎查'],
          ]),
          township('org-qtzl', '阿其图乌拉苏木站', [
            ['org-v-qtzl-1', '巴彦德勒嘎查'],
            ['org-v-qtzl-2', '乌日根高勒嘎查'],
          ]),
        ],
      },
    ],
  },
];

/* ============ 角色（mini-rbac role 表口径） ============ */

export interface SysRole {
  id: string;
  name: string;
  /** 分级权限级别 */
  level: '平台级' | '县级' | '乡镇级' | '村级' | '外部机构';
  userCount: number;
}

/** 列表顺序即权限矩阵列顺序，勿随意调换 */
export const roles: SysRole[] = [
  { id: 'role-admin', name: '系统管理员', level: '平台级', userCount: 2 },
  { id: 'role-bureau', name: '县水利局监管员', level: '县级', userCount: 3 },
  { id: 'role-dispatch', name: '统管单位调度员', level: '县级', userCount: 6 },
  { id: 'role-township', name: '苏木乡镇管理员', level: '乡镇级', userCount: 7 },
  { id: 'role-maintain', name: '运维人员', level: '乡镇级', userCount: 12 },
  { id: 'role-lab', name: '检测机构', level: '外部机构', userCount: 2 },
  { id: 'role-village', name: '村级管水员', level: '村级', userCount: 20 },
];

/* ============ 用户（sys_user 口径，演示取 12 条） ============ */

export interface SysUser {
  id: string;
  account: string;
  name: string;
  role: string;
  org: string;
  /** 最后登录 MM-DD HH:mm；从未登录为 '—' */
  lastLogin: string;
  enabled: boolean;
  /** 权限复核已到期/临期（30 日复核周期口径） */
  reviewDue: boolean;
}

export const users: SysUser[] = [
  { id: 'u-01', account: 'admin', name: '超管', role: '系统管理员', org: '旗农村供水统管公司', lastLogin: '09-10 08:02', enabled: true, reviewDue: false },
  { id: 'u-02', account: 'slj_wang', name: '王建军', role: '县水利局监管员', org: '苏尼特右旗水利局', lastLogin: '09-09 16:40', enabled: true, reviewDue: false },
  { id: 'u-03', account: 'slj_li', name: '李梅', role: '县水利局监管员', org: '苏尼特右旗水利局', lastLogin: '09-08 10:15', enabled: true, reviewDue: true },
  { id: 'u-04', account: 'dd_zhao', name: '赵国栋', role: '统管单位调度员', org: '旗农村供水统管公司', lastLogin: '09-10 07:46', enabled: true, reviewDue: false },
  { id: 'u-05', account: 'dd_qian', name: '钱秀兰', role: '统管单位调度员', org: '旗农村供水统管公司', lastLogin: '09-09 21:03', enabled: true, reviewDue: false },
  { id: 'u-06', account: 'xz_batu', name: '巴特尔', role: '苏木乡镇管理员', org: '赛汉塔拉镇站', lastLogin: '09-10 06:55', enabled: true, reviewDue: false },
  { id: 'u-07', account: 'xz_sun', name: '孙志强', role: '苏木乡镇管理员', org: '朱日和镇站', lastLogin: '09-07 18:22', enabled: false, reviewDue: true },
  { id: 'u-08', account: 'yw_alr', name: '阿如拉', role: '运维人员', org: '额仁淖尔苏木站', lastLogin: '09-10 08:31', enabled: true, reviewDue: false },
  { id: 'u-09', account: 'yw_eed', name: '额尔登', role: '运维人员', org: '桑宝拉格苏木站', lastLogin: '09-09 14:47', enabled: true, reviewDue: false },
  { id: 'u-10', account: 'lab_hu', name: '胡日查', role: '检测机构', org: '旗水质检测中心（委托）', lastLogin: '09-08 09:20', enabled: true, reviewDue: true },
  { id: 'u-11', account: 'gs_nsbe', name: '那顺巴雅尔', role: '村级管水员', org: '阿其图乌拉苏木·巴彦德勒嘎查', lastLogin: '09-10 07:12', enabled: true, reviewDue: false },
  { id: 'u-12', account: 'gs_qqg', name: '奇琪格', role: '村级管水员', org: '赛罕乌力吉苏木·舒图嘎查', lastLogin: '—', enabled: false, reviewDue: false },
];

/* ============ 菜单权限矩阵（role_menu 口径：行=菜单模块，列=角色） ============ */

export interface PermRow {
  menu: string;
  /** 与 roles 数组顺序一一对应 */
  grants: boolean[];
}

/** 最小权限口径：系统管理仅系统管理员；外部机构只开放水质与统计 */
export const permMatrix: PermRow[] = [
  { menu: '综合驾驶舱', grants: [true, true, true, true, false, false, false] },
  { menu: '工程一张图', grants: [true, true, true, true, false, false, false] },
  { menu: '运行监测', grants: [true, true, true, true, true, false, false] },
  { menu: '水质管理', grants: [true, true, true, false, true, true, false] },
  { menu: '巡检工单', grants: [true, true, true, true, true, false, false] },
  { menu: '收费服务', grants: [true, false, true, false, false, false, false] },
  { menu: '应急调度', grants: [true, true, true, true, true, false, false] },
  { menu: '统计考核', grants: [true, true, true, false, false, true, false] },
  { menu: '系统管理', grants: [true, false, false, false, false, false, false] },
];

/* ============ 操作日志（全程留痕口径，演示最近 12 条） ============ */

export interface OpLog {
  id: string;
  time: string;
  user: string;
  role: string;
  action: string;
  target: string;
  ip: string;
  result: '成功' | '失败';
  /** 敏感操作：权限变更/删除/导出/远控指令，前端红标 */
  sensitive: boolean;
}

export const opLogs: OpLog[] = [
  { id: 'L-12', time: '09-10 08:42', user: 'admin', role: '系统管理员', action: '修改角色权限', target: '村级管水员 · 增加水质上报', ip: '10.30.16.2', result: '成功', sensitive: true },
  { id: 'L-11', time: '09-10 08:31', user: 'yw_alr', role: '运维人员', action: '扫码巡检签到', target: '额仁淖尔 3# 水源井', ip: '10.42.88.17', result: '成功', sensitive: false },
  { id: 'L-10', time: '09-10 08:15', user: 'dd_zhao', role: '统管单位调度员', action: '远控指令下发（双重确认）', target: 'PRJ-A-02 · 2# 水泵启动', ip: '10.30.16.31', result: '成功', sensitive: true },
  { id: 'L-09', time: '09-10 07:58', user: 'xz_batu', role: '苏木乡镇管理员', action: '审核派单', target: 'GD-20260910-013', ip: '10.42.11.5', result: '成功', sensitive: false },
  { id: 'L-08', time: '09-10 07:46', user: 'dd_zhao', role: '统管单位调度员', action: '登录系统', target: 'Web 端', ip: '10.30.16.31', result: '成功', sensitive: false },
  { id: 'L-07', time: '09-10 07:20', user: 'admin', role: '系统管理员', action: '导出用户台账', target: 'Excel · 52 条', ip: '10.30.16.2', result: '成功', sensitive: true },
  { id: 'L-06', time: '09-09 22:10', user: 'lab_hu', role: '检测机构', action: '上传水质检测报告', target: '9 月第 2 批 · 12 份', ip: '10.60.4.9', result: '成功', sensitive: false },
  { id: 'L-05', time: '09-09 20:41', user: 'dd_zhao', role: '统管单位调度员', action: '远控指令下发（双重确认）', target: 'PRJ-B-07 · 阀门切换', ip: '10.30.16.31', result: '失败', sensitive: true },
  { id: 'L-04', time: '09-09 16:40', user: 'slj_wang', role: '县水利局监管员', action: '登录系统', target: 'Web 端', ip: '10.30.2.8', result: '成功', sensitive: false },
  { id: 'L-03', time: '09-09 15:26', user: 'admin', role: '系统管理员', action: '禁用账户（复核未通过）', target: 'xz_sun · 孙志强', ip: '10.30.16.2', result: '成功', sensitive: true },
  { id: 'L-02', time: '09-09 11:48', user: 'dd_qian', role: '统管单位调度员', action: '下发停水公告', target: '桑宝拉格苏木 · 2 个嘎查', ip: '10.30.16.29', result: '成功', sensitive: false },
  { id: 'L-01', time: '09-09 09:05', user: 'admin', role: '系统管理员', action: '账户清理（90 天未登录）', target: '过期账户 2 个', ip: '10.30.16.2', result: '成功', sensitive: true },
];

/** 今日全量操作数（平台日志全量口径；opLogs 仅展示最近 12 条） */
export const TODAY_OPS = 47;

/* ============ 外部数据交换接口（需求 §十二 预留 6 路） ============ */

export type ApiStatus = '正常' | '异常' | '未接入';

export interface ExtApi {
  id: string;
  name: string;
  status: ApiStatus;
  /** 最近同步时间；未接入为 '—' */
  lastSync: string;
}

export const extApis: ExtApi[] = [
  { id: 'api-water', name: '自治区水资源管理系统', status: '正常', lastSync: '09-10 06:00' },
  { id: 'api-permit', name: '取水许可管理系统', status: '正常', lastSync: '09-10 05:30' },
  { id: 'api-weather', name: '旗气象局气象服务', status: '正常', lastSync: '09-10 08:00' },
  { id: 'api-emergency', name: '旗应急管理平台', status: '异常', lastSync: '09-09 19:12' },
  { id: 'api-finance', name: '旗财政补贴发放系统', status: '未接入', lastSync: '—' },
  { id: 'api-superior', name: '上级农村供水信息平台', status: '未接入', lastSync: '—' },
];
