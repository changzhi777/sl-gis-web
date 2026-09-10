/**
 * TownshipBoundaryLayer — 乡镇区划边界层
 * - 读 public/geo/townships.json（泰森多边形近似边界）
 * - 每乡镇一色半透明填充（Plane 三角扇）+ Line2 描边
 * - 后续换真实边界数据时只改 GeoJSON 文件
 */
import * as THREE from 'three';
import { BaseLayer } from './BaseLayer';
import { lon2xy } from './utils/lon2xy';

const COLORS = [
  0x00c2ff, 0x7ee081, 0x8fa8ff, 0xffb454,
  0x00ffe0, 0xff7a9e, 0xb08fff, 0x5ad4e6,
];

interface TownshipFeature {
  name: string;
  isSeat?: boolean;
}

export class TownshipBoundaryLayer extends BaseLayer {
  readonly name = 'TownshipBoundary';
  private group = new THREE.Group();
  private built = false;

  override init(): void {
    this.group.name = 'TownshipBoundaryGroup';
  }

  buildForBBox(_bbox?: { minLon: number; maxLon: number; minLat: number; maxLat: number }): void {
    if (this.built) return;
    this.built = true;

    fetch(`${import.meta.env.VITE_BASE_URL || '/'}geo/townships.json`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((fc: { features: Array<{ properties: TownshipFeature; geometry: { coordinates: [number[][]] } } > }) => {
        const edges: THREE.Line[] = [];

        fc.features.forEach((f, idx) => {
          const ring = f.geometry.coordinates[0];
          if (!ring || ring.length < 3) return;
          const color = COLORS[idx % COLORS.length];

          // 填充（ShapeGeometry 三角扇）
          const shape = new THREE.Shape(ring.map(([lon, lat]) => {
            const xy = lon2xy(lon, lat);
            return new THREE.Vector2(xy.x, xy.y);
          }));
          const fillGeom = new THREE.ShapeGeometry(shape);
          const fillMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.07,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const fillMesh = new THREE.Mesh(fillGeom, fillMat);
          fillMesh.renderOrder = -1;
          this.group.add(fillMesh);

          // 描边（Line2 不可用 → 用 Line 粗画兜底）
          const pts = ring.map(([lon, lat]) => {
            const xy = lon2xy(lon, lat);
            return new THREE.Vector3(xy.x, xy.y, 15);
          });
          const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
          const edge = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
            color, transparent: true, opacity: 0.6,
          }));
          this.group.add(edge);
          edges.push(edge);
        });

        console.log(`[TownshipBoundary] ${fc.features.length} 乡镇边界渲染完成`);
      })
      .catch(err => console.warn('[TownshipBoundary] 加载失败', err));
  }

  override update(_dt: number): void { /* 静态填充 */ }

  override dispose(): void {
    this.group.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as THREE.Material).dispose();
    });
    this.group.clear();
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}
