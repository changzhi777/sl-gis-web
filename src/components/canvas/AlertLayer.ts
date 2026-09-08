/**
 * AlertLayer — 雷达脉冲 + 影响域围幕
 * - 雷达：双层 Sprite 双 RAF 错相 0.6s（RadarMesh 配方）
 * - 围幕：沿旗县边界扫描竖面 + 流动纹理（WallGroup1 配方）
 *   v7.1：1 期用程序化生成 noise 纹理，避免外部资源依赖
 */
import * as THREE from 'three';
import type { EmergencyEvent } from '@/shared/types';
import { SCENE_PALETTE } from './palette';
import { BaseLayer } from './BaseLayer';
import { lon2xy } from './utils/lon2xy';

interface RadarBundle {
  group: THREE.Group;
  ringInner: THREE.Mesh;
  ringOuter: THREE.Mesh;
  phase: number; // 0..1
}

export class AlertLayer extends BaseLayer {
  readonly name = 'Alert';
  private group = new THREE.Group();
  private radars: RadarBundle[] = [];
  private wallMesh: THREE.Mesh | null = null;
  private wallTexture: THREE.CanvasTexture | null = null;
  /** 外部传入的旗县边界 ring，第一点坐标 [lon,lat][] */
  private boundary: [number, number][] | null = null;

  override init(_renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    this.group.name = 'AlertGroup';
    scene.add(this.group);
  }

  override update(dt: number): void {
    void dt;
    for (const r of this.radars) {
      r.ringInner.rotation.z += 0.04;
      r.ringOuter.rotation.z += 0.025;
    }
    if (this.wallTexture) {
      // y 方向流动
      this.wallTexture.offset.y -= 0.5 * dt;
    }
  }

  override dispose(): void {
    for (const r of this.radars) {
      r.ringInner.geometry.dispose();
      (r.ringInner.material as THREE.Material).dispose();
      r.ringOuter.geometry.dispose();
      (r.ringOuter.material as THREE.Material).dispose();
      this.group.remove(r.group);
    }
    this.radars = [];
    if (this.wallMesh) {
      this.wallMesh.geometry.dispose();
      (this.wallMesh.material as THREE.Material).dispose();
      this.wallTexture?.dispose();
      this.wallMesh = null;
    }
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  /** 喂入告警事件，自动生成对应雷达 */
  setData(events: EmergencyEvent[]): void {
    for (const r of this.radars) {
      r.ringInner.geometry.dispose();
      (r.ringInner.material as THREE.Material).dispose();
      r.ringOuter.geometry.dispose();
      (r.ringOuter.material as THREE.Material).dispose();
      this.group.remove(r.group);
    }
    this.radars = [];

    events.forEach((ev, i) => {
      // location 是字符串，不一定含坐标；这里用 projectId 反查需要 store
      // 1 期退化：坐标从 description 解析或置 0,0；业务侧传 [lon,lat] 时用 ev.meta
      // 这里采用直接读 userData 通过 events 路径
      const coord: [number, number] = (ev as EmergencyEvent & { coord?: [number, number] }).coord ?? [112, 43];
      const xy = lon2xy(coord[0], coord[1]);
      const bundle = this.makeRadarBundle(xy.x, xy.y, i * 0.3);
      this.group.add(bundle.group);
      this.radars.push(bundle);
    });
  }

  /** 设置旗县边界环 — 影响域围幕沿它扫竖面 */
  setBoundary(ring: [number, number][]): void {
    this.boundary = ring;
    this.buildWall();
  }

  private buildWall(): void {
    if (!this.boundary || this.boundary.length < 3) return;
    if (this.wallMesh) {
      this.wallMesh.geometry.dispose();
      (this.wallMesh.material as THREE.Material).dispose();
      this.wallTexture?.dispose();
      this.wallMesh = null;
    }

    const c: number[] = [];
    for (const [lon, lat] of this.boundary) {
      const xy = lon2xy(lon, lat);
      c.push(xy.x, xy.y);
    }

    const posArr: number[] = [];
    const uvrr: number[] = [];
    const h = 5000; // 围幕高度（米）
    for (let i = 0; i < c.length - 2; i += 2) {
      const x1 = c[i], y1 = c[i + 1];
      const x2 = c[i + 2], y2 = c[i + 3];
      // 三角形 1
      posArr.push(x1, y1, 0, x2, y2, 0, x2, y2, h);
      // 三角形 2
      posArr.push(x1, y1, 0, x2, y2, h, x1, y1, h);
      uvrr.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvrr, 2));
    geom.computeVertexNormals();

    const tex = makeFlowTexture();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    this.wallTexture = tex;

    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(SCENE_PALETTE.wallFlow),
      map: tex,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
    });

    this.wallMesh = new THREE.Mesh(geom, mat);
    this.wallMesh.name = 'BoundaryWall';
    this.group.add(this.wallMesh);
  }

  private makeRadarBundle(x: number, y: number, phase: number): RadarBundle {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const tex = makeRadarTexture();

    const geom = new THREE.PlaneGeometry(8000, 8000);

    const inner = new THREE.MeshBasicMaterial({
      map: tex,
      color: 0x00ffff,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: 0.9,
    });
    const ringInner = new THREE.Mesh(geom, inner);

    const outer = new THREE.MeshBasicMaterial({
      map: tex.clone(),
      color: 0x00cccc,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: 0.5,
    });
    const ringOuter = new THREE.Mesh(geom, outer);
    ringOuter.scale.set(1.4, 1.4, 1);

    // 雷达盘通常面朝相机：smartcity 旋转 -PI/2 让其平铺 xy 平面，
    // 这里我们沿用 z 旋转扫描
    ringInner.userData['phase'] = phase;
    ringOuter.userData['phase'] = phase + 0.3;

    group.add(ringOuter);
    group.add(ringInner);
    return { group, ringInner, ringOuter, phase };
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}

/* ---------- 程序化纹理（避免外部资源依赖） ---------- */

function makeFlowTexture(): THREE.CanvasTexture {
  const w = 64, h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // 透明渐变带（中心高亮，边缘透明）
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, 'rgba(0, 194, 255, 0)');
  grad.addColorStop(0.45, 'rgba(0, 194, 255, 0.0)');
  grad.addColorStop(0.5, 'rgba(0, 255, 224, 0.85)');
  grad.addColorStop(0.55, 'rgba(0, 194, 255, 0.0)');
  grad.addColorStop(1.0, 'rgba(0, 194, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeRadarTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;

  // 同心圆环
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.55)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (i / 4) * (size / 2 - 4), 0, Math.PI * 2);
    ctx.stroke();
  }
  // 十字
  ctx.beginPath();
  ctx.moveTo(cx, 4); ctx.lineTo(cx, size - 4);
  ctx.moveTo(4, cy); ctx.lineTo(size - 4, cy);
  ctx.stroke();

  // 扫描扇形（旋转通过 mesh.rotateZ 实现）
  const sweep = ctx.createConicGradient?.(-Math.PI / 2, cx, cy);
  if (sweep) {
    sweep.addColorStop(0, 'rgba(0, 255, 255, 0.9)');
    sweep.addColorStop(0.15, 'rgba(0, 255, 255, 0.0)');
    sweep.addColorStop(1, 'rgba(0, 255, 255, 0.0)');
    ctx.fillStyle = sweep;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}