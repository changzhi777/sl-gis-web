/**
 * ModelLayer — GLTFLoader + DRACO（v7.2 增量）
 * - DRACOLoader CDN: draco 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
 * - 1 期实现 init() 空架子 + addModel(url, projectId) 接口（GLB 可延迟）
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Project } from '@/shared/types';
import { BaseLayer } from './BaseLayer';

const DRACO_DECODER = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

interface ModelEntry {
  group: THREE.Group;
  projectId: string;
  url: string;
}

export class ModelLayer extends BaseLayer {
  readonly name = 'Model';
  private group = new THREE.Group();
  private loader: GLTFLoader | null = null;
  private draco: DRACOLoader | null = null;
  private entries: ModelEntry[] = [];

  override init(_renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    this.group.name = 'ModelGroup';
    scene.add(this.group);

    // 1 期先 lazy 创建 loader（避免外部资源一开始就抓）
  }

  override update(): void {
    /* GLB 自带动画；外部 update 留接口 */
  }

  override dispose(): void {
    for (const e of this.entries) {
      this.group.remove(e.group);
      e.group.traverse(obj => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose?.();
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat?.dispose?.();
      });
    }
    this.entries = [];
    this.draco?.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  private ensureLoader(): GLTFLoader {
    if (this.loader) return this.loader;
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER);
    loader.setDRACOLoader(draco);
    this.loader = loader;
    this.draco = draco;
    return loader;
  }

  /**
   * 添加一个 GLB 模型到指定工程坐标（lon/lat）。
   * 1 期：仅挂占位空 group；GLB 真正 load 由后续版本启用。
   */
  addModel(url: string, projectId: string, coord?: [number, number]): void {
    const group = new THREE.Group();
    group.name = `ModelGroup:${projectId}`;
    if (coord) {
      // 直接用真实经纬度换算会被 Stage 接管；这里只接受已墨卡托化的 x/y
      // 由调用方传入；如需 lon/lat 自加 lon2xy
      group.position.set(coord[0], coord[1], 0);
    }
    this.group.add(group);
    const entry: ModelEntry = { group, projectId, url };

    // 仅当 URL 看起来是真 GLB 才 load（占位示例直接 noop）
    if (url && /\.(glb|gltf)$/i.test(url)) {
      const loader = this.ensureLoader();
      loader.load(
        url,
        (gltf) => {
          group.add(gltf.scene);
        },
        undefined,
        (err) => {
          console.warn(`[ModelLayer] load failed: ${url}`, err);
        },
      );
    }

    this.entries.push(entry);
  }

  /** 批量从 Project[] 派生 addModel（A 级且 modelUrl 非空） */
  setProjects(projects: Project[]): void {
    for (const p of projects) {
      if (p.grade !== 'A' || !p.modelUrl) continue;
      this.addModel(p.modelUrl, p.id, p.coord);
    }
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}