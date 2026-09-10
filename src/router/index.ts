import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: () => import('@/views/pipe-network/Dashboard.vue'), meta: { title: '工程一张图' } },
    { path: '/scada', name: 'scada', component: () => import('@/views/scada/Dashboard.vue'), meta: { title: '运行监控' } },
    { path: '/emergency', name: 'emergency', component: () => import('@/views/emergency/Dashboard.vue'), meta: { title: '应急调度' } },
    { path: '/archives', name: 'archives', component: () => import('@/views/archives/List.vue'), meta: { title: '工程档案' } },
    { path: '/archives/:id', name: 'archive-detail', component: () => import('@/views/archives/Detail.vue'), meta: { title: '档案详情' } },
    { path: '/water-quality', name: 'water-quality', component: () => import('@/views/water-quality/Dashboard.vue'), meta: { title: '水质管理' } },
    { path: '/patrol', name: 'patrol', component: () => import('@/views/patrol/Dashboard.vue'), meta: { title: '巡检工单' } },
    { path: '/billing', name: 'billing', component: () => import('@/views/billing/Dashboard.vue'), meta: { title: '收费服务' } },
    { path: '/public-service', name: 'public-service', component: () => import('@/views/public-service/Dashboard.vue'), meta: { title: '公众服务' } },
    { path: '/assessment', name: 'assessment', component: () => import('@/views/assessment/Dashboard.vue'), meta: { title: '统计考核' } },
    { path: '/system', name: 'system', component: () => import('@/views/system/Dashboard.vue'), meta: { title: '系统管理' } },
  ],
});

export default router;
