/**
 * ProjectLayer — A-D 形状 × 5 状态
 * - Sprite + CanvasTexture：A 六边形 / B 方 / C 圆 / D 三角
 * - 颜色按 STATUS_COLOR 映射
 * - 5 状态可选渲染样式：normal=呼吸 / alarm=脉冲 / repair=扳手符 / stop=空心 / offline=虚线
 * - Raycaster 点选 → emit 'layer:click' 携带 projectId
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Project, Status } from '@/shared/types';
import { STATUS_COLOR, GRADE_SHAPE } from '@/shared/types';
import { BaseLayer } from './BaseLayer';
import { lon2xy } from './utils/lon2xy';
import type { PickableEntry } from './hitTest';

const SPRITE_SIZE = 9000;

interface ProjectEntry {
  sprite: THREE.Sprite;
  baseScale: number;
  label?: CSS2DObject;
  projectId: string;
  status: Status;
}

export class ProjectLayer extends BaseLayer {
  readonly name = 'Project';
  private group = new THREE.Group();
  private entries: ProjectEntry[] = [];
  private clickHandler: ((id: string) => void) | null = null;
  /** 时间累加（用于呼吸/脉冲） */
  private t = 0;

  override init(): void {
    this.group.name = 'ProjectGroup';
  }

  override update(dt: number): void {
    this.t += dt;
    // 呼吸/脉冲：scale 微动
    for (const e of this.entries) {
      const base = e.baseScale;
      let amp = 0;
      if (e.status === 'normal') {
        amp = Math.sin(this.t * 2.0) * 0.08;
      } else if (e.status === 'alarm') {
        // 脉冲：0.6s 一个周期
        amp = Math.abs(Math.sin(this.t * 4.0)) * 0.25;
      }
      const k = 1 + amp;
      e.sprite.scale.set(base * k, base * k, 1);
    }
  }

  override dispose(): void {
    for (const e of this.entries) {
      (e.sprite.material as THREE.SpriteMaterial).map?.dispose();
      (e.sprite.material as THREE.SpriteMaterial).dispose();
      if (e.label) e.label.element.remove();
    }
    this.entries = [];
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  /** 喂入工程数据 */
  setData(projects: Project[]): void {
    // 清旧
    for (const e of this.entries) {
      this.group.remove(e.sprite);
      (e.sprite.material as THREE.SpriteMaterial).map?.dispose();
      (e.sprite.material as THREE.SpriteMaterial).dispose();
    }
    this.entries = [];

    for (const p of projects) {
      const xy = lon2xy(p.coord[0], p.coord[1]);
      const tex = drawProjectTexture(p.grade, p.status);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(xy.x, xy.y, 0);
      // D 级量大（1800+），缩小 + 半透明避免糊成一片；A/B/C 正常尺寸
      const size = p.grade === 'D' ? SPRITE_SIZE * 0.35 : SPRITE_SIZE;
      sprite.scale.set(size, size, 1);
      const baseScale = size;
      if (p.grade === 'D') (sprite.material as THREE.SpriteMaterial).opacity = 0.55;
      sprite.userData = { projectId: p.id };
      sprite.name = `ProjectSprite:${p.id}`;
      // A 级挂 CSS2D 名称牌（design-system §11 融合标注语言）
      if (p.grade === 'A') {
        const div = document.createElement('div');
        div.className = 'sl-gis-tag3d';
        // 短标签：取编号段（如 "赛罕塔拉镇 · A-11 集中式供水工程" → "A-11"）避免重叠
        const idm = p.name.match(/([ABC]-\d+)/);
        div.textContent = idm ? idm[1] : p.name.slice(0, 8);
        const label = new CSS2DObject(div);
        label.position.set(0, 0.55, 0); // 相对 sprite 中心上方
        sprite.add(label);
      }
      this.group.add(sprite);
      this.entries.push({ sprite, baseScale, projectId: p.id, status: p.status });
    }
  }

  /** 提供给 Stage 拾取 */
  getPickables(): PickableEntry[] {
    return this.entries.map(e => ({
      mesh: e.sprite,
      id: e.projectId,
      meta: { status: e.status },
    }));
  }

  /** 业务侧订阅 */
  onClick(handler: (id: string) => void): void {
    this.clickHandler = handler;
  }

  /** Stage 调用：命中后转发 */
  handleClick(projectId: string): void {
    this.clickHandler?.(projectId);
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}

/* ---------- 形状 / 状态 画到 CanvasTexture ---------- */

const SHAPE_FN: Record<string, (ctx: CanvasRenderingContext2D, r: number) => void> = {
  hex: drawHex,
  square: drawSquare,
  circle: drawCircle,
  triangle: drawTriangle,
};

function drawProjectTexture(grade: 'A' | 'B' | 'C' | 'D', status: Status): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const r = 48;
  const color = STATUS_COLOR[status];

  // 5 状态渲染样式
  ctx.lineWidth = 4;

  if (status === 'stop') {
    // 空心
    ctx.strokeStyle = color;
    ctx.fillStyle = 'transparent';
    drawShape(ctx, GRADE_SHAPE[grade], r, /*fill*/ false, /*stroke*/ true);
  } else if (status === 'offline') {
    // 虚线
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = color;
    ctx.fillStyle = 'transparent';
    drawShape(ctx, GRADE_SHAPE[grade], r, false, true);
    ctx.setLineDash([]);
  } else if (status === 'repair') {
    // 实心 + 扳手符
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5;
    drawShape(ctx, GRADE_SHAPE[grade], r, true, true);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    drawShape(ctx, GRADE_SHAPE[grade], r, false, true);
    // 扳手符号
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚙', cx, cy + 2);
  } else {
    // normal / alarm：实心 + 描边
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    drawShape(ctx, GRADE_SHAPE[grade], r, true, true);
    // 中心白点
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: 'hex' | 'square' | 'circle' | 'triangle',
  r: number,
  fill: boolean, stroke: boolean,
): void {
  const fn = SHAPE_FN[shape];
  if (!fn) return;
  // 先 beginPath 再交给具体绘制（绘制函数内部固定居中到 64,64）
  ctx.beginPath();
  fn(ctx, r);
  // hex/square/triangle 用了 path 但圆用的是 arc，单独处理
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawHex(ctx: CanvasRenderingContext2D, r: number): void {
  const cx = 64, cy = 64;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawSquare(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.rect(64 - r * 0.85, 64 - r * 0.85, r * 1.7, r * 1.7);
}

function drawCircle(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.moveTo(64 + r, 64);
  ctx.arc(64, 64, r, 0, Math.PI * 2);
}

function drawTriangle(ctx: CanvasRenderingContext2D, r: number): void {
  const cx = 64, cy = 64;
  for (let i = 0; i < 3; i++) {
    const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}