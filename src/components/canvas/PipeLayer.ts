/**
 * PipeLayer — α 立体管道 + 三级水流（SubwayMesh 配方升级版）
 * - 管壳：每段 CatmullRomCurve3 → TubeGeometry（半透明 Lambert 0x0E4D66 op .35），mergeGeometries 合批单 Mesh
 * - 管径：r = 18 + 62×sqrt((DN-50)/250)；高程立交：干管(DN≥200) z50 / 次管(100-200) z35 / 支管(<100) z20
 * - 三级水流（用户指令）：L1 清泉绿 #00FFE0 快(12) / L2 汛期青 #00C2FF 中(6) / L3 雾蓝 #8FA8FF 慢(3)
 * - 流向：统一 start→end（水厂→用户，枝状供水）
 * - 平面暗线保留 z=0 作"接地投影"
 * - renderOrder：管壳 2 / 粒子 3；管壳 dw=false 让粒子透壳可见
 * - ⚠️ three 0.169 shader 替换目标必须用 `opaque_fragment`
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PipeSegment } from '@/shared/types';
import { BaseLayer } from './BaseLayer';
import { SCENE_PALETTE } from './palette';
import { lon2xy } from './utils/lon2xy';

/** 三级水流：颜色 + 速度 + 高程（按管径 DN 判级） */
interface FlowLevel {
  color: number;
  speed: number;
  z: number;
}
const FLOW_LEVELS: Array<{ minDn: number; level: FlowLevel }> = [
  { minDn: 200, level: { color: 0x00ffe0, speed: 12, z: 50 } }, // L1 干管
  { minDn: 100, level: { color: 0x00c2ff, speed: 6, z: 35 } },  // L2 次管
  { minDn: 0,    level: { color: 0x8fa8ff, speed: 3, z: 20 } }, // L3 支管
];

function flowLevelOf(dn: number): FlowLevel {
  for (const { minDn, level } of FLOW_LEVELS) {
    if (dn >= minDn) return level;
  }
  return FLOW_LEVELS[FLOW_LEVELS.length - 1].level;
}

/** 管半径：sqrt 映射（DN50→18 / DN150→45 / DN300→80） */
function tubeRadiusOf(dn: number): number {
  const d = Math.min(Math.max(dn, 50), 300);
  return 18 + 62 * Math.sqrt((d - 50) / 250);
}

interface PipeBundle {
  flyPoints: THREE.Points;
  tubeGeom: THREE.TubeGeometry | null;
  geometry: THREE.BufferGeometry;     // fly geometry（动态重建）
  points: THREE.Vector3[];            // CatmullRom 300 点
  index: number;                      // RAF 沿曲线滑动的索引
  num: number;                        // 切片长度
  indexMax: number;
  speed: number;                      // 三级速度（每帧步进）
  dimLine: THREE.Line;                // z=0 接地投影线
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
  private tubeMesh: THREE.Mesh | null = null;

  override init(_renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    this.group.name = 'PipeGroup';
    scene.add(this.group);
  }

  override update(): void {
    for (const b of this.bundles) {
      if (b.index > b.indexMax) b.index = 0;
      b.index += b.speed; // 三级速度
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
    if (this.tubeMesh) {
      this.tubeMesh.geometry.dispose();
      (this.tubeMesh.material as THREE.Material).dispose();
      this.group.remove(this.tubeMesh);
      this.tubeMesh = null;
    }
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
    if (this.tubeMesh) {
      this.tubeMesh.geometry.dispose();
      (this.tubeMesh.material as THREE.Material).dispose();
      this.group.remove(this.tubeMesh);
      this.tubeMesh = null;
    }

    // ── 管壳：全部 TubeGeometry 合批成一个 Mesh ──
    const tubeGeoms: THREE.BufferGeometry[] = [];
    for (const pipe of pipes) {
      const bundle = this.buildOne(pipe);
      if (!bundle) continue;
      this.bundles.push(bundle);
      this.group.add(bundle.dimLine);
      this.group.add(bundle.flyPoints);
      if (bundle.tubeGeom) tubeGeoms.push(bundle.tubeGeom);
    }

    if (tubeGeoms.length) {
      const merged = mergeGeometries(tubeGeoms, false);
      tubeGeoms.forEach(g => g.dispose());
      if (merged) {
        const mat = new THREE.MeshLambertMaterial({
          color: 0x0e4d66,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,   // 管内粒子透壳可见
          depthTest: true,
          side: THREE.FrontSide, // 禁 DoubleSide — 内壁叠加必脏
        });
        this.tubeMesh = new THREE.Mesh(merged, mat);
        this.tubeMesh.renderOrder = 2;
        this.tubeMesh.name = 'PipeTubes';
        this.group.add(this.tubeMesh);
      }
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
    const level = flowLevelOf(pipe.diameter);
    const radius = tubeRadiusOf(pipe.diameter);

    const a = lon2xy(pipe.start[0], pipe.start[1]);
    const b = lon2xy(pipe.end[0], pipe.end[1]);

    // 接地投影线（z=0 暗线，原样保留）
    const dimGeom = new THREE.BufferGeometry();
    dimGeom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([a.x, a.y, 0, b.x, b.y, 0], 3),
    );
    const dimLine = new THREE.Line(
      dimGeom,
      new THREE.LineBasicMaterial({
        color: new THREE.Color(SCENE_PALETTE.pipeDim),
        transparent: true,
        opacity: 0.5,
      }),
    );

    // 管道中心线（高程按级别）：端点 + 中间微抬（管线自重垂感）
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const v3Arr = [
      new THREE.Vector3(a.x, a.y, level.z),
      new THREE.Vector3(midX, midY, level.z + 8),
      new THREE.Vector3(b.x, b.y, level.z),
    ];
    const curve = new THREE.CatmullRomCurve3(v3Arr);
    const points = curve.getSpacedPoints(FLOW_DIVISIONS);

    // ── 立体管壳 ──
    const tubeGeom = new THREE.TubeGeometry(curve, 24, radius, 6, false);

    // ── 管内流光粒子 ──
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

    // 粒子颜色 = 级别色（亮色），vertexColors 沿用暗→亮渐变底
    const flyMat = new THREE.PointsMaterial({
      size: Math.min(Math.max(2.2 * radius, 36), 176),
      color: level.color,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
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
    flyPoints.renderOrder = 3;

    return {
      dimLine,
      flyPoints,
      geometry: flyGeom,
      points,
      index: 0,
      num: FLOW_NUM,
      indexMax: points.length - FLOW_NUM,
      speed: level.speed,
      tubeGeom,
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
