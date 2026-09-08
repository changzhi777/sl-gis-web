/**
 * MonitorLayer — 监测点光晕球（LightSphere 配方移植）
 * - SphereGeometry + ShaderMaterial（法线·z 边缘发光）
 * - 波动：scale 1.0→1.5 循环
 * - 类型分色：MONITOR_COLOR 映射
 * - hover → 显示 tooltip（emit 'layer:hover'）
 */
import * as THREE from 'three';
import type { MonitorPoint } from '@/shared/types';
import { MONITOR_COLOR } from '@/shared/types';
import { BaseLayer } from './BaseLayer';
import { lon2xy } from './utils/lon2xy';
import type { PickableEntry } from './hitTest';

interface MonitorEntry {
  mesh: THREE.Mesh;
  id: string;
  type: MonitorPoint['type'];
  phase: number; // 每个球起始相位错开，避免同步呼吸
}

/* ---- Shader：法线·z 边缘发光（light_fragment.glsl 配方移植） ---- */
const VERTEX = /* glsl */ `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
varying vec3 vNormal;
uniform vec3 uColor;
void main() {
  vec3 z = vec3(0.0, 0.0, 1.0);
  float x = abs(dot(vNormal, z));
  float alpha = pow(1.0 - x, 2.0);
  gl_FragColor = vec4(uColor, alpha);
}
`;

export class MonitorLayer extends BaseLayer {
  readonly name = 'Monitor';
  private group = new THREE.Group();
  private entries: MonitorEntry[] = [];
  private hoverHandler: ((id: string | null) => void) | null = null;
  private t = 0;

  override init(): void {
    this.group.name = 'MonitorGroup';
  }

  override update(dt: number): void {
    this.t += dt;
    for (const e of this.entries) {
      // 呼吸：1.0 → 1.5 → 1.0
      const k = 1.0 + (Math.sin(this.t * 2.0 + e.phase) * 0.5 + 0.5) * 0.5;
      e.mesh.scale.set(k, k, k);
    }
  }

  override dispose(): void {
    for (const e of this.entries) {
      e.mesh.geometry.dispose();
      (e.mesh.material as THREE.Material).dispose();
    }
    this.entries = [];
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  setData(points: MonitorPoint[]): void {
    // 清旧
    for (const e of this.entries) {
      this.group.remove(e.mesh);
      e.mesh.geometry.dispose();
      (e.mesh.material as THREE.Material).dispose();
    }
    this.entries = [];

    points.forEach((p, i) => {
      const xy = lon2xy(p.coord[0], p.coord[1]);
      const color = new THREE.Color(MONITOR_COLOR[p.type]);
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { uColor: { value: color } },
        transparent: true,
        depthWrite: false,
      });
      const geom = new THREE.SphereGeometry(500, 16, 16);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(xy.x, xy.y, 0);
      mesh.userData = { monitorId: p.id };
      mesh.name = `MonitorMesh:${p.id}`;
      this.group.add(mesh);
      this.entries.push({
        mesh,
        id: p.id,
        type: p.type,
        phase: (i % 10) * 0.5,
      });
    });
  }

  getPickables(): PickableEntry[] {
    return this.entries.map(e => ({
      mesh: e.mesh,
      id: e.id,
      meta: { type: e.type },
    }));
  }

  onHover(handler: (id: string | null) => void): void {
    this.hoverHandler = handler;
  }

  handleHover(id: string | null): void {
    this.hoverHandler?.(id);
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}