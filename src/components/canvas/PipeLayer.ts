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
  cps: number;   // cycles/sec（shader 相位速度）
  size: number; // 粒子尺寸系数
}
const FLOW_LEVELS: Array<{ minDn: number; level: FlowLevel }> = [
  { minDn: 200, level: { color: 0x00ffe0, speed: 12, z: 50, cps: 2.4, size: 1.4 } }, // L1 干管 快·绿·大
  { minDn: 100, level: { color: 0x00c2ff, speed: 6, z: 35, cps: 1.2, size: 1.0 } },  // L2 次管 中·青·中
  { minDn: 0,    level: { color: 0x8fa8ff, speed: 3, z: 20, cps: 0.6, size: 0.75 } }, // L3 支管 慢·蓝·小
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
  tubeGeom: THREE.TubeGeometry | null;
  dimLine: THREE.Line;                // z=0 接地投影线
}

const FLOW_DIVISIONS = 300; // 曲线总等距点数


const FLOW_VERT = /* glsl */ `
  attribute float aT;      // 0-1 沿管位置（含相位偏移）
  attribute float aCps;    // cycles/sec（三级速度）
  attribute float aSize;   // 粒子尺寸
  attribute vec3 aColor;   // 级别色
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float local = fract(aT - uTime * aCps);
    float d = abs(local - 0.5);
    float bright = exp(-d * d * 60.0);   // 亮带尖峰
    vColor = aColor;
    vAlpha = 0.18 + bright;              // 常亮底 + 流光峰
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (400000.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FLOW_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5, 0.5));
    float falloff = pow(1.0 - r / 0.5, 3.0);
    gl_FragColor = vec4(vColor, vAlpha * falloff);
  }
`;

export class PipeLayer extends BaseLayer {
  readonly name = 'Pipe';
  private group = new THREE.Group();
  private bundles: PipeBundle[] = [];
  private tubeMesh: THREE.Mesh | null = null;
  private flowPoints: THREE.Points | null = null;
  private flowMat: THREE.ShaderMaterial | null = null;

  override init(_renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    this.group.name = 'PipeGroup';
    scene.add(this.group);
  }

  override update(dt: number): void {
    // A 档优化：静态几何 + shader 相位流 — 每帧只更新一个 uniform
    if (this.flowMat) this.flowMat.uniforms.uTime.value += dt;
  }

  override dispose(): void {
    for (const b of this.bundles) {
      b.dimLine.geometry.dispose();
      (b.dimLine.material as THREE.Material).dispose();
    }
    if (this.flowPoints) {
      this.flowPoints.geometry.dispose();
      (this.flowPoints.material as THREE.Material).dispose();
      this.group.remove(this.flowPoints);
      this.flowPoints = null;
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
      b.dimLine.geometry.dispose();
      (b.dimLine.material as THREE.Material).dispose();
    }
    if (this.flowPoints) {
      this.flowPoints.geometry.dispose();
      (this.flowPoints.material as THREE.Material).dispose();
      this.group.remove(this.flowPoints);
      this.flowPoints = null;
    }
    this.bundles = [];
    if (this.tubeMesh) {
      this.tubeMesh.geometry.dispose();
      (this.tubeMesh.material as THREE.Material).dispose();
      this.group.remove(this.tubeMesh);
      this.tubeMesh = null;
    }

    // ── 管壳 + 静态流光点：一次构建，shader 相位流动 ──
    const tubeGeoms: THREE.BufferGeometry[] = [];
    const pos: number[] = [];
    const aT: number[] = [];
    const aCps: number[] = [];
    const aSize: number[] = [];
    const aColor: number[] = [];
    const cTmp = new THREE.Color();

    for (const pipe of pipes) {
      const built = this.buildOne(pipe);
      if (!built) continue;
      this.bundles.push(built.bundle);
      this.group.add(built.bundle.dimLine);
      if (built?.bundle.tubeGeom) tubeGeoms.push(built.bundle.tubeGeom);

      // 静态流光点：沿曲线 80 点，aT 编码位置+相位
      const level = flowLevelOf(pipe.diameter);
      const radius = tubeRadiusOf(pipe.diameter);
      const N = 80;
      const phase = Math.random();
      cTmp.set(level.color);
      for (let i = 0; i < N; i++) {
        const pt = built.curvePoints[Math.floor((i / N) * built.curvePoints.length)];
        pos.push(pt.x, pt.y, pt.z);
        aT.push((i / N + phase) % 1);
        aCps.push(level.cps);
        aSize.push(Math.min(Math.max(2.2 * radius, 36), 176) * level.size);
        aColor.push(cTmp.r, cTmp.g, cTmp.b);
      }
    }

    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
      g.setAttribute('aCps', new THREE.Float32BufferAttribute(aCps, 1));
      g.setAttribute('aSize', new THREE.Float32BufferAttribute(aSize, 1));
      g.setAttribute('aColor', new THREE.Float32BufferAttribute(aColor, 3));
      this.flowMat = new THREE.ShaderMaterial({
        vertexShader: FLOW_VERT,
        fragmentShader: FLOW_FRAG,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      this.flowPoints = new THREE.Points(g, this.flowMat);
      this.flowPoints.renderOrder = 3;
      this.flowPoints.frustumCulled = false;
      this.group.add(this.flowPoints);
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

  private buildOne(pipe: PipeSegment): { bundle: PipeBundle; curvePoints: THREE.Vector3[] } | null {
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

    return {
      bundle: { dimLine, tubeGeom },
      curvePoints: points,
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
