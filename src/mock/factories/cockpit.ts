/**
 * 驾驶舱 KPI mock 工厂
 * 严格按 project-sl-gis-mock-baselines.md 行业基准值硬编码
 *
 * 工程总数 58（含 D 级合并口径）：
 *   45 normal + 3 alarm + 2 repair + 1 stop + 7 offline
 * 集中供水率 68%
 * 当日供水量 1.42 万 m³
 * 设备在线率 91.6% / 数据完整率 96.4% / 工单办结率 87.5% / 收缴率 76.3% / 漏损率 18.1%
 * 告警 3 条 / 未签收 3
 */

import type { CockpitKpi, Status } from '@shared/types';

export function genCockpit(): CockpitKpi {
  const statusBreakdown: Record<Status, number> = {
    normal: 45,
    alarm: 3,
    repair: 2,
    stop: 1,
    offline: 7,
  };

  return {
    totalProjects: 58,
    statusBreakdown,
    coverage: {
      villages: 52,        // 已覆盖嘎查村
      totalVillages: 76,
      population: 4.76,    // 万人
      rate: 68,            // 集中供水率 %
    },
    water: {
      todaySupply: 1.42,   // 万 m³
      todayPowerKwh: 2_860,
    },
    quality: {
      qualifiedRate: 96.2,    // %
      deviceOnlineRate: 91.6, // %
      dataCompleteRate: 96.4, // %
    },
    ops: {
      workOrderCloseRate: 87.5, // %
      paymentRate: 76.3,        // %
      lossRate: 18.1,           // 漏损率 %
    },
    alarms: { total: 3, unsigned: 3 },
  };
}
