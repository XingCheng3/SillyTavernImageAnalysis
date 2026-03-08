import {createApp} from 'vue'
import App from './App.vue'
// pinia
import {createPinia} from 'pinia'
//router
import router from './router'
//crud
import curdVue3 from './utils/curdVue3'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './assets/main.css'
import './assets/index-view.css'

const app = createApp(App)

// Register Element Plus icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 提供全局方法
const pinia = createPinia() // 创建 Pinia 实例
app.use(pinia)
app.use(router)
app.use(curdVue3)
app.use(ElementPlus)

app.provide('ExecDatabase', app.config.globalProperties.ExecDatabase)

app.mount('#app')