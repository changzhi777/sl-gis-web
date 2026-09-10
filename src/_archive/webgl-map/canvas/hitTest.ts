/**
 * 屏幕 NDC → 射线 → 与一组 Mesh 求交。
 * 用于 Stage 全局点击 / hover 拾取（ProjectLayer / MonitorLayer 等都用）。
 */
import * as THREE from 'three';

export interface PickResult {
  mesh: THREE.Object3D;
  point: THREE.Vector3;
  distance: number;
}

export interface PickableEntry {
  /** 实际参与 raycast 的 mesh（InstancedMesh 之类取 mesh） */
  mesh: THREE.Object3D;
  /** 业务 id（Project.id / MonitorPoint.id） */
  id: string;
  /** 给 hitTest 用的扩展元数据 */
  meta?: Record<string, unknown>;
}

export interface PickOptions {
  camera: THREE.Camera;
  sceneMeshes: THREE.Object3D[];
  entries: PickableEntry[];
  /** NDC，[-1,1] */
  mouseNDC: { x: number; y: number };
  /** raycaster 阈值（针对 Points / Sprite 之类） */
  threshold?: number;
}

/**
 * 把 mouseNDC 经 raycaster 与 sceneMeshes 求交，
 * 命中后从 entries 反查 id / meta 返回；未命中返回 null。
 */
export function pickAt(opts: PickOptions): PickResult | null {
  const { camera, sceneMeshes, entries, mouseNDC, threshold = 1 } = opts;

  if (!sceneMeshes.length) return null;

  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(mouseNDC.x, mouseNDC.y), camera);
  ray.params.Points = { threshold };
  ray.params.Sprite = { threshold };

  const hits = ray.intersectObjects(sceneMeshes, false);
  const first = hits[0];
  if (!first) return null;

  // 反查 entries：找到含这个 mesh 的第一个 entry
  const entry = entries.find(e => e.mesh === first.object || e.mesh === first.object.parent);
  if (!entry) {
    // 没注册业务 id（背景层等），仍返回 mesh 供兜底
    return {
      mesh: first.object,
      point: first.point,
      distance: first.distance,
    };
  }

  return {
    mesh: first.object,
    point: first.point,
    distance: first.distance,
  };
}

/** 仅拿到业务 id 列表（忽略未注册 mesh） */
export function pickIds(opts: Omit<PickOptions, 'entries'> & { entries: PickableEntry[] }): string[] {
  const { camera, sceneMeshes, entries, mouseNDC, threshold = 1 } = opts;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(mouseNDC.x, mouseNDC.y), camera);
  ray.params.Points = { threshold };
  ray.params.Sprite = { threshold };
  const hits = ray.intersectObjects(sceneMeshes, false);
  const ids: string[] = [];
  for (const h of hits) {
    const e = entries.find(en => en.mesh === h.object || en.mesh === h.object.parent);
    if (e) ids.push(e.id);
  }
  return ids;
}