/**
 * useMapProjection — 等距投影 + GeoJSON 边界加载 composable
 * 自 emergency 事件地图抽取泛化（LAT0 余弦校正等距投影、bbox 自适应、
 * 旗界/乡镇界 path 化、乡镇多边形结构化：PIP 聚合 + 面积质心）。
 * 纯几何 util（pointInPolygon / polygonCentroid / ringToD / bboxOf）一并导出复用。
 */
import { computed, ref } from 'vue';

export interface Pt {
  x: number;
  y: number;
}
export type Ring = [number, number][];
export interface BBox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

/** GeoJSON 最小类型（DataV GeoAtlas 精简） */
export interface GeoFeature {
  geometry: { type: string; coordinates: unknown } | null;
}
export interface GeoFc {
  type: string;
  features: GeoFeature[];
}

/** 乡镇多边形（投影后）：PIP 用主环、名称放质心、填充用全环 path */
export interface TownPoly {
  name: string;
  /** 全部环的 path（MultiPolygon 多环拼接） */
  paths: string[];
  /** 主环（面积最大）投影顶点，供 point-in-polygon */
  ring: Pt[];
  /** 面积质心（退化回 bbox 中心），地图坐标 */
  centroid: Pt;
}

/** 展开 Polygon / MultiPolygon 为环数组 */
export function ringsOf(geom: { type: string; coordinates: unknown }): Ring[] {
  if (geom.type === 'Polygon') return geom.coordinates as Ring[];
  if (geom.type === 'MultiPolygon') return (geom.coordinates as Ring[][]).flat();
  return [];
}

/** 遍历要素集求经纬度 bbox */
export function bboxOf(fc: GeoFc): BBox {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const f of fc.features) {
    if (!f.geometry) continue;
    for (const ring of ringsOf(f.geometry)) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

/** 拉取 GeoJSON（静态资源，失败抛错由调用方兜底） */
export async function fetchGeo(url: string): Promise<GeoFc> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`geo ${r.status}`);
  return (await r.json()) as GeoFc;
}

/** 环 → SVG path d（按给定投影函数换算） */
export function ringToD(ring: Ring, proj: (lon: number, lat: number) => Pt): string {
  if (!ring.length) return '';
  const seg = ring.map(([lon, lat]) => {
    const p = proj(lon, lat);
    return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  });
  return `M${seg.join('L')}Z`;
}

/** 射线法：点是否在多边形内（投影坐标系，顶点数 ≥3 才有效） */
export function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const hit = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/** 鞋带公式有向面积 */
function shoelace(poly: Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  }
  return a / 2;
}

/** 多边形面积质心；退化（近共线/共点）回退 bbox 中心 */
export function polygonCentroid(poly: Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    a += f;
    cx += (poly[j].x + poly[i].x) * f;
    cy += (poly[j].y + poly[i].y) * f;
  }
  if (Math.abs(a) < 1e-6) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** 取面积最大的主环（旗界外沿 / 乡镇 PIP 环） */
function largestRing(rings: Ring[]): Ring | null {
  let best: Ring | null = null;
  let bestArea = 0;
  for (const r of rings) {
    if (r.length < 3) continue;
    const pts = r.map(([lon, lat]) => ({ x: lon, y: lat }));
    const area = Math.abs(shoelace(pts));
    if (area > bestArea) {
      bestArea = area;
      best = r;
    }
  }
  return best;
}

export interface UseMapProjectionOptions {
  /** 地图坐标系宽度（viewBox 宽），默认 1000 */
  width?: number;
  /** 余弦校正基准纬度，默认 42.8（锡盟中部） */
  lat0?: number;
}

/**
 * 投影 composable：返回投影函数 + 边界 path 数据 + 加载状态。
 * bbox 初始为兜底值，banner.json 加载后按实测重算（点位随之自动重投影）。
 */
export function useMapProjection(options: UseMapProjectionOptions = {}) {
  const MAP_W = options.width ?? 1000;
  const LAT0 = options.lat0 ?? 42.8;
  const COS0 = Math.cos((LAT0 * Math.PI) / 180);

  const bbox = ref<BBox>({ minLon: 111.15, maxLon: 114.55, minLat: 42.05, maxLat: 43.6 });
  const kDeg = computed(
    () => MAP_W / Math.max(1e-6, (bbox.value.maxLon - bbox.value.minLon) * COS0),
  );
  const mapH = computed(() => Math.round((bbox.value.maxLat - bbox.value.minLat) * kDeg.value));

  /** 经纬度 → 地图坐标（等距投影 + LAT0 余弦校正） */
  function proj(lon: number, lat: number): Pt {
    const k = kDeg.value;
    return { x: (lon - bbox.value.minLon) * k * COS0, y: (bbox.value.maxLat - lat) * k };
  }

  const bannerPaths = ref<string[]>([]);
  /** 旗界外沿（面积最大环），双线中的主线 + 扫光共用 */
  const bannerMainPath = ref('');
  const towns = ref<TownPoly[]>([]);
  const geoLoading = ref(false);
  const geoReady = ref(false);

  function featurePaths(fc: GeoFc): string[] {
    return fc.features.flatMap((f) =>
      f.geometry
        ? ringsOf(f.geometry)
            .map((r) => ringToD(r, proj))
            .filter(Boolean)
        : [],
    );
  }

  /** 并行拉取旗界 + 乡镇界；单边失败不阻塞另一边 */
  async function load(): Promise<void> {
    geoLoading.value = true;
    const base = import.meta.env.BASE_URL;
    const [b, t] = await Promise.allSettled([
      fetchGeo(`${base}geo/banner.json`),
      fetchGeo(`${base}geo/townships.json`),
    ]);
    if (b.status === 'fulfilled') {
      bbox.value = bboxOf(b.value);
      bannerPaths.value = featurePaths(b.value);
      const main = largestRing(
        b.value.features.flatMap((f) => (f.geometry ? ringsOf(f.geometry) : [])),
      );
      bannerMainPath.value = main ? ringToD(main, proj) : '';
    }
    if (t.status === 'fulfilled') {
      towns.value = t.value.features.flatMap((f): TownPoly[] => {
        if (!f.geometry) return [];
        const name = String((f as { properties?: { name?: unknown } }).properties?.name ?? '');
        const rings = ringsOf(f.geometry);
        const paths = rings.map((r) => ringToD(r, proj)).filter(Boolean);
        if (!paths.length) return [];
        const main = largestRing(rings);
        const projected = main ? main.map(([lon, lat]) => proj(lon, lat)) : [];
        return [
          {
            name,
            paths,
            ring: projected,
            centroid: projected.length ? polygonCentroid(projected) : { x: 0, y: 0 },
          },
        ];
      });
    }
    geoLoading.value = false;
    geoReady.value = true;
  }

  return {
    MAP_W,
    LAT0,
    bbox,
    kDeg,
    mapH,
    proj,
    bannerPaths,
    bannerMainPath,
    towns,
    geoLoading,
    geoReady,
    load,
  };
}
