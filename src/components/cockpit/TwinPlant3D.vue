<!--
  TwinPlant3D.vue — 交互孪生第五态（three.js L1 厂区全景 · X 光线框风）
  · three 动态 import 懒加载：主包零增量，首次激活才拉取分包
  · 场景（程序化几何 ~40 mesh）：深蓝地台 + 净水车间/清水池/加压泵房/加药间 + 发光工艺管线 + 水流粒子
  · 数据绑定：stations 状态色映射(SSE) · poolLevel 水位 · alarm 告警光柱 · 点击建筑 → emit pick
  · 混合镜头：自动环绕 → OrbitControls 拖拽接管 → 静置 8s 平滑回归
  · 性能：非激活停 RAF · DPR clamp 2 · 几何预算 ≤40 · 深蓝雾统一氛围
  用法：<TwinPlant3D :active="heroView==='3d'" :stations="..." :pool-level="n" :alarm="b" @pick="fn" />
-->
<template>
  <div ref="host" class="t3d" :class="{ ready }">
    <div v-if="!ready" class="t3d-loading"><span class="dot" />三维引擎加载中…</div>
    <div v-if="picked" class="t3d-tip">
      <b>{{ picked.name }}</b>
      <span>{{ picked.status === 'normal' ? '运行正常' : picked.status === 'warning' ? '预警关注' : '故障停机' }}</span>
      <i>{{ picked.detail }}</i>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

export interface T3dStation {
  key: string;          // 场景建筑标识: treat/pool/pump/dosing
  name: string;
  status: 'normal' | 'warning' | 'fault';
  detail: string;       // 浮窗第二行（如 水质 98.2% / 2运1备 / 液位 82%）
}

const props = withDefaults(
  defineProps<{
    active: boolean;
    stations?: T3dStation[];
    poolLevel?: number;
    alarm?: boolean;
  }>(),
  { active: false, stations: () => [], poolLevel: 82, alarm: false },
);
const emit = defineEmits<{ pick: [s: T3dStation | null] }>();

const host = ref<HTMLDivElement | null>(null);
const ready = ref(false);
const picked = ref<T3dStation | null>(null);

type Ctx = {
  renderer: any; scene: any; camera: any; controls: any;
  raf: number; stop: boolean; clock: any;
  stationMeshes: Map<string, any[]>;
  particles: any; waterMesh: any; beacon: any; beaconMat: any;
  autoAngle: number; lastInteract: number;
  loop: () => void;
  dispose: () => void;
};
let ctx: Ctx | null = null;
let startToken = 0;

const C = {
  bg: 0x060c16, deep: 0x0a1220, teal: 0x00c2ff, green: 0x00ffe0,
  amber: 0xffb454, coral: 0xff6f52, mint: 0x7ee081,
};
const statusColor = (s: string) => (s === 'normal' ? C.green : s === 'warning' ? C.amber : C.coral);

async function start(): Promise<void> {
  if (!host.value || ctx) return;
  const token = ++startToken;

  // 懒加载 three 主模块与控制器（并行）
  const [THREE, { OrbitControls }] = await Promise.all([
    import('three'),
    import('three/examples/jsm/controls/OrbitControls.js'),
  ]);
  if (token !== startToken || !host.value) return;

  const el = host.value;
  const W = () => el.clientWidth || 800;
  const H = () => el.clientHeight || 600;

  /* ---------- 渲染器 / 场景 / 相机 ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  scene.fog = new THREE.Fog(C.bg, 900, 2200);

  const camera = new THREE.PerspectiveCamera(42, W() / H(), 1, 5000);
  const HOME = new THREE.Vector3(760, 540, 760);
  camera.position.copy(HOME);
  camera.lookAt(0, 40, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 40, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 260;
  controls.maxDistance = 1700;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.enablePan = false;
  controls.addEventListener('start', () => { if (ctx) ctx.lastInteract = performance.now(); });

  /* ---------- 灯光（线框风以自发光为主，灯只做面亮度） ---------- */
  scene.add(new THREE.AmbientLight(0xbfd9ff, 0.7));
  const dir = new THREE.DirectionalLight(0x9fd0ff, 0.9);
  dir.position.set(400, 600, 300);
  scene.add(dir);

  /* ---------- 材质工厂 ---------- */
  const glass = (color: number, opacity = 0.16) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const edges = (color: number, opacity = 0.85) =>
    new THREE.LineBasicMaterial({ color, transparent: true, opacity });

  /** X 光建筑：半透明体 + 发光描边 */
  function building(w: number, h: number, d: number, x: number, z: number, ry = 0, tone = C.teal) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glass(tone, 0.14));
    body.position.y = h / 2;
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), edges(tone, 0.9));
    wire.position.y = h / 2;
    g.add(body, wire);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    return g;
  }

  /* ---------- 地台 ---------- */
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(560, 560, 14, 64), glass(C.deep, 0.85));
  plat.position.y = -7;
  scene.add(plat);
  const platEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.CylinderGeometry(560, 560, 14, 64, 1, true)),
    edges(C.teal, 0.5),
  );
  platEdge.position.y = -7;
  scene.add(platEdge);
  // 地台网格
  const grid = new THREE.GridHelper(1000, 20, C.teal, C.teal);
  (grid.material as any).transparent = true;
  (grid.material as any).opacity = 0.1;
  grid.position.y = 0.5;
  scene.add(grid);

  /* ---------- 建筑群（与 SVG 孪生同布局语言） ---------- */
  const stationMeshes = new Map<string, any[]>();
  const reg = (key: string, ...objs: any[]) => stationMeshes.set(key, objs.filter(Boolean));

  const treat = building(300, 130, 200, -60, -80, 0, C.teal);
  reg('treat', treat);
  const pump = building(180, 90, 140, 150, 120, 0.15, C.teal);
  reg('pump', pump);
  const dosing = building(110, 66, 90, -230, 130, -0.1, C.teal);
  reg('dosing', dosing);

  // 清水池（圆柱 + 动态水面）
  const pool = new THREE.Group();
  const poolBody = new THREE.Mesh(new THREE.CylinderGeometry(110, 110, 60, 40), glass(C.teal, 0.13));
  poolBody.position.y = 30;
  const poolWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.CylinderGeometry(110, 110, 60, 40, 1, true)),
    edges(C.teal, 0.8),
  );
  poolWire.position.y = 30;
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x005f8f, transparent: true, opacity: 0.6 });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(104, 104, 2, 40), waterMat);
  water.position.y = 6;
  pool.add(poolBody, poolWire, water);
  pool.position.set(230, 0, -140);
  scene.add(pool);
  reg('pool', pool);

  /* ---------- 工艺管线（曲线管 + 水流粒子 · 绕行泵房北侧） ---------- */
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(80, 60, -190), new THREE.Vector3(170, 46, -210), new THREE.Vector3(260, 34, -180),
    new THREE.Vector3(330, 40, -60), new THREE.Vector3(300, 44, 30),
  ]);
  const pipeMat = new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.35 });
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 3.2, 8, false), pipeMat);
  scene.add(pipe);

  const COUNT = 220;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const p = curve.getPoint((i % 24) / 24);
    positions.set([p.x, p.y, p.z], i * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({ color: C.green, size: 4, transparent: true, opacity: 0.95 });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ---------- 告警光柱（alarm 时亮起 · 细光束） ---------- */
  const beaconMat = new THREE.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: 0.0 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 7, 220, 10, 1, true), beaconMat);
  beacon.position.set(-60, 170, -80);
  scene.add(beacon);

  /* ---------- 点击拾取 ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downXY: [number, number] | null = null;
  const onDown = (e: PointerEvent) => { downXY = [e.clientX, e.clientY]; };
  const onUp = (e: PointerEvent) => {
    if (!downXY || !ctx) return;
    const dx = e.clientX - downXY[0], dy = e.clientY - downXY[1];
    downXY = null;
    if (dx * dx + dy * dy > 25) return; // 拖拽不算点击
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...stationMeshes.values()].flat(), true);
    if (!hits.length) { picked.value = null; emit('pick', null); return; }
    let obj: any = hits[0].object;
    while (obj) {
      const found = [...stationMeshes.entries()].find(([, objs]) => objs.includes(obj) || objs.some((o) => o === obj));
      if (found) {
        const st = props.stations.find((s) => s.key === found[0]);
        if (st) { picked.value = st; emit('pick', st); return; }
      }
      obj = obj.parent;
    }
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  /* ---------- 尺寸自适应 ---------- */
  const ro = new ResizeObserver(() => {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
  });
  ro.observe(el);

  /* ---------- 渲染循环：自动环绕 + 静置回归 + 全部动效（单循环结构） ---------- */
  const clock = new THREE.Clock();
  let stop = false;
  let autoAngle = 0;
  let lastInteract = performance.now();

  function tick(): void {
    if (stop) return;
    const t = clock.getElapsedTime();

    // 混合镜头：无交互 8s 后自动环绕（lerp 平滑回归）
    if (performance.now() - lastInteract > 8000) {
      autoAngle += 0.0016;
      const r = 980;
      const target = new THREE.Vector3(Math.cos(autoAngle) * r, 400, Math.sin(autoAngle) * r);
      camera.position.lerp(target, 0.008);
      camera.lookAt(controls.target);
    }
    controls.update();

    // 水流粒子沿管线流动
    const arr = (particles.geometry.attributes.position as any).array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const u = ((t * 0.12 + i / 24) % 1);
      const p = curve.getPoint(u);
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    (particles.geometry.attributes.position as any).needsUpdate = true;

    // 水池液位（props.poolLevel 0-100 → y 6..52）
    const wy = 6 + (Math.min(100, Math.max(0, props.poolLevel)) / 100) * 46;
    water.position.y += (wy - water.position.y) * 0.05;

    // 告警光柱脉动
    const targetO = props.alarm ? 0.4 + Math.sin(t * 3) * 0.12 : 0;
    beaconMat.opacity += (targetO - beaconMat.opacity) * 0.06;

    renderer.render(scene, camera);
  }
  function loop(): void {
    if (stop || !ctx) return;
    ctx.raf = requestAnimationFrame(loop);
    tick();
  }
  // controls 交互时刷新 lastInteract（接管镜头，静置 8s 后回归自动环绕）
  controls.addEventListener('start', () => { lastInteract = performance.now(); });
  controls.addEventListener('change', () => { lastInteract = performance.now(); });

  ready.value = true;
  ctx = {
    renderer, scene, camera, controls, raf: 0, stop, clock,
    stationMeshes, particles, waterMesh: water, beacon, beaconMat,
    autoAngle, lastInteract, loop,
    dispose: () => {
      stop = true;
      cancelAnimationFrame(ctx?.raf ?? 0);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      scene.traverse((o: any) => { o.geometry?.dispose?.(); if (o.material) o.material.dispose?.(); });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  loop();
}

function stopLoop(): void {
  if (ctx) { cancelAnimationFrame(ctx.raf); ctx.raf = 0; }
}
function resumeLoop(): void {
  if (ctx && !ctx.raf) {
    ctx.clock.getDelta();
    ctx.loop();
  }
}

watch(() => props.active, (on) => {
  if (on && !ctx) { void start(); }
  else if (on && ctx) resumeLoop();
  else if (!on && ctx) stopLoop();
});
watch(() => props.stations, () => {
  if (!ctx) return;
  for (const [key, objs] of ctx.stationMeshes) {
    const st = props.stations.find((s) => s.key === key);
    if (!st) continue;
    const c = statusColor(st.status);
    for (const o of objs) {
      o.traverse?.((child: any) => {
        if (child.isLineSegments && child.material?.color) child.material.color.setHex(c);
      });
    }
  }
}, { deep: true });

onBeforeUnmount(() => { startToken++; ctx?.dispose(); ctx = null; });
</script>

<style scoped>
.t3d {
  position: absolute; inset: 0;
  overflow: hidden;
}
.t3d :deep(canvas) { display: block; }
.t3d-loading {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 12px; color: var(--text-dim);
  background: linear-gradient(180deg, rgba(10, 18, 32, 0.6), rgba(6, 12, 22, 0.72));
}
.t3d-loading .dot {
  width: 6px; height: 6px; border-radius: 50%; background: #00c2ff;
  margin-right: 8px; box-shadow: 0 0 8px #00c2ff; animation: t3-pulse 1.2s infinite;
}
@keyframes t3-pulse { 50% { opacity: 0.25; } }

.t3d-tip {
  position: absolute; right: 16px; top: 16px; z-index: 5;
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 14px; border-radius: 10px;
  background: rgba(15, 26, 43, 0.55);
  backdrop-filter: blur(18px) saturate(1.5);
  -webkit-backdrop-filter: blur(18px) saturate(1.5);
  border: 1px solid rgba(0, 194, 255, 0.32);
}
.t3d-tip b { font-size: 13px; color: var(--text); }
.t3d-tip span { font-size: 11px; color: var(--spring-green); }
.t3d-tip i { font-style: normal; font-size: 11px; color: var(--text-dim); }

@media (prefers-reduced-motion: reduce) {
  .t3d-loading .dot { animation: none; }
}
</style>
