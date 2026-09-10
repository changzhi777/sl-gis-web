/**
 * Stage — WebGL 总控
 * - WebGLRenderer (antialias) + setPixelRatio
 * - PerspectiveCamera(30°, aspect, 1, 30000) + OrbitControls（左旋/中缩/右平移）
 * - 相机位置 13524797, 3662134, 1220 风格（smartcity 实测）
 * - controllers.target = 旗中心墨卡托（BaseMapLayer bbox）
 * - RenderLoop: Clock.getDelta → 各 layer.update(dt) → renderer.render
 * - Raycaster 拾取（hitTest）
 * - EventBus: on/off/emit（事件名 layer:click, layer:hover）
 * - window.STAGE_FREEZE 钩子（Playwright 视觉回归用）
 *
 * 默认导出 Stage 单例工厂；Dashboard.vue 可 `import Stage from '@/components/canvas/Stage'`
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BaseLayer } from './BaseLayer';
import { BaseMapLayer } from './BaseMapLayer';
import { PipeLayer } from './PipeLayer';
import { ProjectLayer } from './ProjectLayer';
import { MonitorLayer } from './MonitorLayer';
import { AlertLayer } from './AlertLayer';
import { FlyLineLayer } from './FlyLineLayer';
import { CityLayer } from './CityLayer';
import { ModelLayer } from './ModelLayer';
import { GroundLayer } from './GroundLayer';
import { PlantLayer } from './PlantLayer';
import { TownshipLayer } from './TownshipLayer';
import { TileLayer } from './TileLayer';
import { pickAt, pickIds, type PickableEntry } from './hitTest';
import { lon2xy } from './utils/lon2xy';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Project, PipeSegment, MonitorPoint, EmergencyEvent } from '@/shared/types';

/* 内联最小 GeoJSON 类型（避免依赖 @types/geojson） */
declare namespace GeoJSON {
  export interface FeatureCollection {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry?: {
        type: string;
        coordinates: number[][][] | number[][][][];
      };
    }>;
  }
}

declare global {
  interface Window {
    STAGE_FREEZE?: boolean;
  }
}

type LayerName =
  | 'Plant'
  | 'Township'
  | 'Tile'
  | 'Ground'
  | 'BaseMap'
  | 'Pipe'
  | 'Project'
  | 'Monitor'
  | 'Alert'
  | 'FlyLine'
  | 'City'
  | 'Model';

interface StageOptions {
  container: HTMLElement;
}

export class Stage {
  readonly container: HTMLElement;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private labelRenderer!: CSS2DRenderer;
  private controls!: OrbitControls;
  private clock = new THREE.Clock();
  private rafId = 0;
  private resizeObserver?: ResizeObserver;

  /** 全部图层 — 名字 → BaseLayer 实例 */
  private layers = new Map<LayerName, BaseLayer>();
  /** 业务可拾取 entries（Project / Monitor 注入） */
  private pickEntries: PickableEntry[] = [];
  /** 拾取用 mesh 列表 */
  private pickMeshes: THREE.Object3D[] = [];

  /** 简单 EventBus */
  private listeners = new Map<string, Set<(payload: unknown) => void>>();

  constructor(opts: StageOptions) {
    this.container = opts.container;
    this.initRenderer();
    this.initCamera();
    this.initControls();
    this.initLayers();
    this.bindDom();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  /* ---------------- 初始化 ---------------- */

  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setClearColor(new THREE.Color('#030812'), 1);
    this.container.appendChild(this.renderer.domElement);
    // CSS2D 标签层（覆盖在 canvas 上，pointerEvents none 不挡交互）
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    const labelDom = this.labelRenderer.domElement;
    labelDom.style.position = 'absolute';
    labelDom.style.top = '0';
    labelDom.style.left = '0';
    labelDom.style.pointerEvents = 'none';
    this.container.appendChild(labelDom);
    this.renderer.domElement.style.display = 'block';
  }

  private initCamera(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    // far 必须覆盖墨卡托场景尺度：相机飞行高度 ~100 万单位 + 场景对角线
    this.camera = new THREE.PerspectiveCamera(30, w / h, 1, 8000000);
    this.camera.position.set(13524797, 3662134, 1220);
    this.camera.lookAt(0, 0, 0);
  }

  private initControls(): void {
    // 场景 z 朝上 — 相机 up 必须同向，polar 才是"俯仰角"
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    // 俯仰 25°–75° 可调，初始 25°；平移禁用（旗县恒居中）
    this.controls.minPolarAngle = (25 / 180) * Math.PI;
    this.controls.maxPolarAngle = (75 / 180) * Math.PI;
    this.controls.enablePan = false;
    this.controls.minDistance = 80000;
    this.controls.maxDistance = 800000;
    this.controls.update();
  }

  /** 一键复位：回初始 25° 俯仰 + 旗县居中 + 默认缩放 */
  resetView(): void {
    this.setCityBBoxFromBase();
  }

  private initLayers(): void {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x030812, 400000, 5000000);

    // 灯光：Lambert 材质无光即全黑（建筑/构筑物需要）
    this.scene.add(new THREE.AmbientLight(0xbfdcff, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(-0.45, -0.6, 1.0).normalize(); // 西北上空斜射（UI/UX 规范 #2）
    this.scene.add(dir);

    const ground = new GroundLayer();
    const plant = new PlantLayer();
    const township = new TownshipLayer();
    const tile = new TileLayer();
    const baseMap = new BaseMapLayer();
    const pipe = new PipeLayer();
    const project = new ProjectLayer();
    const monitor = new MonitorLayer();
    const alert = new AlertLayer();
    const fly = new FlyLineLayer();
    const city = new CityLayer();
    const model = new ModelLayer();

    // 通用 addLayer 封装
    const addLayer = (layer: BaseLayer) => {
      layer.init(this.renderer, this.scene, this.camera);
      this.layers.set(layer.name as LayerName, layer);
      // 把 group 加进 scene（layer 暴露 getObject3D）
      const o3d = (layer as unknown as { getObject3D?: () => THREE.Object3D }).getObject3D?.();
      if (o3d) this.scene.add(o3d);
    };

    addLayer(ground);
    addLayer(tile);
    addLayer(township);
    addLayer(plant);
    addLayer(baseMap);
    addLayer(pipe);
    addLayer(project);
    addLayer(monitor);
    addLayer(alert);
    addLayer(fly);
    addLayer(city);
    addLayer(model);
    addLayer(plant);
  }

  private bindDom(): void {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('click', this.onPointerClick);
    window.addEventListener('resize', this.onResize);
    // v-scale-screen 缩放不触发 window resize；用 ResizeObserver 监听容器
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.container);
    }
    // 兜底：v-scale-screen 异步缩放完成前 container.clientWidth=0，3 次重设保险
    setTimeout(() => this.onResize(), 100);
    setTimeout(() => this.onResize(), 300);
    setTimeout(() => this.onResize(), 800);
  }

  private onResize = (): void => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // 通知所有 layer 同步尺寸（Line2 必需）
    for (const layer of this.layers.values()) {
      try { (layer as { onResize?: (w: number, h: number) => void }).onResize?.(w, h); } catch {}
    }
  };

  /* ---------------- 数据注入（业务侧调用） ---------------- */

  setProjects(projects: Project[]): void {
    const proj = this.layers.get('Project') as ProjectLayer | undefined;
    proj?.setData(projects);
    // 拾取
    this.pickEntries = [];
    this.pickMeshes = [];
    if (proj) {
      this.pickEntries.push(...proj.getPickables());
      proj.getPickables().forEach(p => this.pickMeshes.push(p.mesh));
    }
    // 同时喂入 ModelLayer（A 级）/ PlantLayer（A 级水厂）
    const model = this.layers.get('Model') as ModelLayer | undefined;
    model?.setProjects(projects);
    const plant = this.layers.get('Plant') as PlantLayer | undefined;
    plant?.setPlants(projects);
  }

  setPipes(pipes: PipeSegment[]): void {
    const pipe = this.layers.get('Pipe') as PipeLayer | undefined;
    pipe?.setData(pipes);
  }

  setMonitors(monitors: MonitorPoint[]): void {
    const monitor = this.layers.get('Monitor') as MonitorLayer | undefined;
    monitor?.setData(monitors);
    this.pickEntries = [];
    this.pickMeshes = [];
    if (monitor) {
      this.pickEntries.push(...monitor.getPickables());
      monitor.getPickables().forEach(p => this.pickMeshes.push(p.mesh));
    }
  }

  setAlerts(events: EmergencyEvent[]): void {
    const alert = this.layers.get('Alert') as AlertLayer | undefined;
    alert?.setData(events);
    // 围幕 → 等 BaseMap bbox 拿到后再 build
    const base = this.layers.get('BaseMap') as BaseMapLayer | undefined;
    const bbox = base?.getBBox();
    if (bbox) {
      void this.fetchBoundaryForWall(alert ?? null, bbox);
    }
  }

  private async fetchBoundaryForWall(alert: AlertLayer | null, _bbox: unknown): Promise<void> {
    if (!alert) return;
    try {
      const r = await fetch('/geo/banner.json');
      const fc = (await r.json()) as GeoJSON.FeatureCollection;
      for (const f of fc.features) {
        const g = f.geometry;
        if (!g) continue;
        if (g.type === 'Polygon') {
          const ring = (g.coordinates as number[][][])[0] as [number, number][];
          alert.setBoundary(ring);
          return;
        }
        if (g.type === 'MultiPolygon') {
          const ring = (g.coordinates as number[][][][])[0][0] as [number, number][];
          alert.setBoundary(ring);
          return;
        }
      }
    } catch (err) {
      console.warn('[Stage] banner.json for wall fetch failed', err);
    }
  }

  setFlyLines(monitors: MonitorPoint[], factory: Project): void {
    const fly = this.layers.get('FlyLine') as FlyLineLayer | undefined;
    fly?.setData(monitors, factory);
  }

  /** 尝试飞相机到旗县 bbox；成功返回 true（数据未就绪返回 false，调用方应轮询） */
  setCityBBoxFromBase(): boolean {
    const base = this.layers.get('BaseMap') as BaseMapLayer | undefined;
    const city = this.layers.get('City') as CityLayer | undefined;
    if (!base || !city) return false;
    const bbox = base.getBBox();
    if (!bbox) return false;
    city.setBBox({
      minLon: bbox.minLon,
      maxLon: bbox.maxLon,
      minLat: bbox.minLat,
      maxLat: bbox.maxLat,
    });
    // 相机对准旗县中心：高度按墨卡托跨度算
    // 视场：PerspectiveCamera fov=30°(垂直)，可见宽 ≈ 2·h·tan15°·aspect ≈ 0.7·h
    // 要让旗县全境入镜且留边：h = 2.8 × 墨卡托跨度
    const a = lon2xy(bbox.minLon, bbox.minLat);
    const b = lon2xy(bbox.maxLon, bbox.maxLat);
    const spanMercator = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    const altitude = Math.max(spanMercator * 2.8, 400000);
    // 初始俯仰 25°：相机从旗县南侧上空斜视（北边界远、南边界近，有纵深）
    const tilt = (25 / 180) * Math.PI;
    const southOff = altitude * Math.sin(tilt);
    const height = altitude * Math.cos(tilt);
    this.camera.position.set(bbox.centerX, bbox.centerY - southOff, height);
    this.controls.target.set(bbox.centerX, bbox.centerY, 0);
    this.controls.update();
    const g = this.layers.get('Ground') as GroundLayer | undefined;
    g?.buildForBBox({ minLon: bbox.minLon, maxLon: bbox.maxLon, minLat: bbox.minLat, maxLat: bbox.maxLat });
    const tw = this.layers.get('Township') as TownshipLayer | undefined;
    tw?.build();
    const tl = this.layers.get('Tile') as TileLayer | undefined;
    tl?.buildForBBox({ minLon: bbox.minLon, maxLon: bbox.maxLon, minLat: bbox.minLat, maxLat: bbox.maxLat });
    return true;
  }

  setCityDensity(density: 'low' | 'mid' | 'high'): void {
    const city = this.layers.get('City') as CityLayer | undefined;
    city?.setDensity(density);
  }

  setBaseMapType(type: 'dark' | 'satellite' | 'tech'): void {
    const base = this.layers.get('BaseMap') as BaseMapLayer | undefined;
    base?.setBaseMapType(type);
  }

  setLayerVisible(name: LayerName, visible: boolean): void {
    const layer = this.layers.get(name);
    if (!layer) return;
    layer.setVisible(visible);
    const o3d = (layer as unknown as { getObject3D?: () => THREE.Object3D }).getObject3D?.();
    o3d?.traverse(o => {
      o.visible = visible;
    });
  }

  /* ---------------- EventBus ---------------- */

  on(event: string, handler: (payload: unknown) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: (payload: unknown) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, payload?: unknown): void {
    this.listeners.get(event)?.forEach(h => h(payload));
  }

  /* ---------------- 拾取 ---------------- */

  private ndcFromEvent(ev: PointerEvent): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    return { x, y };
  }

  private onPointerMove = (ev: PointerEvent): void => {
    const ndc = this.ndcFromEvent(ev);
    const ids = pickIds({
      camera: this.camera,
      sceneMeshes: this.pickMeshes,
      entries: this.pickEntries,
      mouseNDC: ndc,
    });
    if (ids.length) {
      const monitor = this.layers.get('Monitor') as MonitorLayer | undefined;
      monitor?.handleHover(ids[0]);
      this.emit('layer:hover', ids[0]);
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      const monitor = this.layers.get('Monitor') as MonitorLayer | undefined;
      monitor?.handleHover(null);
      this.renderer.domElement.style.cursor = 'default';
    }
  };

  private onPointerClick = (ev: MouseEvent): void => {
    const ndc = this.ndcFromEvent(ev as unknown as PointerEvent);
    const hit = pickAt({
      camera: this.camera,
      sceneMeshes: this.pickMeshes,
      entries: this.pickEntries,
      mouseNDC: ndc,
    });
    if (!hit) return;
    const id = this.pickEntries.find(e => e.mesh === hit.mesh || e.mesh === hit.mesh.parent)?.id;
    if (!id) return;
    // ProjectLayer 单独转发
    const proj = this.layers.get('Project') as ProjectLayer | undefined;
    proj?.handleClick(id);
    this.emit('layer:click', id);
  };

  /* ---------------- RenderLoop ---------------- */

  private loop(): void {
    if (typeof window !== 'undefined' && window.STAGE_FREEZE) {
      // 冻结：不下发 RAF，但保留订阅（Playwright 视觉回归用）
      this.rafId = 0;
      return;
    }
    const dt = this.clock.getDelta();
    for (const layer of this.layers.values()) {
      try {
        layer.update(dt);
      } catch (err) {
        console.warn(`[Stage] layer ${layer.name} update failed`, err);
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.loop);
  }

  /* ---------------- 销毁 ---------------- */

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('click', this.onPointerClick);

    for (const layer of this.layers.values()) {
      layer.dispose();
    }
    this.layers.clear();
    this.pickEntries = [];
    this.pickMeshes = [];
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  /** 测试 / 调试用：暴露 renderer / scene / camera */
  getRaw(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
    return { renderer: this.renderer, scene: this.scene, camera: this.camera };
  }
}

/* ---------- 默认工厂：单 Stage / 容器 ---------- */

let _stage: Stage | null = null;

/**
 * 在 Dashboard.vue 里：
 *   onMounted(() => {
 *     const stage = createStage(containerRef.value!);
 *     stage.setProjects(...); stage.setPipes(...); ...
 *     stage.on('layer:click', (id) => ...);
 *   });
 */
export function createStage(container: HTMLElement): Stage {
  if (_stage) {
    console.warn('[Stage] 已存在实例，先 dispose 旧实例');
    _stage.dispose();
  }
  _stage = new Stage({ container });
  // 调试钩子：浏览器控制台可用 window.__stage 检查场景内部状态
  (window as unknown as Record<string, unknown>).__stage = _stage;
  return _stage;
}

export function getStage(): Stage | null {
  return _stage;
}

export default createStage;