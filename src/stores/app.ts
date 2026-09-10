import { defineStore } from 'pinia';
import { mockData } from '@mock/index';
import type { EmergencyEvent, MonitorPoint } from '@shared/types';

export const useAppStore = defineStore('app', {
  state: () => ({
    alerts: mockData.alerts as EmergencyEvent[],
    monitors: mockData.monitors as MonitorPoint[],
    projects: mockData.projects,
    cockpit: mockData.cockpit,
    sidebarCollapsed: false,
  }),
  getters: {
    unsignedCount: (s) => s.alerts.filter(a => a.status === '未签收').length,
    alarmProjects: (s) => s.projects.filter(p => p.status === 'alarm'),
  },
});
