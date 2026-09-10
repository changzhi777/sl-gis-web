/**
 * FlyLineLayer — 监测点 → 水厂（A 级）飞线
 * - CatmullRomCurve3 + TubeGeometry + 尾迹渐变材质
 * - RAF 沿曲线偏移（offset.y 沿 u 方向）
 */
import * as THREE from 'three';
import type { Project, MonitorPoint } from '@/shared/types';
import { BaseLayer } from './BaseLayer';
import { SCENE_PALETTE } from './palette';
import { lon2xy } from './utils/lon2xy';

interface FlyLine {
  tube: THREE.Mesh;
  geometry: THREE.BufferGeometry; // TubeGeometry
  texture: THREE.CanvasTexture;
}

export class FlyLineLayer extends BaseLayer {
  readonly name = 'FlyLine';
  private group = new THREE.Group();
  private flyLines: FlyLine[] = [];
  private t = 0;

  override init(): void {
    this.group.name = 'FlyLineGroup';
  }

  override update(dt: number): void {
    this.t += dt;
    for (const f of this.flyLines) {
      f.texture.offset.x = -this.t * 0.3;
    }
  }

  override dispose(): void {
    for (const f of this.flyLines) {
      f.geometry.dispose();
      (f.tube.material as THREE.Material).dispose();
      f.texture.dispose();
      this.group.remove(f.tube);
    }
    this.flyLines = [];
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  /**
   * 生成飞线
   * @param monitors  源（监测点）
   * @param factory   目标（A 级水厂 Project）
   */
  setData(monitors: MonitorPoint[], factory: Project): void {
    for (const f of this.flyLines) {
      this.group.remove(f.tube);
      f.geometry.dispose();
      (f.tube.material as THREE.Material).dispose();
      f.texture.dispose();
    }
    this.flyLines = [];

    const dest = lon2xy(factory.coord[0], factory.coord[1]);

    for (const m of monitors) {
      const src = lon2xy(m.coord[0], m.coord[1]);
      const v3Arr = [
        new THREE.Vector3(src.x, src.y, 0),
        new THREE.Vector3((src.x + dest.x) / 2, (src.y + dest.y) / 2, 1200),
        new THREE.Vector3(dest.x, dest.y, 0),
      ];
      const curve = new THREE.CatmullRomCurve3(v3Arr);
      const geom = new THREE.TubeGeometry(curve, 64, 200, 8, false);
      const tex = makeFlyLineTexture();
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: new THREE.Color(SCENE_PALETTE.flyLineTrail),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const tube = new THREE.Mesh(geom, mat);
      this.group.add(tube);
      this.flyLines.push({ tube, geometry: geom, texture: tex });
    }
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}

/** 程序化尾迹纹理（白色高亮 → 透明） */
function makeFlyLineTexture(): THREE.CanvasTexture {
  const w = 64, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}