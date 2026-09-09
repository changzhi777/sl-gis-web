/**
 * GroundLayer — 45° 场景深度三件套（UI/UX 规范 §地面/§围幕）
 * - 径向渐变地面 Plane：#0E2A4A → #0C2340(40%) → #030812（视觉重心压旗县中央）
 * - 刻度网格 LineSegments 合批：间距 20000 · rgba(0,194,255,.07) · bbox×1.3 · 吃雾
 * - 边界围幕：竖直渐变墙 #00C2FF .28→0 + 流动条纹 · renderOrder 3 · fog=false
 */
import * as THREE from 'three';
import { BaseLayer } from './BaseLayer';
import { lon2xy } from './utils/lon2xy';

const GROUND_VERT = `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GROUND_FRAG = `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    // 径向三段：#0E2A4A → #0C2340(40%) → #030812
    float d = distance(vUv, vec2(0.5, 0.42));
    vec3 c1 = vec3(0.055, 0.165, 0.29);
    vec3 c2 = vec3(0.047, 0.137, 0.251);
    vec3 c3 = vec3(0.012, 0.031, 0.071);
    vec3 col = mix(c1, c2, smoothstep(0.0, 0.4, d));
    col = mix(col, c3, smoothstep(0.4, 1.0, d));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const WALL_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WALL_FRAG = `
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    // 竖向渐变：底部 .28 → 顶部 0
    float grad = (1.0 - vUv.y) * 0.28;
    // 沿周长流动条纹
    float stripe = 0.5 + 0.5 * sin(vUv.x * 80.0 + uTime * 3.0);
    float a = grad * (0.55 + 0.45 * stripe);
    gl_FragColor = vec4(0.0, 0.76, 1.0, a);
  }
`;

export class GroundLayer extends BaseLayer {
  readonly name = 'Ground';
  private group = new THREE.Group();
  private wallMat: THREE.ShaderMaterial | null = null;
  private groundMesh: THREE.Mesh | null = null;
  private gridMesh: THREE.LineSegments | null = null;
  private t = 0;

  override init(): void {
    this.group.name = 'GroundGroup';
    this.group.renderOrder = 0;
  }

  /** banner bbox 就绪后构建地面/网格/围幕（幂等） */
  buildForBBox(bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number }): void {
    // 清旧
    if (this.groundMesh) { this.group.remove(this.groundMesh); this.groundMesh.geometry.dispose(); (this.groundMesh.material as THREE.Material).dispose(); }
    if (this.gridMesh) { this.group.remove(this.gridMesh); this.gridMesh.geometry.dispose(); (this.gridMesh.material as THREE.Material).dispose(); }

    const p0 = lon2xy(bbox.minLon, bbox.minLat);
    const p1 = lon2xy(bbox.maxLon, bbox.maxLat);
    const minX = Math.min(p0.x, p1.x), maxX = Math.max(p0.x, p1.x);
    const minY = Math.min(p0.y, p1.y), maxY = Math.max(p0.y, p1.y);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const spanX = maxX - minX, spanY = maxY - minY;
    const extend = 1.3; // bbox 外扩 30%
    const gW = spanX * extend, gH = spanY * extend;

    // ── 1. 径向渐变地面 ──
    const gGeom = new THREE.PlaneGeometry(gW * 2.2, gH * 2.2);
    const gMat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      depthWrite: false,
    });
    this.groundMesh = new THREE.Mesh(gGeom, gMat);
    this.groundMesh.position.set(cx, cy, -50);
    this.groundMesh.renderOrder = -1;
    this.group.add(this.groundMesh);

    // ── 2. 刻度网格（间距 20000，吃雾） ──
    const gridPts: number[] = [];
    const gMinX = cx - gW / 2, gMaxX = cx + gW / 2;
    const gMinY = cy - gH / 2, gMaxY = cy + gH / 2;
    for (let x = gMinX; x <= gMaxX; x += 20000) gridPts.push(x, gMinY, 0, x, gMaxY, 0);
    for (let y = gMinY; y <= gMaxY; y += 20000) gridPts.push(gMinX, y, 0, gMaxX, y, 0);
    const gridGeom = new THREE.BufferGeometry();
    gridGeom.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
    this.gridMesh = new THREE.LineSegments(
      gridGeom,
      new THREE.LineBasicMaterial({ color: new THREE.Color(0, 0.76, 1.0), transparent: true, opacity: 0.07 })
    );
    this.gridMesh.position.z = -20;
    this.group.add(this.gridMesh);

    // ── 3. 边界围幕（沿 bbox 边界竖墙，高 = 短边×0.015） ──
    const wallH = Math.min(spanX, spanY) * 0.15;
    const corners = [
      [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY],
    ];
    const wallPts: number[] = [];
    const wallUvs: number[] = [];
    let uAcc = 0;
    for (let i = 0; i < corners.length - 1; i++) {
      const [x1, y1] = corners[i];
      const [x2, y2] = corners[i + 1];
      const segLen = Math.hypot(x2 - x1, y2 - y1);
      // 两三角一矩形段
      wallPts.push(x1, y1, 0, x2, y2, 0, x2, y2, wallH);
      wallPts.push(x1, y1, 0, x2, y2, wallH, x1, y1, wallH);
      wallUvs.push(uAcc, 0, uAcc + segLen / 20000, 0, uAcc + segLen / 20000, 1);
      wallUvs.push(uAcc, 0, uAcc + segLen / 20000, 1, uAcc, 1);
      uAcc += segLen / 20000;
    }
    const wGeom = new THREE.BufferGeometry();
    wGeom.setAttribute('position', new THREE.Float32BufferAttribute(wallPts, 3));
    wGeom.setAttribute('uv', new THREE.Float32BufferAttribute(wallUvs, 2));
    this.wallMat = new THREE.ShaderMaterial({
      vertexShader: WALL_VERT,
      fragmentShader: WALL_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const wall = new THREE.Mesh(wGeom, this.wallMat);
    wall.renderOrder = 3;
    wall.name = 'BoundaryWall';
    wall.frustumCulled = false;
    this.group.add(wall);
  }

  override update(dt: number): void {
    this.t += dt;
    if (this.wallMat) this.wallMat.uniforms.uTime.value = this.t;
  }

  override dispose(): void {
    this.group.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as THREE.Material).dispose();
    });
    this.group.clear();
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}
