import { createApp } from 'vue'
import naive from 'naive-ui'
import router from './router'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(naive)
app.use(router)
app.use(createPinia())
app.mount('#app')
