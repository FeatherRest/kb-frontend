import { createApp } from 'vue'
import {
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NConfigProvider,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NGi,
  NH2,
  NIcon,
  NInput,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NMessageProvider,
  NRadio,
  NRadioButton,
  NRadioGroup,
  NGrid,
  NStatistic,
  NSpace,
  NTag,
  NTimeline,
  NTimelineItem,
  NUpload,
  NUploadDragger,
} from 'naive-ui'
import router from './router'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)

const components = [
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NConfigProvider,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NGi,
  NH2,
  NIcon,
  NInput,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NMessageProvider,
  NRadio,
  NRadioButton,
  NRadioGroup,
  NGrid,
  NStatistic,
  NSpace,
  NTag,
  NTimeline,
  NTimelineItem,
  NUpload,
  NUploadDragger,
]

components.forEach(component => app.use(component))
app.use(router)
app.use(createPinia())
app.mount('#app')
