/**
 * 告警事件 mock 工厂
 * 6 条告警：
 *   - 1 重大爆管 (burst, 重大)
 *   - 2 较大水泵过载 (equipment, 较大)
 *   - 1 较大水质超限 (water_quality, 较大)
 *   - 2 一般离线 (power_outage, 一般)
 * 状态：3 未签收 + 2 已派单 + 1 已签收
 * 时间：相对当前时刻 -N 分钟（N ∈ [5, 180]）
 * 确定性：mulberry32 seed=45
 */

import type { EmergencyEvent, Project } from '@shared/types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface AlertSpec {
  type: EmergencyEvent['type'];
  level: EmergencyEvent['level'];
  status: EmergencyEvent['status'];
  description: string;
}

const ALERT_SPECS: AlertSpec[] = [
  {
    type: 'burst',
    level: '重大',
    status: '未签收',
    description: '主干管 DN200 突发爆管，赛汉塔拉镇南侧区域停水，影响约 3200 户',
  },
  {
    type: 'equipment',
    level: '较大',
    status: '未签收',
    description: 'A-03 工程 1# 水泵过载，电流持续 48A 超过额定 40A',
  },
  {
    type: 'equipment',
    level: '较大',
    status: '已派单',
    description: 'B-05 工程水源井变频器告警，频率异常波动',
  },
  {
    type: 'water_quality',
    level: '较大',
    status: '未签收',
    description: 'C-12 工程出厂水浊度 2.8 NTU 超标（国标 ≤1），需现场核查',
  },
  {
    type: 'power_outage',
    level: '一般',
    status: '已派单',
    description: 'C-19 工程停电告警，市电中断，已切换柴油发电机',
  },
  {
    type: 'power_outage',
    level: '一般',
    status: '已签收',
    description: 'D-0042 供水点离线 4 小时，疑似设备故障，运维已到场',
  },
];

const RECEIVERS = ['巴特尔', '斯日娜', '朝鲁', '乌云娜'];

/**
 * 生成 6 条告警事件
 * @param projects 主工程（A/B/C），爆管/水泵事件优先关联 A 级
 * @param now 当前时刻（默认 Date.now），便于测试注入固定时间
 */
export function genAlerts(projects: Project[], now: number = Date.now()): EmergencyEvent[] {
  const rand = mulberry32(45);
  const mainProjects = projects.filter((p) => p.grade !== 'D');
  const gradeA = mainProjects.filter((p) => p.grade === 'A');
  const gradeBC = mainProjects.filter((p) => p.grade !== 'A');

  const events: EmergencyEvent[] = [];

  ALERT_SPECS.forEach((spec, idx) => {
    let proj: Project;
    if (spec.type === 'burst') {
      proj = gradeA[Math.floor(rand() * Math.max(1, gradeA.length))];
    } else if (spec.type === 'equipment') {
      const pool = [...gradeA, ...gradeBC];
      proj = pool[Math.floor(rand() * pool.length)];
    } else if (spec.type === 'water_quality') {
      proj = gradeBC[Math.floor(rand() * Math.max(1, gradeBC.length))];
    } else {
      // power_outage — 可关联 D 级（离线事件）
      const pool = [...mainProjects];
      proj = pool[Math.floor(rand() * pool.length)];
    }

    const minutesAgo = 5 + Math.floor(rand() * 176); // 5-180
    const ts = new Date(now - minutesAgo * 60_000).toISOString();

    const event: EmergencyEvent = {
      id: `ALERT-${String(idx + 1).padStart(3, '0')}`,
      time: ts,
      type: spec.type,
      level: spec.level,
      suMu: proj.suMu,
      projectId: proj.id,
      location: proj.name,
      description: spec.description,
      status: spec.status,
    };

    if (spec.status === '已派单' || spec.status === '已签收') {
      event.receivedBy = RECEIVERS[Math.floor(rand() * RECEIVERS.length)];
    }
    if (spec.status === '已签收') {
      // 签收时刻相对告警 +5 ~ +30 min
      const signedOffset = (5 + Math.floor(rand() * 26)) * 60_000;
      event.resolvedAt = new Date(now - minutesAgo * 60_000 + signedOffset).toISOString();
    }

    events.push(event);
  });

  // 时间倒序（最新在前）
  events.sort((a, b) => (a.time < b.time ? 1 : -1));
  return events;
}
