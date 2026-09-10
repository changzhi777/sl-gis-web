/**
 * TileLayer — 天地图卫星瓦片底图（45° 倾斜场景 · Web 墨卡托直铺）
 * - 坐标系与场景 lon2xy（EPSG:3857）完全一致，瓦片按 xyz 直接换算世界坐标
 * - 深蓝色 multiply 调色压暗卫星图，保持深蓝科技风
 * - 受 setBaseMapType('satellite') 切换；默认 dark 模式隐藏
 *
 * tk 说明：天地图浏览器端 key 靠域名白名单管安全（公开可见属正常）
 * tk 从 vite env 注入：VITE_TIANDITU_TK
 */
import * as THREE from 'three';
import { BaseLayer } from './BaseLayer';

const TK = import.meta.env.VITE_TIANDITU_TK || '';

/** Web 墨卡托瓦片：z/x/y → 该瓦片的世界坐标范围 */
function tileBounds(z: number, x: number, y: number) {
  const n = Math.pow(2, z);
  const world = 2 * 20037508.34;
  const tileW = world / n;
  const minX = -world / 2 + x * tileW;
  const minY = world / 2 - (y + 1) * tileW;
  return { minX, minY, maxX: minX + tileW, maxY: minY + tileW, size: tileW };
}

/** 经纬度 → 瓦片坐标 */
function lonLatToTile(lon: number, lat: number, z: number) {
  const n = Math.pow(2, z);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

export class TileLayer extends BaseLayer {
  readonly name = 'Tile';
  private group = new THREE.Group();
  private groupVisible = false;
  private built = false;

  override init(): void {
    this.group.name = 'TileGroup';
    this.group.visible = false; // 默认暗色科技模式，satellite 模式才显示
  }

  /** banner bbox 就绪后按需构建瓦片面（幂等，只建一次） */
  buildForBBox(bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number }): void {
    if (this.built || !TK) return;
    this.built = true;

    // 选 zoom：让旗县横跨约 4-8 张瓦片
    let z = 12;
    for (; z >= 6; z--) {
      const tl = lonLatToTile(bbox.minLon, bbox.maxLat, z);
      const br = lonLatToTile(bbox.maxLon, bbox.minLat, z);
      const span = (br.x - tl.x + 1) * (br.y - tl.y + 1);
      if (span <= 64) break;
    }

    const tl = lonLatToTile(bbox.minLon, bbox.maxLat, z);
    const br = lonLatToTile(bbox.maxLon, bbox.minLat, z);

    const geoms: THREE.BufferGeometry[] = [];
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    for (let x = tl.x; x <= br.x; x++) {
      for (let y = tl.y; y <= br.y; y++) {
        const b = tileBounds(z, x, y);
        const url = `https://t${(x + y) % 8}.tianditu.gov.cn/DataServer?T=img_w&x=${x}&y=${y}&l=${z}&tk=${TK}`;
        const tex = loader.load(url, undefined, undefined, () => {
          // 加载失败的瓦片静默跳过（材质透明兜底）
        });
        tex.colorSpace = THREE.SRGBColorSpace;

        const g = new THREE.PlaneGeometry(b.size, b.size);
        // Plane UV 原点在左下；瓦片 y 从北往南增 — 直接按世界坐标摆放即可对齐
        const m = new THREE.MeshBasicMaterial({
          map: tex,
          color: 0x5a7a9a, // 深蓝 multiply 压暗，保持科技风色调
          transparent: false,
          depthWrite: true,
        });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, -35);
        mesh.renderOrder = -2;
        geoms.push(g);
        this.group.add(mesh);
      }
    }

    // 整组合批（同材质 + 贴图不同的 mesh 无法 merge — 保留独立 mesh，量级 ~64 个可接受）
    void geoms;
  }

  /** 与 BaseMapLayer.setBaseMapType 联动 */
  setBaseMapType(type: 'dark' | 'satellite' | 'tech'): void {
    this.groupVisible = type === 'satellite';
    this.group.visible = this.groupVisible && this.built;
  }

  override update(_dt: number): void { /* 静态瓦片，无逐帧更新 */ }

  override dispose(): void {
    this.group.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.MeshBasicMaterial | undefined;
      if (mat?.map) mat.map.dispose();
      if (mat) mat.dispose();
    });
    this.group.clear();
  }

  getObject3D(): THREE.Object3D {
    return this.group;
  }
}
