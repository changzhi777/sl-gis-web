/**
 * Mock 数据总入口 — Track C 唯一出口
 *
 * 1 期恒 USE_MOCK = true；2 期接 FastAPI 后端时切换为 false
 * 所有数据在模块加载时一次性生成（确定性，PRNG seed 锁死）
 * 不依赖 Vue / Pinia / main.ts，可在 Node 单元测试中直接 require
 */

import { genProjects } from './factories/projects';
import { genPipes } from './factories/pipes';
import { genMonitors } from './factories/monitors';
import { genAlerts } from './factories/alerts';
import { genCockpit } from './factories/cockpit';

// ---- 一次性生成（确定性） ----
const projects = genProjects();
const pipes = genPipes(projects);
const monitors = genMonitors(projects);
const alerts = genAlerts(projects);
const cockpit = genCockpit();

/** 1 期恒 true，2 期通过环境变量或远程开关切换 */
export const USE_MOCK = true;

/** mock 数据包（冻结防误改） */
export const mockData = Object.freeze({
  projects,
  pipes,
  monitors,
  alerts,
  cockpit,
});

export default mockData;
