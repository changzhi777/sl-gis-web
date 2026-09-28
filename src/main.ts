import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './styles/tokens.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
// 等首个路由解析完成再挂载（守卫重定向在挂载前生效 · 防初始帧闪 AppShell）
router.isReady().then(() => app.mount('#app'));
