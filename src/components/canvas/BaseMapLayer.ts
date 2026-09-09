/**
 * BaseMapLayer — 暗色底 + 旗县边界描边
 * 读 public/geo/banner.json（GeoJSON Polygon），计算 bbox，墨卡托化，LineSegments 描边
 * v7.1：1 期只实现 dark（setBaseMapType('dark'|'satellite'|'tech' 其它走 noop）
 */
import * as THREE from 'three';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { BaseLayer } from './BaseLayer';
import { SCENE_PALETTE } from './palette';
import { lon2xy } from './utils/lon2xy';

/** 内联最小 GeoJSON 类型（避免依赖 @types/geojson） */
namespace GeoJSON {
  export type Position = [number, number] | [number, number, number];
  export interface Polygon {
    type: 'Polygon';
    coordinates: Position[][];
  }
  export interface MultiPolygon {
    type: 'MultiPolygon';
    coordinates: Position[][][];
  }
  export type Geometry = Polygon | MultiPolygon;
  export interface Feature {
    type: 'Feature';
    geometry?: Geometry;
    properties?: Record<string, unknown>;
  }
  export interface FeatureCollection {
    type: 'FeatureCollection';
    features: Feature[];
  }
}

export type BaseMapType = 'dark' | 'satellite' | 'tech';

export interface BaseMapBBox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  centerLon: number;
  centerLat: number;
  centerX: number; // 墨卡托
  centerY: number;
}

export class BaseMapLayer extends BaseLayer {
  readonly name = 'BaseMap';
  private group = new THREE.Group();
  private lines: LineSegments2 | null = null;
  private bbox: BaseMapBBox | null = null;

  override init(): void {
    this.group.name = 'BaseMapGroup';
    this.fetchGeo();
  }

  override update(): void {
    /* 静态，无 update */
  }

  override dispose(): void {
    this.group.clear();
    if (this.lines) {
      this.lines.geometry.dispose();
      (this.lines.material as THREE.Material).dispose();
      this.lines = null;
    }
  }

  /** 暴露给 Stage 计算相机 target */
  getBBox(): BaseMapBBox | null {
    return this.bbox;
  }

  setBaseMapType(type: BaseMapType): void {
    if (type === 'dark') {
      this.lines && (this.lines.material as unknown as LineMaterial).color.set(SCENE_PALETTE.boundaryLine);
    }
    // satellite / tech 留 1 期 noop
  }

  /** Stage onResize 钩子：Line2 需要更新 resolution 才能正确渲染屏幕像素线宽 */
  onResize(width: number, height: number): void {
    if (this.lines) {
      const m = this.lines.material as unknown as LineMaterial;
      m.resolution.set(width, height);
    }
  }

  /** 异步取 GeoJSON */
  private fetchGeo(): void {
    if (typeof window === 'undefined') return;
    fetch(`${import.meta.env.BASE_URL}geo/banner.json`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((fc: GeoJSON.FeatureCollection) => this.buildFromGeoJSON(fc))
      .catch(err => {
        console.warn('[BaseMapLayer] banner.json fetch failed', err);
        // 即便失败也给一个空 bbox 让相机能起飞（不阻塞 Stage）
        this.bbox = {
          minLon: 112, maxLon: 116, minLat: 41, maxLat: 46,
          centerLon: 114, centerLat: 43.5, centerX: 0, centerY: 0,
        };
      });
  }

  private buildFromGeoJSON(fc: GeoJSON.FeatureCollection): void {
    const positions: number[] = [];

    let minLon = Infinity, maxLon = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    const pushRing = (ring: [number, number][]) => {
      // GeoJSON Polygon 外环是一串坐标，把相邻两点 push 成 line segment
      for (let i = 0; i < ring.length - 1; i++) {
        const [lon1, lat1] = ring[i];
        const [lon2, lat2] = ring[i + 1];
        const a = lon2xy(lon1, lat1);
        const b = lon2xy(lon2, lat2);
        positions.push(a.x, a.y, 0, b.x, b.y, 0);

        if (lon1 < minLon) minLon = lon1;
        if (lon1 > maxLon) maxLon = lon1;
        if (lat1 < minLat) minLat = lat1;
        if (lat1 > maxLat) maxLat = lat1;
      }
    };

    for (const f of fc.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === 'Polygon') {
        for (const ring of g.coordinates) pushRing(ring as [number, number][]);
      } else if (g.type === 'MultiPolygon') {
        for (const poly of g.coordinates) {
          for (const ring of poly) pushRing(ring as [number, number][]);
        }
      }
    }

    const geom = new LineSegmentsGeometry();
    geom.setPositions(positions);
    const mat = new LineMaterial({
      color: new THREE.Color(SCENE_PALETTE.boundaryLine).getHex(),
      linewidth: 2,  // LineMaterial 真正生效（用世界单位，需 resolution 配合）
      transparent: true,
      opacity: 0.9,
      worldUnits: false,  // 屏幕像素单位
    });
    // ★ 关键：必须设 resolution 才能让屏幕像素线宽生效
    mat.resolution.set(window.innerWidth, window.innerHeight);

    this.lines = new LineSegments2(geom, mat);
    this.lines.name = 'BoundaryLines';
    // ★ LineSegmentsGeometry 的包围球按 2 顶点基几何计算（不含实例化偏移），
    //   相机远距离时会被视锥剔除 — 必须关闭
    this.lines.frustumCulled = false;
    this.group.add(this.lines);

    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const cxy = lon2xy(centerLon, centerLat);

    this.bbox = {
      minLon, maxLon, minLat, maxLat,
      centerLon, centerLat,
      centerX: cxy.x,
      centerY: cxy.y,
    };
  }

  /** 提供给 Stage 添加进场景 */
  getObject3D(): THREE.Object3D {
    return this.group;
  }
}