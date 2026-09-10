/**
 * appMenu.ts — 全局菜单配置（侧栏 / 顶栏下拉共用数据源）
 */

export interface MenuItem {
  path: string;
  label: string;
  /** 16×16 描边图标 path（stroke 用） */
  icon: string;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: '态势总览',
    items: [
      { path: '/dashboard', label: '工程一张图', icon: 'M1.5 3.5 5.5 2l5 1.5 4-1.5v10l-4 1.5-5-1.5-4 1.5zM5.5 2v10.5M10.5 3.5V14' },
    ],
  },
  {
    title: '运行监测',
    items: [
      { path: '/scada', label: '运行监控', icon: 'M1 8.5h3.5L6.5 4l3 8 1.5-3.5H15' },
      { path: '/water-quality', label: '水质管理', icon: 'M8 1.8C8 1.8 3.2 7 3.2 10.2a4.8 4.8 0 0 0 9.6 0C12.8 7 8 1.8 8 1.8Z' },
    ],
  },
  {
    title: '应急管理',
    items: [
      { path: '/emergency', label: '应急调度', icon: 'M8 2.2 14.6 13.6H1.4L8 2.2ZM8 6.8v3M8 12.2v.01' },
    ],
  },
  {
    title: '业务管理',
    items: [
      { path: '/archives', label: '工程档案', icon: 'M2.2 5.2h11.6V14H2.2V5.2ZM2.2 5.2 3.6 2h8.8l1.4 3.2M6.3 8.6h3.4' },
      { path: '/patrol', label: '巡检工单', icon: 'M5.2 2.6h5.6v2H5.2v-2ZM4.2 3.6H2.4V14h11.2V3.6h-1.8M5.2 8h5.6M5.2 11h3.6' },
      { path: '/billing', label: '收费服务', icon: 'M8 1.6a6.4 6.4 0 1 0 0 12.8A6.4 6.4 0 0 0 8 1.6ZM5.6 4.6 8 8l2.4-3.4M8 8v4.2M5.9 9.3h4.2M5.9 11h4.2' },
      { path: '/public-service', label: '公众服务', icon: 'M5.8 7.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8ZM1.6 13.6c0-2.5 1.9-3.9 4.2-3.9s4.2 1.4 4.2 3.9M11 3a2.2 2.2 0 0 1 0 4.4M12.2 9.9c1.5.5 2.4 1.7 2.4 3.7' },
    ],
  },
  {
    title: '决策支持',
    items: [
      { path: '/assessment', label: '统计考核', icon: 'M1.8 14.2h12.4M4.2 14V9.4M8 14V4.6M11.8 14V6.8' },
    ],
  },
  {
    title: '系统',
    items: [
      { path: '/system', label: '系统管理', icon: 'M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8ZM8 1.6v1.8M8 12.6v1.8M1.6 8h1.8M12.6 8h1.8M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3' },
    ],
  },
];
