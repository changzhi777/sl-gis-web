/**
 * 所有 WebGL 图层的抽象基类。
 * 继承方只需实现 name / init / update / dispose；
 * visible 字段给 stores/layers 控显隐。
 */
import type { WebGLRenderer, Scene, Camera } from 'three';

export abstract class BaseLayer {
  abstract readonly name: string;
  visible = true;

  /** 首次挂载时调用 — 创建 Geometry / Material / Mesh */
  abstract init(renderer: WebGLRenderer, scene: Scene, camera: Camera): void;

  /** 每帧调用，dt 单位 s（来自 THREE.Clock.getDelta） */
  abstract update(dt: number): void;

  /** 卸载 — 释放 geometry / material / texture / remove from scene */
  abstract dispose(): void;

  /** 提供一个统一的显隐切换（默认只切 visible，业务层可重写） */
  setVisible(v: boolean): void {
    this.visible = v;
  }
}