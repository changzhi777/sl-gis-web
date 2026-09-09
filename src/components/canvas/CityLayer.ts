/**
 * CityLayer — 3D 城市建筑群（v7.3 增量 · 程序化生成）
 * - 读 banner.json 计算 bbox
 * - 程序化生成 5×7 网格建筑（22% 留空率模拟牧区稀疏）
 * - mulberry32 固定 seed=42 抖动可复现
 * - 随机高度（宽度的 1.5-4.3 倍）
 * - InstancedMesh 共享 BoxGeometry + mergeBufferGeometries 合批
 * - 屋顶发光高亮 14% 重点建筑
 * - 提供 setDensity('low'|'mid'|'high') 接口
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BaseLayer } from './BaseLayer';
import { SCENE_PALETTE } from './palette';
import { lon2xy } from './utils/lon2xy';
import { SUMU_ANCHORS } from '@/shared/sumu-anchors';

export type CityDensity = 'low' | 'mid' | 'high';

const DENSITY_GRID: Record<CityDensity, [number, number]> = {
  low: [3, 4],
  mid: [5, 7],
  high: [8, 12],
};

interface CityBundle {
  group: THREE.Group;
  buildingsMesh: THREE.Mesh;
  highlightMesh: THREE.Mesh;
  bbox: { minX: number; maxX: number; minY: number; maxY: number } | null;
}

/** 固定种子 mulberry32 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class CityLayer extends BaseLayer {
  readonly name = 'City';
  private group = new THREE.Group();
  private bundle: CityBundle | null = null;
  private density: CityDensity = 'mid';

  override init(_renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    this.group.name = 'CityGroup';
    scene.add(this.group);
    this.build();
  }

  override update(): void {
    /* 静态 */
  }

  override dispose(): void {
    if (this.bundle) {
      this.bundle.buildingsMesh.geometry.dispose();
      (this.bundle.buildingsMesh.material as THREE.Material).dispose();
      this.bundle.highlightMesh.geometry.dispose();
      (this.bundle.highlightMesh.material as THREE.Material).dispose();
    }
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  setDensity(level: CityDensity): void {
    if (this.density === level) return;
    this.density = level;
    this.rebuild();
  }

  /** 给 Stage 调用：传入旗县 bbox 用于约束建筑范围 */
  setBBox(bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number } | null): void {
    if (!bbox) return;
    this.bbox = bbox;
    this.rebuild();
  }

  private bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number } | null = null;

  private build(): void {
    /* 占位：等 setBBox 后 rebuild */
  }

  private rebuild(): void {
    if (!this.bbox) return;
    // 清旧
    if (this.bundle) {
      this.bundle.buildingsMesh.geometry.dispose();
      (this.bundle.buildingsMesh.material as THREE.Material).dispose();
      this.bundle.highlightMesh.geometry.dispose();
      (this.bundle.highlightMesh.material as THREE.Material).dispose();
      this.group.remove(this.bundle.group);
    }

    const [gridX, gridY] = DENSITY_GRID[this.density];
    const bboxMin = lon2xy(this.bbox.minLon, this.bbox.minLat);
    const bboxMax = lon2xy(this.bbox.maxLon, this.bbox.maxLat);
    const minX = Math.min(bboxMin.x, bboxMax.x);
    const maxX = Math.max(bboxMin.x, bboxMax.x);
    const minY = Math.min(bboxMin.y, bboxMax.y);
    const maxY = Math.max(bboxMin.y, bboxMax.y);

    const cellW = (maxX - minX) / gridX;
    const cellH = (maxY - minY) / gridY;
    const baseSize = Math.min(cellW, cellH) * 0.55; // 建筑占地

    const rng = mulberry32(42);

    const boxGeoms: THREE.BufferGeometry[] = [];
    const highlightGeoms: THREE.BufferGeometry[] = [];

    // 苏木锚点聚簇：每锚点一簇建筑（高斯散布），旗驻地最大
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const clusterRadius = Math.min(spanX, spanY) * 0.045; // 簇半径

    for (const anchor of SUMU_ANCHORS) {
      const ax = minX + anchor.fx * spanX;
      const ay = minY + anchor.fy * spanY;
      const count = Math.round((this.density === 'low' ? 6 : this.density === 'mid' ? 10 : 14) * anchor.weight);

      // Box-Muller 高斯抖动
      const gauss = () => {
        const u = Math.max(rng(), 1e-9);
        const v = rng();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      };

      for (let i = 0; i < count; i++) {
        const cx = ax + gauss() * clusterRadius * 0.5;
        const cy = ay + gauss() * clusterRadius * 0.5;

        const w = baseSize * (0.7 + rng() * 0.6);
        const d = baseSize * (0.7 + rng() * 0.6);
        // 旗驻地有高层， others 低层
        const hMax = anchor.isSeat ? 5.0 : 3.0;
        const h = w * (1.2 + rng() * hMax);

        const geom = new THREE.BoxGeometry(w, d, h);
        geom.translate(cx, cy, h / 2);
        boxGeoms.push(geom);

        if (rng() < 0.14) {
          const topGeom = new THREE.BoxGeometry(w * 0.9, d * 0.9, 80);
          topGeom.translate(cx, cy, h + 40);
          highlightGeoms.push(topGeom);
        }
      }
    }

    const mergedBuildings = mergeGeometries(boxGeoms, false);
    // dispose 子 geom
    boxGeoms.forEach(g => g.dispose());

    const matBuildings = new THREE.MeshLambertMaterial({
      color: new THREE.Color(SCENE_PALETTE.buildingSide),
      transparent: true,
      opacity: 0.92,
    });

    const buildingsMesh = new THREE.Mesh(mergedBuildings, matBuildings);
    buildingsMesh.name = 'CityBuildings';

    const bundle: CityBundle = {
      group: new THREE.Group(),
      buildingsMesh,
      highlightMesh: new THREE.Mesh(),
      bbox: { minX, maxX, minY, maxY },
    };

    if (highlightGeoms.length) {
      const mergedHL = mergeGeometries(highlightGeoms, false);
      highlightGeoms.forEach(g => g.dispose());
      const matHL = new THREE.MeshBasicMaterial({
        color: new THREE.Color(SCENE_PALETTE.buildingTop),
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      });
      bundle.highlightMesh = new THREE.Mesh(mergedHL, matHL);
      bundle.highlightMesh.name = 'CityHighlights';
      bundle.group.add(bundle.highlightMesh);
    }

    bundle.group.add(bundle.buildingsMesh);
    bundle.group.name = 'CityBundle';
    this.group.add(bundle.group);
    this.bundle = bundle;
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}