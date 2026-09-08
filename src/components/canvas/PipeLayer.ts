/**
 * PipeLayer — 流光管线（SubwayMesh 配方移植）
 * - 每段 PipeSegment：BufferGeometry + LineBasicMaterial（暗线 pipeDim）
 * - 流光层：CatmullRomCurve3 取 300 等距点 → 切片 30 个点 → 双层 lerp 顶点色（暗→亮→暗）
 * - percent attribute 控 PointsMaterial.size
 * - ⚠️ three 0.169 shader 替换目标必须用 `opaque_fragment` 而非 `output_fragment`
 */
import * as THREE from 'three';
import type { PipeSegment } from '@/shared/types';
import { BaseLayer } from './BaseLayer';
import { SCENE_PALETTE } from './palette';
import { lon2xy } from './utils/lon2xy';

interface PipeBundle {
  dimLine: THREE.Line;
  flyPoints: THREE.Points;
  geometry: THREE.BufferGeometry;     // fly geometry（动态重建）
  points: THREE.Vector3[];            // CatmullRom 300 点
  index: number;                      // RAF 沿曲线滑动的索引
  num: number;                        // 切片长度
  indexMax: number;
}

const FLOW_NUM = 30;        // 切片长度
const FLOW_DIVISIONS = 300; // 曲线总等距点数

/** 流光片元着色器（line_fragment.glsl 配方移植） */
const FLOW_FRAGMENT = /* glsl */ `
#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif

#ifdef USE_TRANSMISSION
diffuseColor.a *= transmissionAlpha + 0.1;
#endif

// 流光中心亮边缘淡
float r = distance(gl_PointCoord, vec2(0.5, 0.5));
diffuseColor.a = diffuseColor.a * pow(1.0 - r / 0.5, 6.0);
gl_FragColor = vec4(outgoingLight, diffuseColor.a);
`;

export class PipeLayer extends BaseLayer {
  readonly name = 'Pipe';
  private group = new THREE.Group();
  private bundles: PipeBundle[] = [];

  override init(_renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    this.group.name = 'PipeGroup';
    scene.add(this.group);
  }

  override update(dt: number): void {
    // 用 RAF 驱动 index += 8（与 smartcity 同步节奏）
    // dt 暂未直接用到，但保留签名供后续基于时间的动画切换
    void dt;
    for (const b of this.bundles) {
      if (b.index > b.indexMax) b.index = 0;
      b.index += 8;
      this.rebuildFlyPoints(b);
    }
  }

  override dispose(): void {
    for (const b of this.bundles) {
      b.dimLine.geometry.dispose();
      (b.dimLine.material as THREE.Material).dispose();
      b.geometry.dispose();
      (b.flyPoints.material as THREE.Material).dispose();
    }
    this.bundles = [];
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  /** 批量喂入管网数据 — 每次 setData 清空旧 bundle */
  setData(pipes: PipeSegment[]): void {
    // 清掉旧的
    for (const b of this.bundles) {
      this.group.remove(b.dimLine);
      this.group.remove(b.flyPoints);
      b.dimLine.geometry.dispose();
      (b.dimLine.material as THREE.Material).dispose();
      b.geometry.dispose();
      (b.flyPoints.material as THREE.Material).dispose();
    }
    this.bundles = [];

    for (const pipe of pipes) {
      const bundle = this.buildOne(pipe);
      if (!bundle) continue;
      this.bundles.push(bundle);
      this.group.add(bundle.dimLine);
      this.group.add(bundle.flyPoints);
    }
  }

  /** 重建流光 BufferGeometry（沿曲线滑动 index 区间） */
  private rebuildFlyPoints(b: PipeBundle): void {
    const slice = b.points.slice(b.index, b.index + b.num);
    if (slice.length < 2) return;
    const curve2 = new THREE.CatmullRomCurve3(slice);
    const dense = curve2.getSpacedPoints(100);
    b.geometry.setFromPoints(dense);

    // 顶点色（暗→亮→暗）
    const half = Math.floor(dense.length / 2);
    const colorArr = new Float32Array(dense.length * 3);
    const colorDim = new THREE.Color(SCENE_PALETTE.pipeDim);
    const colorFlow = new THREE.Color(SCENE_PALETTE.pipeFlow);
    for (let i = 0; i < dense.length; i++) {
      const t = i < half ? i / half : 1 - (i - half) / half;
      const c = colorDim.clone().lerp(colorFlow, t);
      colorArr[i * 3 + 0] = c.r;
      colorArr[i * 3 + 1] = c.g;
      colorArr[i * 3 + 2] = c.b;
    }
    b.geometry.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    b.geometry.attributes.color.needsUpdate = true;
  }

  private buildOne(pipe: PipeSegment): PipeBundle | null {
    const a = lon2xy(pipe.start[0], pipe.start[1]);
    const b = lon2xy(pipe.end[0], pipe.end[1]);
    // 暗线（底）— 直接两点直线
    const dimGeom = new THREE.BufferGeometry();
    dimGeom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([a.x, a.y, 0, b.x, b.y, 0], 3),
    );
    const dimMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(SCENE_PALETTE.pipeDim),
      transparent: true,
      opacity: 0.85,
    });
    const dimLine = new THREE.Line(dimGeom, dimMat);

    // 流光 — 用 2 段控制点做 CatmullRom（端点 + 中间 1 个抬高）
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const v3Arr = [
      new THREE.Vector3(a.x, a.y, 0),
      new THREE.Vector3(midX, midY, 0),
      new THREE.Vector3(b.x, b.y, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(v3Arr);
    const points = curve.getSpacedPoints(FLOW_DIVISIONS);

    const slice = points.slice(0, FLOW_NUM);
    const curve2 = new THREE.CatmullRomCurve3(slice);
    const dense = curve2.getSpacedPoints(100);

    const flyGeom = new THREE.BufferGeometry();
    flyGeom.setFromPoints(dense);

    // percent 控 gl_PointSize
    const percentArr = new Float32Array(dense.length);
    const half = Math.floor(dense.length / 2);
    for (let i = 0; i < dense.length; i++) {
      const t = i < half ? i / half : 1 - (i - half) / half;
      percentArr[i] = Math.pow(t, 0.2);
    }
    flyGeom.setAttribute('percent', new THREE.BufferAttribute(percentArr, 1));

    const flyMat = new THREE.PointsMaterial({
      size: 80.0,
      vertexColors: true,
      transparent: true,
      depthTest: true,
    });
    flyMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        ['attribute float percent;', 'void main() {'].join('\n'),
      );
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize = size;',
        'gl_PointSize = percent * percent * size;',
      );
      // ⚠️ three 0.169 — 必须替换 opaque_fragment
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        FLOW_FRAGMENT,
      );
    };

    const flyPoints = new THREE.Points(flyGeom, flyMat);

    return {
      dimLine,
      flyPoints,
      geometry: flyGeom,
      points,
      index: 0,
      num: FLOW_NUM,
      indexMax: points.length - FLOW_NUM,
    };
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }

  /** Raycaster 用 — 流光 Points 自身不参与业务点击，仅 mesh 列表给 hitTest */
  getPickables(): THREE.Object3D[] {
    return []; // 管网不参与拾取
  }
}