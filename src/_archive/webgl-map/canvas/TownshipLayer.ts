/**
 * TownshipLayer — 乡镇区划层（用户指令 · 简化版：名称牌+分色环）
 * - 基于高德实测的 8 个苏木乡镇真实坐标
 * - 每乡镇：分色地面环 + CSS2D 名称牌 + 状态点
 * - 数据接口：数据来自 SUMU_CENTERS（高德行政区 API 实取）
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { BaseLayer } from './BaseLayer';

import { SUMU_CENTERS } from '@shared/sumu-anchors';

const TOWNSHIP_COLORS = [
  0x00c2ff, 0x7ee081, 0x8fa8ff, 0xffb454,
  0x00ffe0, 0xff7a9e, 0xb08fff, 0x5ad4e6,
];

interface TownshipEntry {
  group: THREE.Group;
  label: CSS2DObject;
  ringMat: THREE.MeshBasicMaterial;
  baseRing: number;
  phase: number;
  name: string;
}

export class TownshipLayer extends BaseLayer {
  readonly name = 'Township';
  private group = new THREE.Group();
  private entries: TownshipEntry[] = [];
  private t = 0;

  override init(): void {
    this.group.name = 'TownshipGroup';
  }

  setData(_data?: unknown): void { /* 数据源为 SUMU_CENTERS 静态 */ }

  /** 构建 8 苏木乡镇标注（幂等） */
  build(): void {
    if (this.entries.length) return;

    SUMU_CENTERS.forEach((c, i) => {
      if (c.isIndustrial) return; // 工业园区不显示
      const color = TOWNSHIP_COLORS[i % TOWNSHIP_COLORS.length];
      const g = new THREE.Group();

      // 地面呼吸环
      const ringGeom = new THREE.RingGeometry(1400, 1600, 32);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.2, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.z = 8;
      g.add(ring);

      // 名称牌
      const div = document.createElement('div');
      div.className = 'sl-gis-township-label';
      div.style.borderColor = `#${color.toString(16).padStart(6, '0')}`;
      div.textContent = c.name;
      const label = new CSS2DObject(div);
      label.position.set(0, 0, 300);
      g.add(label);

      this.group.add(g);
      this.entries.push({
        group: g, label, ringMat,
        baseRing: 0.2, phase: i * 0.8, name: c.name,
      });
    });
  }

  override update(dt: number): void {
    this.t += dt;
    for (const e of this.entries) {
      // 环呼吸
      e.ringMat.opacity = e.baseRing + Math.sin(this.t * (Math.PI / 1.2) + e.phase) * 0.08;
    }
  }

  override dispose(): void {
    for (const e of this.entries) {
      if (e.label) e.label.element.remove();
      e.group.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material && (m.material as THREE.Material).dispose) (m.material as THREE.Material).dispose();
      });
    }
    this.entries = [];
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}
