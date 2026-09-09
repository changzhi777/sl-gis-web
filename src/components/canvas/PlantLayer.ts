/**
 * PlantLayer — 3D 水厂构筑物（UI/UX 规范 §水厂）
 * - 前 5 个 A 级工程：完整工艺组（配水井→絮凝沉淀池→滤池阵列→清水池→泵房→水塔 + 连接短管）
 * - 其余 A 级：简化标志（地面呼吸环 + 十字光柱）
 * - 全部加 CSS2D 名称牌（▣ 前缀，区别工程点牌）
 * - 构筑物本体 Lambert #123A62（清水池/泵房 #16406E）+ EdgesGeometry 青描边
 * - 水面：Basic #00C2FF op .5 + water-base 贴图（静态）· renderOrder 1 · dw=false
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Project } from '@/shared/types';
import { BaseLayer } from './BaseLayer';
import { lon2xy } from './utils/lon2xy';

const BODY = 0x123a62;
const BODY_LIGHT = 0x16406e;
const WATER = 0x00c2ff;
const EDGE = 0x00c2ff;

interface PlantEntry {
  group: THREE.Group;
  label?: CSS2DObject;
  ring?: THREE.Mesh;
}

function mat(color: number, op = 1): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, transparent: op < 1, opacity: op });
}

function box(w: number, d: number, h: number, x: number, y: number, color = BODY): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat(color));
  m.position.set(x, y, h / 2);
  return m;
}

function cylinder(r: number, h: number, x: number, y: number, color = BODY): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat(color));
  m.position.set(x, y, h / 2);
  return m;
}

/** 青色描边（EdgesGeometry） */
function edges(mesh: THREE.Mesh, op = 0.45): void {
  const e = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity: op }),
  );
  e.position.copy(mesh.position);
  mesh.parent?.add(e);
}

/** 静态水面（贴图调制 + 半透明） */
function waterSurface(w: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/water-base.jpg`);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      color: WATER,
      map: tex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  m.position.set(x, y, z);
  m.renderOrder = 1;
  return m;
}

/** 连接短管（半透明青） */
function pipeLink(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): THREE.Mesh {
  const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 12, len, 8),
    new THREE.MeshBasicMaterial({ color: WATER, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
  m.lookAt(x2, y2, z2);
  m.rotateX(Math.PI / 2);
  m.renderOrder = 1;
  return m;
}

/** 完整水厂工艺组（~700×500 地块，原点居中，北进南出） */
function buildPlantGroup(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const rot = (rng() - 0.5) * 0.5; // ±15° 自然感
  g.rotation.z = rot;

  // 配水井（西北入口）
  const well = cylinder(30, 40, -250, 180);
  g.add(well);

  // 絮凝沉淀池（中轴）+ 青色水面
  const settler = box(160, 100, 25, -60, 120);
  g.add(settler);
  g.add(waterSurface(140, 80, -60, 120, 22));

  // 滤池阵列 3×4
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      g.add(box(30, 30, 25, -20 + c * 42, -40 - r * 42));
    }
  }

  // 清水池（东南大扁圆柱）+ 水面
  const clear = cylinder(90, 35, 200, -80, BODY_LIGHT);
  g.add(clear);
  g.add(waterSurface(140, 140, 200, -80, 30));

  // 泵房（东南角出水）
  g.add(box(80, 60, 45, 320, -160, BODY_LIGHT));

  // 水塔（西南独立）：立柱 + 锥顶
  const tower = cylinder(18, 120, -260, -160);
  g.add(tower);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(30, 35, 24),
    mat(BODY_LIGHT),
  );
  cone.position.set(-260, -160, 120 + 17);
  g.add(cone);

  // 连接短管（工艺链：井→絮凝→滤池→清水池→泵房）
  g.add(pipeLink(-250, 180, 20, -140, 120, 15));
  g.add(pipeLink(-60, 120, 15, 0, -40, 15));
  g.add(pipeLink(60, -60, 15, 200, -80, 18));
  g.add(pipeLink(200, -80, 15, 300, -140, 18));

  // 青描边（构筑物本体）
  g.traverse(o => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry.type === 'BoxGeometry' || mesh.geometry.type === 'CylinderGeometry') {
        edges(mesh);
      }
    }
  });

  return g;
}

/** 简化标志：地面呼吸环 + 十字光柱（静态） */
function buildSimpleMarker(): { group: THREE.Group; ring: THREE.Mesh } {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(320, 400, 48),
    new THREE.MeshBasicMaterial({
      color: WATER,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.position.z = 2;
  g.add(ring);

  // 十字光柱：两片正交 Plane，竖向渐变（ShaderMaterial 静态）
  const colMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * 0.18; gl_FragColor = vec4(0.0, 0.76, 1.0, a); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const W = 60, H = 600;
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(W, H), colMat);
  p1.position.z = H / 2;
  const p2 = p1.clone();
  p2.rotation.z = Math.PI / 2;
  g.add(p1, p2);

  return { group: g, ring };
}

export class PlantLayer extends BaseLayer {
  readonly name = 'Plant';
  private group = new THREE.Group();
  private entries: PlantEntry[] = [];
  private t = 0;

  override init(): void {
    this.group.name = 'PlantGroup';
  }

  override update(): void {
    // 简化环呼吸 2.4s（.2→.5），与告警 1.2s 错开
    this.t += 1 / 60;
    const k = 0.2 + (Math.sin((this.t / 2.4) * Math.PI * 2) * 0.5 + 0.5) * 0.3;
    for (const e of this.entries) {
      if (e.ring) (e.ring.material as THREE.MeshBasicMaterial).opacity = k;
    }
  }

  override dispose(): void {
    for (const e of this.entries) {
      if (e.label) e.label.element.remove();
    }
    this.entries = [];
    this.group.clear();
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  /** 喂入 A 级工程 — 前 5 个（normal 优先）完整水厂，其余简化标志 */
  setPlants(projects: Project[]): void {
    this.dispose();

    const aGrade = projects.filter(p => p.grade === 'A');
    const full = aGrade.filter(p => p.status === 'normal').slice(0, 5);
    const rest = aGrade.filter(p => !full.includes(p));

    let seed = 7;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    for (const p of full) {
      const xy = lon2xy(p.coord[0], p.coord[1]);
      const plant = buildPlantGroup(rng);
      plant.position.set(xy.x, xy.y, 0);
      this.group.add(plant);
      this.entries.push({ group: plant, ring: undefined });
      this.attachLabel(plant, p, true);
    }

    for (const p of rest) {
      const xy = lon2xy(p.coord[0], p.coord[1]);
      const { group, ring } = buildSimpleMarker();
      group.position.set(xy.x, xy.y, 0);
      this.group.add(group);
      this.entries.push({ group, ring, label: undefined });
      this.attachLabel(group, p, false);
    }
  }

  /** CSS2D 名称牌（▣ 前缀 = 水厂，区别工程点牌） */
  private attachLabel(anchor: THREE.Group, p: Project, isFull: boolean): void {
    const div = document.createElement('div');
    div.className = 'sl-gis-tag3d sl-gis-plant-tag';
    div.textContent = isFull ? `▣ ${p.name}` : `▣ ${p.name.match(/([ABC]-\d+)/)?.[1] || p.name.slice(0, 6)}`;
    const label = new CSS2DObject(div);
    label.position.set(0, 0, isFull ? 260 : 620);
    anchor.add(label);
    const entry = this.entries[this.entries.length - 1];
    if (entry) entry.label = label;
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}
