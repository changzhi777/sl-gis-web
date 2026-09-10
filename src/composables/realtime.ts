/**
 * realtime.ts — 实时数据引擎（真 SSE + 模拟数据流双模式）
 *
 * 频道来源（2 期现状）：
 *   alert   — 真 SSE：/api/sse/alerts?token=（nano-api 后端推 biz_alert 存量与增量）
 *   monitor/kpi/pump — 纯前端模拟（后端暂未提供，接口形态已对齐）
 *
 * 降级策略：SSE 连接失败（本地无后端 / 网络断）→ 自动回落模拟告警，页面无感
 *
 * 使用方式：
 *   import { realtime, onRealtime, realtimeState } from '@/composables/realtime';
 *   realtime.start({ monitors, alertPool });   // 大屏/SCADA/应急 三页同款
 *   const off = onRealtime('alert', (evt) => { ... });
 *   realtime.stop();
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
  /** 告警模板池：SSE 未连通时回落用 */
  alertPool: EmergencyEvent[];
  /** A 级工程池：pump 频道生成泵组状态（不订阅 pump 可不传） */
  aProjects?: Project[];
}

type Listener = (event: RealtimeEvent) => void;

const listeners = new Map<string, Set<Listener>>();
const _running = ref(false);
const _latency = ref(0);
const _sseConnected = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;
let tick = 0;
let source: RealtimeSource | null = null;
let alertSeq = 0;
let es: EventSource | null = null;
let sseRetry = 0;
let sseRetryTimer: ReturnType<typeof setTimeout> | null = null;
const ALERT_MAX_PER_SESSION = 6;
const TOKEN_KEY = 'slgis_token';

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

/** 低频产生模拟新告警（SSE 已连通时跳过——真告警优先） */
function maybeEmitAlert(): void {
  if (_sseConnected.value) return;
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

/* ================= 真 SSE（alert 频道） ================= */

/** 取令牌：本地缓存 → demo 账号自动登录（VITE_DEMO_USER/PASS 可覆盖） */
async function ensureToken(): Promise<string | null> {
  const cached = localStorage.getItem(TOKEN_KEY);
  if (cached) return cached;
  const user = (import.meta.env.VITE_DEMO_USER as string | undefined) ?? 'admin';
  const pass = (import.meta.env.VITE_DEMO_PASS as string | undefined) ?? 'admin123';
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
    });
    const j = await r.json();
    if (j.code === 0 && j.data?.token) {
      localStorage.setItem(TOKEN_KEY, j.data.token);
      return j.data.token as string;
    }
  } catch { /* 本地无后端 → 回落 mock */ }
  return null;
}

function closeSSE(): void {
  if (es) { es.close(); es = null; }
  _sseConnected.value = false;
}

async function connectSSE(): Promise<void> {
  const token = await ensureToken();
  if (!token) return; // 无后端 → mock 告警兜底
  es = new EventSource(`/api/sse/alerts?token=${encodeURIComponent(token)}`);
  es.onopen = () => {
    _sseConnected.value = true;
    sseRetry = 0;
    console.info('[realtime] SSE 已连接（alert 频道走真后端）');
  };
  es.onmessage = (ev) => {
    try {
      const payload = JSON.parse(ev.data) as RealtimeEvent;
      if (!payload.channel) return;
      if (payload.channel === 'alert' && payload.data?.id) {
        // 后端 data 缺 time 字段 → 用 ts 补（前端 EmergencyEvent 契约）
        emit('alert', { ...payload.data, time: new Date(payload.ts || Date.now()).toISOString() });
      } else {
        // monitor / kpi / pump 形状后端已按前端契约推，直通
        emit(payload.channel, payload.data);
      }
    } catch (e) {
      console.warn('[realtime] SSE 消息解析失败', e);
    }
  };
  es.onerror = () => {
    // EventSource 会自动重连；令牌过期(401)时主动重建登录态
    closeSSE();
    if (sseRetry >= 3) return; // 3 次后放弃 → mock 兜底
    sseRetry++;
    localStorage.removeItem(TOKEN_KEY); // 强制下次重新登录拿新令牌
    sseRetryTimer = setTimeout(() => { void connectSSE(); }, 5000 * sseRetry);
  };
}

/** 带令牌的 GET fetch（自动 ensureToken；失败返回 null，调用方降级） */
export async function apiFetch<T>(path: string): Promise<T | null> {
  const token = await ensureToken();
  if (!token) return null;
  try {
    const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const j = (await r.json()) as { code: number; data: T };
    return j.code === 0 ? j.data : null;
  } catch {
    return null;
  }
}

/** 引擎运行状态（只读） */
export const realtimeState = readonly({ running: _running, latency: _latency, sseConnected: _sseConnected });

export const realtime = {
  start(src?: RealtimeSource): void {
    if (_running.value) return;
    source = src ?? null;
    _running.value = true;
    void connectSSE();
    // 3s 推一轮（弱实时 · 分钟级场景）；SSE 连通时四频道全由服务端驱动，本地仅维护时延假数据
    timer = setInterval(() => {
      tick++;
      _latency.value = Math.floor(Math.random() * 30 + 5);
      if (_sseConnected.value) return;

      // monitor：每轮随机 3 点抖动
      emit('monitor', {
        points: sampleMonitors(3).map(m => ({ id: m.id, type: m.type, value: jitterValue(m) })),
      });

      // alert：SSE 未连通时低频模拟
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
    if (sseRetryTimer) { clearTimeout(sseRetryTimer); sseRetryTimer = null; }
    closeSSE();
    _running.value = false;
  },
};
