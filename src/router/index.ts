import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: () => import('@/views/pipe-network/Dashboard.vue') },
    { path: '/scada', name: 'scada', component: () => import('@/views/scada/Dashboard.vue') },
    { path: '/emergency', name: 'emergency', component: () => import('@/views/emergency/Dashboard.vue') },
    { path: '/archives', name: 'archives', component: () => import('@/views/archives/List.vue') },
    { path: '/archives/:id', name: 'archive-detail', component: () => import('@/views/archives/Detail.vue') },
    { path: '/water-quality', name: 'water-quality', component: () => import('@/views/water-quality/Dashboard.vue') },
    { path: '/patrol', name: 'patrol', component: () => import('@/views/patrol/Dashboard.vue') },
    { path: '/billing', name: 'billing', component: () => import('@/views/billing/Dashboard.vue') },
    { path: '/public-service', name: 'public-service', component: () => import('@/views/public-service/Dashboard.vue') },
    { path: '/assessment', name: 'assessment', component: () => import('@/views/assessment/Dashboard.vue') },
    { path: '/system', name: 'system', component: () => import('@/views/system/Dashboard.vue') },
  ],
});

export default router;
