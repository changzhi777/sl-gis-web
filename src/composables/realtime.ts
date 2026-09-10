/**
 * realtime.ts — 实时数据引擎（SSE 客户端 + 模拟数据流）
 *
 * 1 期：纯前端模拟（setInterval 推数据），接口设计兼容 SSE
 * 2 期：把 start() 里的 mock 定时器换成 new EventSource('/api/sse/...') 即可无缝切换
 *
 * 使用方式：
 *   import { realtime, onRealtime } from '@/composables/realtime';
 *   realtime.start({ monitors: mockData.monitors, alertPool: mockData.alerts });
 *   const off = onRealtime('monitor', (evt) => { ... });
 *   off();                         // 取消订阅
 *   realtime.stop();               // 停止
 *
 * 频道：
 *   monitor — 测点实时值  { points: [{ id, type, value }] }   （每轮随机 3 点抖动）
 *   alert   — 新告警      EmergencyEvent（未签收，置顶用）      （低频概率产生）
 *   kpi     — 驾驶舱 KPI  { onlineRate, qualityRate, ... }      （每 5 轮）
 *   pump    — A 级站泵组  { stations: [{ projectId, pumps, current, pressure }] }（每 3 轮）
 */
import { readonly, ref } from 'vue';
import type { EmergencyEvent, MonitorPoint, Project } from '@shared/types';

export interface RealtimeEvent {
  channel: 'monitor' | 'alert' | 'kpi' | 'pump';
  data: Record<string, unknown>;
  ts: number;
}

export interface RealtimeSource {
  /** 测点池：monitor 频道从中随机抽样抖动 */
  monitors: MonitorPoint[];
  /** 告警模板池：alert 频道抽模板换 id/time 生成"新"告警 */
  alertPool: EmergencyEvent[];
  /** A 级工程池：pump 频道生成泵组状态（不订阅 pump 可不传） */
  aProjects?: Project[];
}

type Listener = (event: RealtimeEvent) => void;

const listeners = new Map<string, Set<Listener>>();
const _running = ref(false);
const _latency = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
let tick = 0;
let source: RealtimeSource | null = null;
let alertSeq = 0;
const ALERT_MAX_PER_SESSION = 6;

/** 订阅频道 */
export function onRealtime(channel: RealtimeEvent['channel'], fn: Listener): () => void {
  if (!listeners.has(channel)) listeners.set(channel, new Set());
  listeners.get(channel)!.add(fn);
  return () => listeners.get(channel)?.delete(fn);
}

/** 广播（模拟 SSE 推送） */
function emit(channel: RealtimeEvent['channel'], data: Record<string, unknown>): void {
  const evt: RealtimeEvent = { channel, data, ts: Date.now() };
  listeners.get(channel)?.forEach(fn => {
    try { fn(evt); } catch (e) { console.warn('[realtime] listener error', e); }
  });
}

/** 按测点类型取抖动幅度（行业合理波动量级） */
const JITTER_BY_TYPE: Record<MonitorPoint['type'], number> = {
  pressure: 0.03,
  flow: 4,
  quality: 0.1,
  level: 0.2,
};

function jitterValue(m: MonitorPoint): number {
  const amp = JITTER_BY_TYPE[m.type];
  return +(m.value + (Math.random() - 0.5) * 2 * amp).toFixed(m.type === 'flow' ? 1 : 2);
}

/** 从测点池随机挑 n 个（不重复） */
function sampleMonitors(n: number): MonitorPoint[] {
  if (!source) return [];
  const pool = [...source.monitors];
  const out: MonitorPoint[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

/** 泵站状态模板（与 SCADA pumpsFor 同口径：status → 三泵态） */
const PUMP_STATES: Record<string, Array<{ running: boolean }>> = {
  normal: [{ running: true }, { running: true }, { running: false }],
  alarm: [{ running: true }, { running: false }, { running: false }],
  repair: [{ running: false }, { running: true }, { running: false }],
  stop: [{ running: false }, { running: false }, { running: false }],
  offline: [{ running: false }, { running: false }, { running: false }],
};

function buildPumpPayload(): Record<string, unknown> {
  if (!source?.aProjects?.length) return {};
  const stations = source.aProjects.slice(0, 6).map(p => {
    const tpl = PUMP_STATES[p.status] ?? PUMP_STATES.normal;
    return {
      projectId: p.id,
      status: p.status,
      current: +(((p.metrics.pumpCurrent ?? 0) + (Math.random() - 0.5) * 2).toFixed(1)),
      pressure: +(((p.metrics.pressure ?? 0) + (Math.random() - 0.5) * 0.02).toFixed(2)),
      pumps: tpl.map((s, i) => ({
        tag: `${i + 1}#`,
        running: s.running,
        freq: s.running ? +(14 + Math.random() * 6).toFixed(1) : 0,
      })),
    };
  });
  return { stations };
}

/** 低频产生新告警（模板换 id/time，限流） */
function maybeEmitAlert(): void {
  if (!source || source.alertPool.length === 0) return;
  if (alertSeq >= ALERT_MAX_PER_SESSION) return;
  if (Math.random() > 0.06) return; // ~每 50s 一条
  const tpl = source.alertPool[Math.floor(Math.random() * source.alertPool.length)];
  alertSeq++;
  emit('alert', {
    ...tpl,
    id: `EV-RT-${String(alertSeq).padStart(3, '0')}`,
    time: new Date().toISOString(),
    status: '未签收',
  });
}

/** 引擎运行状态（只读） */
export const realtimeState = readonly({ running: _running, latency: _latency });

export const realtime = {
  start(src?: RealtimeSource): void {
    if (_running.value) return;
    source = src ?? null;
    _running.value = true;
    // 3s 推一轮（弱实时 · 分钟级场景）
    timer = setInterval(() => {
      tick++;
      _latency.value = Math.floor(Math.random() * 30 + 5);

      // monitor：每轮随机 3 点抖动
      emit('monitor', {
        points: sampleMonitors(3).map(m => ({ id: m.id, type: m.type, value: jitterValue(m) })),
      });

      // alert：低频概率
      maybeEmitAlert();

      // kpi：每 5 轮
      if (tick % 5 === 0) {
        emit('kpi', {
          onlineRate: +(91.6 + (Math.random() - 0.5)).toFixed(1),
          qualityRate: +(98.2 + (Math.random() - 0.5) * 0.4).toFixed(1),
          totalFlow: +(1.42 + (Math.random() - 0.5) * 0.06).toFixed(2),
          powerKwh: Math.round(3860 + (Math.random() - 0.5) * 80),
        });
      }

      // pump：每 3 轮，全部 A 级站
      if (tick % 3 === 0) {
        emit('pump', buildPumpPayload());
      }
    }, 3000);
  },

  stop(): void {
    if (timer) { clearInterval(timer); timer = null; }
    _running.value = false;
  },
};
