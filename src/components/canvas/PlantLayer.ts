/**
 * PlantLayer — 3D 水厂（用户指令 · UI/UX 规范 §水厂构筑物）
 * - 前 5 个 A 级：完整工艺组（配水井→絮凝沉淀池→滤池阵列→清水池→泵房→水塔 + 连接短管）
 * - 其余 A 级：简化标志（地面呼吸环 + 十字光柱）
 * - 全部水厂挂 CSS2D 名称牌（▣ 前缀）
 * - renderOrder：本体 0 / 水面短管 1；水面 Basic #00C2FF op .5 + water-base 贴图
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { BaseLayer } from './BaseLayer';
import { lon2xy } from './utils/lon2xy';
import type { Project } from '@/shared/types';

/* ---------- 材质库（模块级共享，dispose 只清几何） ---------- */
const MAT = {
  body: new THREE.MeshLambertMaterial({ color: 0x123a62 }),       // 构筑物本体
  bodyLite: new THREE.MeshLambertMaterial({ color: 0x16406e }),   // 清水池/泵房
  edge: new THREE.LineBasicMaterial({ color: 0x00c2ff, transparent: true, opacity: 0.45 }),
  water: null as THREE.MeshBasicMaterial | null,                   // 惰性初始化（带贴图）
  pipe: new THREE.MeshBasicMaterial({ color: 0x00c2ff, transparent: true, opacity: 0.3 }),
  ring: new THREE.MeshBasicMaterial({ color: 0x00c2ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  beam: null as THREE.ShaderMaterial | null,                       // 惰性初始化
};

function waterMat(): THREE.MeshBasicMaterial {
  if (!MAT.water) {
    const tex = new THREE.TextureLoader().load('/sl-gis/textures/water-base.jpg');
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    MAT.water = new THREE.MeshBasicMaterial({
      color: 0x00c2ff,
      map: tex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
  }
  return MAT.water;
}

function beamMat(): THREE.ShaderMaterial {
  if (!MAT.beam) {
    MAT.beam = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; void main(){ float a=(1.0-vUv.y)*0.18; gl_FragColor=vec4(0.0,0.76,1.0,a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
  }
  return MAT.beam;
}

/* ---------- 构筑物小助手 ---------- */
function box(w: number, d: number, h: number, x: number, y: number, mat: THREE.Material, withEdges = false): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, d, h);
  g.translate(x, y, h / 2);
  const m = new THREE.Mesh(g, mat);
  if (withEdges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), MAT.edge));
  return m;
}

function cyl(r: number, h: number, x: number, y: number, mat: THREE.Material, coneTop = false): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, h, 20);
  g.translate(x, y, h / 2);
  const m = new THREE.Mesh(g, mat);
  if (coneTop) {
    const cone = new THREE.ConeGeometry(r + 12, 35, 20);
    cone.translate(x, y, h + 17.5);
    m.add(new THREE.Mesh(cone, mat));
  }
  return m;
}

function waterSurface(w: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  const m = new THREE.Mesh(g, waterMat());
  m.renderOrder = 1;
  return m;
}

function waterDisc(r: number, x: number, y: number, z: number): THREE.Mesh {
  const g = new THREE.CircleGeometry(r * 0.88, 24);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  const m = new THREE.Mesh(g, waterMat());
  m.renderOrder = 1;
  return m;
}

function linkPipe(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): THREE.Mesh {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.hypot(dx, dy, dz);
  const g = new THREE.CylinderGeometry(12, 12, len, 8);
  const m = new THREE.Mesh(g, MAT.pipe);
  m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
  m.lookAt(x2, y2, z2);
  m.rotateX(Math.PI / 2);
  m.renderOrder = 1;
  return m;
}

/** 完整工艺水厂组（原点居中，~700×500 地块，北进南出） */
function buildPlantGroup(): THREE.Group {
  const g = new THREE.Group();

  // 配水井（西北入口）
  g.add(cyl(30, 40, -250, 180, MAT.body, true));
  // 絮凝沉淀池（中轴）+ 水面
  g.add(box(160, 100, 25, -60, 120, MAT.body, true));
  g.add(waterSurface(150, 90, -60, 120, 22.5));
  // 滤池阵列 3×4
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      g.add(box(30, 30, 25, -30 + c * 40, -40 - r * 40, MAT.body));
    }
  }
  // 清水池（东南，圆柱 + 水面）
  g.add(cyl(90, 35, 200, -80, MAT.bodyLite));
  g.add(waterDisc(90, 200, -80, 31.5));
  // 泵房（东南角出水）
  g.add(box(80, 60, 45, 320, -160, MAT.bodyLite, true));
  // 水塔（西南，独立天际线）
  g.add(cyl(18, 120, -260, -160, MAT.body, true));
  // 工艺连接短管
  g.add(linkPipe(-250, 180, 40, -135, 120, 20));
  g.add(linkPipe(-60, 120, 22, -30, -40, 20));
  g.add(linkPipe(80, -80, 20, 110, -80, 20));
  g.add(linkPipe(290, -80, 35, 320, -160, 40));
  g.add(linkPipe(-260, -160, 120, 290, -80, 35)); // 清水池→水塔上水

  return g;
}

/** 简化标志：地面呼吸环 + 十字光柱 */
function buildSimpleMarker(): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(320, 400, 32),
    MAT.ring.clone(),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.z = 2;
  g.add(ring);

  // 十字双平面光柱（正交两片）
  for (const rot of [0, Math.PI / 2]) {
    const p = new THREE.PlaneGeometry(60, 600);
    p.translate(0, 300, 0);
    const m = new THREE.Mesh(p, beamMat());
    m.rotation.z = rot;
    g.add(m);
  }
  return g;
}

interface PlantEntry {
  group: THREE.Group;
  label?: CSS2DObject;
  ringMat?: THREE.MeshBasicMaterial;
  t: number;
}

export class PlantLayer extends BaseLayer {
  readonly name = 'Plant';
  private group = new THREE.Group();
  private entries: PlantEntry[] = [];
  private t = 0;

  override init(): void {
    this.group.name = 'PlantGroup';
  }

  /** 清旧 entries（重入水合前调用；group 本体保留挂载） */
  private clearEntries(): void {
    for (const e of this.entries) {
      e.group.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      if (e.label) e.label.element.remove();
      this.group.remove(e.group);
    }
    this.entries = [];
  }

  /** A 级工程 → 前 5 个完整水厂，其余简化标志（可重入：先清旧再建） */
  setPlants(projects: Project[]): void {
    this.clearEntries();
    const aList = projects.filter(p => p.grade === 'A');
    const FULL_COUNT = 5;

    aList.forEach((p, i) => {
      const xy = lon2xy(p.coord[0], p.coord[1]);
      const full = i < FULL_COUNT;
      const g = full ? buildPlantGroup() : buildSimpleMarker();
      g.position.set(xy.x, xy.y, 0);
      g.rotation.z = ((i * 37) % 30 - 15) * (Math.PI / 180); // ±15° 自然朝向

      // 名称牌（▣ 前缀区分工程点牌）
      const div = document.createElement('div');
      div.className = 'sl-gis-tag3d';
      const idm = p.name.match(/([ABC]-\d+)/);
      div.textContent = full ? `▣ ${p.name}` : `▣ ${idm ? idm[1] : p.name.slice(0, 8)}`;
      const label = new CSS2DObject(div);
      label.position.set(0, 0, full ? 260 : 620);
      g.add(label);

      const entry: PlantEntry = { group: g, label, t: i * 0.4 };
      if (!full) {
        // 简化环呼吸（2.4s 错相）
        const ring = g.children.find(c => (c as THREE.Mesh).geometry?.type === 'RingGeometry') as THREE.Mesh | undefined;
        if (ring) entry.ringMat = ring.material as THREE.MeshBasicMaterial;
      }
      this.group.add(g);
      this.entries.push(entry);
    });
  }

  override update(dt: number): void {
    this.t += dt;
    // 简化环呼吸 .2→.5 / 2.4s（错相）
    for (const e of this.entries) {
      if (e.ringMat) {
        e.ringMat.opacity = 0.35 + Math.sin(this.t * (2 * Math.PI / 2.4) + e.t) * 0.15;
      }
    }
  }

  override dispose(): void {
    for (const e of this.entries) {
      e.group.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        // 共享材质不 dispose（模块级）
      });
      if (e.label) e.label.element.remove();
    }
    this.entries = [];
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}
