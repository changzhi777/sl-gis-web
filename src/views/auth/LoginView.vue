<!--
  LoginView.vue — 全屏登录页（/login · meta.bare 独立布局）
  · 左品牌区（六边形+水珠标识 / 系统名 / 一句话简介 / 值守四问）· 右毛玻璃登录卡
  · 1920×1080 逻辑画布 + fitScale 等比（与 AppShell 同款「分辨率统一模式」）
  · 契约：POST /api/auth/login {username,password}
      → 成功 {code:0, data:{id,username,nickname,token}}；失败 {code:400, msg:"账号或密码错误"}（HTTP 200）
  · 成功写 localStorage['slgis_token']（与 realtime.ts TOKEN_KEY 同键 → SSE/apiFetch 自动复用）
  · 设计稿：docs/design/login/login-spec.md
-->
<template>
  <div class="login-stage">
    <div class="login-shell" :style="shellStyle">
      <!-- 背景层 -->
      <div class="lg-bg" aria-hidden="true">
        <div class="lg-art" :style="{ backgroundImage: `url(${bgUrl})` }"></div>
        <div class="lg-veil"></div>
      </div>

      <!-- 左：品牌区 -->
      <section class="lg-brand">
        <div class="lg-logo">
          <svg class="lg-mark" viewBox="0 0 64 64" aria-hidden="true">
            <defs>
              <linearGradient id="lgGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#00C2FF" />
                <stop offset="1" stop-color="#00FFE0" />
              </linearGradient>
            </defs>
            <!-- 六边形 = 工程 A 级形状语言 -->
            <path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" fill="none"
                  stroke="url(#lgGrad)" stroke-width="2" stroke-linejoin="round" opacity=".9" />
            <!-- 水珠 = favicon 同源造型 -->
            <path d="M32 21c-6 7.5-10 12.4-10 17a10 10 0 0 0 20 0c0-4.6-4-9.5-10-17Z"
                  fill="url(#lgGrad)" opacity=".92" />
          </svg>
          <span class="lg-wordmark num">SL-GIS</span>
        </div>
        <h1 class="lg-title">旗县县域统管农村供水管理平台</h1>
        <p class="lg-sub">面向内蒙古牧区旗县的农村供水数字底座 —— 一张图掌握全域，一套账管清工程。</p>
        <ul class="lg-feats">
          <li>数据有人看</li><li>告警有人接</li><li>工单有人办</li><li>结果有人核</li>
        </ul>
      </section>

      <!-- 右：登录区 -->
      <section class="lg-auth">
        <form class="lg-card" novalidate :aria-busy="loading" @submit.prevent="submit">
          <div class="lg-card-head"><h2>账号登录</h2><span>SL-GIS 值守入口</span></div>

          <label class="lg-field">
            <span class="lg-label">账号</span>
            <input
              ref="userInput"
              v-model="username"
              class="lg-input"
              type="text"
              autocomplete="username"
              placeholder="请输入账号"
              :disabled="loading"
            />
          </label>
          <label class="lg-field">
            <span class="lg-label">密码</span>
            <input
              v-model="password"
              class="lg-input"
              type="password"
              autocomplete="current-password"
              placeholder="请输入密码"
              :disabled="loading"
            />
          </label>

          <!-- 错误行恒存 20px 高（报错出现不推挤按钮）· :key 重放抖动动画 -->
          <p :key="errSeq" class="lg-err" :class="{ 'has-err': errMsg }" role="alert">
            <template v-if="errMsg"><span aria-hidden="true">⚠</span>{{ errMsg }}</template>
          </p>

          <button class="lg-submit" type="submit" :disabled="loading">
            <span v-if="loading" class="lg-spinner" aria-hidden="true"></span>
            <span>{{ loading ? '登录中…' : '登录' }}</span>
          </button>
          <p class="lg-hint">演示账号 admin / admin123</p>
        </form>
      </section>

      <!-- 底注 -->
      <footer class="lg-foot">
        <span class="num">SL-GIS v10.4</span>
        <span>内蒙古牧区旗县农村供水统管平台</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@stores/app';

interface LoginResp {
  code: number;
  msg?: string;
  data?: { id?: number; username?: string; nickname?: string; token?: string };
}

const TOKEN_KEY = 'slgis_token'; // 与 composables/realtime.ts TOKEN_KEY 同键
const bgUrl = `${import.meta.env.BASE_URL}img/cockpit-bg.webp`; // 子路径部署必须带 BASE_URL 前缀

const app = useAppStore();
const route = useRoute();
const router = useRouter();

const username = ref('');
const password = ref('');
const loading = ref(false);
const errMsg = ref('');
const errSeq = ref(0);
const userInput = ref<HTMLInputElement | null>(null);

/** 与 AppShell 同款分辨率统一模式：恒 1920×1080 逻辑画布 fit 等比 */
const shellStyle = computed(() => ({ transform: `scale(${app.fitScale.toFixed(4)})` }));

function syncViewport(): void {
  app.viewport = { w: window.innerWidth, h: window.innerHeight };
}

function showErr(msg: string): void {
  errMsg.value = msg;
  errSeq.value += 1; // 重复报错时重放抖动动画
}

async function submit(): Promise<void> {
  if (loading.value) return; // 防重入（Enter 连打 / 双击）
  const u = username.value.trim();
  if (!u || !password.value) {
    showErr('请输入账号和密码');
    return;
  }
  errMsg.value = '';
  loading.value = true;
  let succeeded = false;
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: password.value }),
    });
    const j = (await r.json().catch(() => null)) as LoginResp | null;
    if (j && j.code === 0 && j.data?.token) {
      localStorage.setItem(TOKEN_KEY, j.data.token);
      succeeded = true;
      // redirect 白名单：站内相对路径，防 // 协议相对跳转
      const q = route.query.redirect;
      const redirect = typeof q === 'string' && q.startsWith('/') && !q.startsWith('//') ? q : '/dashboard';
      router.replace(redirect);
      return;
    }
    // 后端统一壳：失败走 body.code=400 + msg（HTTP 200）；兼容真 HTTP 4xx 与非 JSON 响应
    showErr(j
      ? (j.msg?.trim() || (r.ok ? '账号或密码错误' : `登录失败（HTTP ${r.status}）`))
      : '服务响应异常，请重试');
  } catch {
    showErr('无法连接服务器，请检查网络后重试');
  } finally {
    if (!succeeded) loading.value = false; // 成功保持 loading，直到路由切走，防按钮回弹闪烁
  }
}

onMounted(() => {
  syncViewport();
  window.addEventListener('resize', syncViewport);
  userInput.value?.focus();
});
onBeforeUnmount(() => window.removeEventListener('resize', syncViewport));
</script>

<style scoped>
/* ============ 舞台：1920×1080 逻辑画布 + fit 缩放 ============ */
.login-stage { width: 100vw; height: 100vh; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.login-shell { flex: none; width: 1920px; height: 1080px; position: relative; display: flex; overflow: hidden; background: var(--well-deep); transform-origin: center center; }

/* ============ 背景层 z0 ============ */
.lg-bg {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(1100px 700px at 80% -10%, rgba(0, 194, 255, .14), transparent 62%),
    radial-gradient(860px 560px at 6% 110%, rgba(0, 255, 224, .08), transparent 60%),
    linear-gradient(180deg, var(--well-deep) 0%, #060c16 100%);
}
.lg-art { position: absolute; inset: 0; background-position: center; background-size: cover; opacity: .55; }
.lg-veil { position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(3, 8, 18, .94) 0%, rgba(3, 8, 18, .66) 46%, rgba(3, 8, 18, .42) 100%);
}
.lg-bg::before { /* 52px 网格 · cockpit-v2 同款 */
  content: ''; position: absolute; inset: 0; z-index: 2; opacity: .5;
  background-image:
    linear-gradient(rgba(0, 194, 255, .05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 194, 255, .05) 1px, transparent 1px);
  background-size: 52px 52px;
  -webkit-mask-image: radial-gradient(ellipse 62% 55% at 50% 42%, #000 25%, transparent 78%);
          mask-image: radial-gradient(ellipse 62% 55% at 50% 42%, #000 25%, transparent 78%);
}
.lg-bg::after { /* 底部水波 · cockpit-v2 同款 data-URI */
  content: ''; position: absolute; inset: 0; z-index: 3; opacity: .5;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='120' viewBox='0 0 240 120'%3E%3Cg fill='none' stroke='%2300c2ff' stroke-opacity='0.16'%3E%3Cpath d='M-20 90 Q 60 40 130 88 T 280 60'/%3E%3Cpath d='M-20 106 Q 60 58 130 104 T 280 76' stroke-opacity='0.09'/%3E%3C/g%3E%3C/svg%3E") repeat-x bottom / 240px 120px;
}

/* ============ 左：品牌区 ============ */
.lg-brand { position: relative; z-index: 2; flex: none; width: 1076px; display: flex; flex-direction: column; justify-content: center; padding: 0 96px 0 128px; }
.lg-logo { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.lg-mark { width: 60px; height: 60px; flex: none;
  filter: drop-shadow(0 0 8px rgba(0, 255, 224, .30));
  animation: lg-glow 3.2s ease-in-out infinite 1s; }
.lg-wordmark { font-size: 26px; font-weight: 700; letter-spacing: 6px; color: var(--text); }

.lg-title { margin: 0; font-size: 38px; font-weight: 700; letter-spacing: 2px; line-height: 1.35; }
.lg-title::after { content: ''; display: block; width: 64px; height: 3px; margin-top: 20px; border-radius: 2px;
  background: linear-gradient(90deg, var(--flood-teal), var(--spring-green));
  box-shadow: 0 0 10px rgba(0, 255, 224, .4); }
.lg-sub { margin: 20px 0 0; max-width: 560px; font-size: 15px; line-height: 1.9; letter-spacing: .5px; color: var(--text-dim); }
.lg-feats { display: flex; gap: 22px; margin: 32px 0 0; padding: 0; list-style: none; }
.lg-feats li { display: flex; align-items: center; gap: 8px; font-size: 12px; letter-spacing: 1px; color: var(--text-dim); }
.lg-feats li::before { content: ''; width: 6px; height: 6px; flex: none; background: var(--flood-teal);
  transform: rotate(45deg); box-shadow: 0 0 6px rgba(0, 194, 255, .6); }

/* ============ 右：登录区 ============ */
.lg-auth { position: relative; z-index: 2; flex: 1; display: grid; place-items: center; }
.lg-card {
  width: 400px; padding: 32px 40px 28px;
  background: rgba(15, 26, 43, .62);
  backdrop-filter: blur(24px) saturate(1.5); -webkit-backdrop-filter: blur(24px) saturate(1.5);
  border: 1px solid rgba(0, 194, 255, .32); border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .06), 0 8px 28px rgba(0, 0, 0, .45);
}
.lg-card-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 24px; }
.lg-card-head::before { content: ''; width: 3px; height: 14px; align-self: center; border-radius: 2px;
  background: linear-gradient(180deg, var(--flood-teal), var(--spring-green)); }
.lg-card-head h2 { margin: 0; font-size: 16px; font-weight: 600; }
.lg-card-head span { font-size: 11px; color: var(--text-dim); }

.lg-field { display: flex; flex-direction: column; gap: 8px; }
.lg-field + .lg-field { margin-top: 20px; }
.lg-label { font-size: 12px; font-weight: 500; letter-spacing: .5px; color: var(--text-dim); }
.lg-input {
  height: 44px; padding: 0 14px; font-size: 14px; font-family: var(--cn); color: var(--text);
  background: rgba(3, 8, 18, .6); border: 1px solid var(--line-vein); border-radius: var(--radius);
  transition: border-color .15s ease;
}
.lg-input::placeholder { color: var(--text-dim); opacity: .65; }
.lg-input:focus { border-color: rgba(0, 255, 224, .5); }
.lg-input:disabled { opacity: .55; cursor: not-allowed; }
/* Chrome 自动填充修正 */
.lg-input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px #071525 inset; -webkit-text-fill-color: var(--text); }

.lg-err { display: flex; align-items: center; gap: 6px; height: 20px; margin: 10px 0 0;
  font-size: 12px; color: var(--status-alarm); }
.lg-err.has-err { animation: lg-shake .24s ease; }

.lg-submit {
  width: 100%; height: 44px; margin-top: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 15px; font-weight: 700; letter-spacing: 6px; text-indent: 6px; color: #031018;
  background: linear-gradient(90deg, var(--flood-teal), var(--spring-green));
  border: none; border-radius: var(--radius); cursor: pointer;
  transition: filter .15s ease, box-shadow .15s ease, transform .12s ease;
}
.lg-submit:hover:not(:disabled) { filter: brightness(1.06); box-shadow: 0 0 20px rgba(0, 255, 224, .35); }
.lg-submit:active:not(:disabled) { transform: translateY(1px); }
.lg-submit:disabled { opacity: .65; cursor: not-allowed; box-shadow: none; }
.lg-spinner { width: 14px; height: 14px; flex: none; border-radius: 50%;
  border: 2px solid rgba(3, 16, 24, .3); border-top-color: #031018; animation: lg-spin .8s linear infinite; }
.lg-hint { margin: 16px 0 0; text-align: center; font-size: 11px; color: var(--text-dim); opacity: .8; letter-spacing: .5px; }

/* ============ 底注 ============ */
.lg-foot { position: absolute; z-index: 3; left: 48px; bottom: 24px; display: flex; align-items: center; gap: 12px;
  font-size: 11px; letter-spacing: 1px; color: var(--text-dim); opacity: .75; }

/* ============ 入场编排（cockpit 同款缓动） + 微动效 ============ */
@keyframes lg-in    { from { opacity: 0; transform: translateY(10px); } }
@keyframes lg-spin  { to   { transform: rotate(360deg); } }
@keyframes lg-shake { 25%  { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
@keyframes lg-glow  { 50%  { filter: drop-shadow(0 0 14px rgba(0, 255, 224, .55)); } }
.lg-logo    { animation: lg-in .6s cubic-bezier(.22, 1, .36, 1) both .05s; }
.lg-title   { animation: lg-in .6s cubic-bezier(.22, 1, .36, 1) both .15s; }
.lg-sub     { animation: lg-in .6s cubic-bezier(.22, 1, .36, 1) both .25s; }
.lg-feats   { animation: lg-in .6s cubic-bezier(.22, 1, .36, 1) both .35s; }
.lg-card    { animation: lg-in .6s cubic-bezier(.22, 1, .36, 1) both .30s; }

@media (prefers-reduced-motion: reduce) {
  .lg-logo, .lg-title, .lg-sub, .lg-feats, .lg-card { animation: none; }
  .lg-mark { animation: none; }
  .lg-err.has-err { animation: none; }
  .lg-submit { transition: none; }
  /* spinner 保留：转圈是功能性加载指示，非装饰 */
}
</style>
