import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// nanoai.fun/sl-gis 部署：base 必须为 '/sl-gis/'，本地 dev 不影响
const BASE = process.env.VITE_BASE || '/sl-gis/';

export default defineConfig({
  base: BASE,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@canvas': fileURLToPath(new URL('./src/components/canvas', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/components/ui', import.meta.url)),
      '@charts': fileURLToPath(new URL('./src/components/charts', import.meta.url)),
      '@stores': fileURLToPath(new URL('./src/stores', import.meta.url)),
      '@mock': fileURLToPath(new URL('./src/mock', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: 'http://localhost:8090', changeOrigin: true, ws: true },  // nano-api（systemd 8090）
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          echarts: ['echarts', 'echarts-gl'],
          vue: ['vue', 'vue-router', 'pinia'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['three', 'echarts', 'echarts-gl', 'v-scale-screen', 'mockjs'],
  },
});
