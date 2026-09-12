<template>
  <n-message-provider>
    <n-dialog-provider>
      <n-config-provider :theme="darkTheme" :locale="zhCN" :date-locale="dateZhCN">
        <n-layout position="absolute" style="height: 100vh; background: #1a1a2e">
          <n-layout-header class="kb-header">
            <div class="kb-brand">📚 知识库</div>
            <n-space align="center" :size="8">
              <n-tag :type="healthType" size="small" round>
                {{ healthLabel }}
              </n-tag>
              <n-tag v-if="stats" size="small" round :bordered="false">
                {{ stats.documents ?? 0 }} 文档 · {{ stats.chunks ?? 0 }} 分块
              </n-tag>
              <n-button quaternary size="small" :loading="loadingHealth" @click="refreshHealth">
                <template #icon><n-icon :component="RefreshOutline" /></template>
              </n-button>
            </n-space>
          </n-layout-header>

          <n-layout has-sider position="absolute" style="top: 56px; bottom: 0">
            <n-layout-sider
              bordered
              collapse-mode="width"
              :collapsed-width="64"
              :collapsed="false"
              :width="200"
              style="background: #16162a"
            >
              <n-menu
                :value="activeKey"
                :options="menuOptions"
                :root-indirection="5"
                @update:value="onSelect"
              />
            </n-layout-sider>

            <n-layout-content
              content-style="padding: 20px 24px;"
              :native-scrollbar="false"
              style="background: #1e1e2e"
            >
              <router-view v-slot="{ Component }">
                <keep-alive :max="4">
                  <component :is="Component" />
                </keep-alive>
              </router-view>
            </n-layout-content>
          </n-layout>
        </n-layout>
      </n-config-provider>
    </n-dialog-provider>
  </n-message-provider>
</template>

<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { darkTheme, zhCN, dateZhCN, NIcon } from 'naive-ui'
import {
  ChatbubbleOutline,
  ClipboardOutline,
  DocumentTextOutline,
  FolderOpenOutline,
  LibraryOutline,
  RefreshOutline,
  SearchOutline,
  ServerOutline,
  SettingsOutline,
} from '@vicons/ionicons5'
import { getHealth, getStats } from './api/kbApi.js'

const route = useRoute()
const router = useRouter()

const health = ref(null)
const stats = ref(null)
const loadingHealth = ref(false)

const MENU = [
  { key: 'Search', label: '搜索', icon: SearchOutline, path: '/search' },
  { key: 'Zones', label: '专区', icon: LibraryOutline, path: '/zones' },
  { key: 'Pending', label: '待处理', icon: FolderOpenOutline, path: '/pending' },
  { key: 'Preview', label: '文档解析', icon: DocumentTextOutline, path: '/preview' },
  { key: 'Parsers', label: '解析器', icon: ServerOutline, path: '/parsers' },
  { key: 'Plan', label: '计划表', icon: ClipboardOutline, path: '/plan' },
  { key: 'Kbs', label: '知识库管理', icon: ChatbubbleOutline, path: '/kbs' },
]

const menuOptions = MENU.map((m) => ({
  key: m.key,
  label: m.label,
  icon: () => h(NIcon, null, { default: () => h(m.icon) }),
}))

const activeKey = computed(() => {
  const name = String(route.name || '')
  if (name === 'KbConfig') return 'Kbs'
  return name || 'Search'
})

function onSelect(key) {
  const item = MENU.find((m) => m.key === key)
  if (item) router.push(item.path)
}

const healthType = computed(() => {
  if (!health.value) return 'default'
  return health.value.status === 'ok' ? 'success' : 'error'
})
const healthLabel = computed(() => {
  if (!health.value) return '未连接'
  return health.value.status === 'ok' ? '系统正常' : '离线'
})

async function refreshHealth() {
  loadingHealth.value = true
  try {
    health.value = await getHealth()
    stats.value = await getStats()
  } catch {
    health.value = { status: 'unreachable' }
    stats.value = null
  } finally {
    loadingHealth.value = false
  }
}

onMounted(refreshHealth)
</script>

<style>
body {
  background: #1a1a2e;
}
.kb-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #16162a;
  border-bottom: 1px solid #2a2a3e;
}
.kb-brand {
  font-size: 18px;
  font-weight: 700;
  color: #66ccff;
  letter-spacing: 0.5px;
}
.kb-page-title {
  font-size: 16px;
  font-weight: 600;
  color: #e0e0f0;
  margin: 0 0 14px;
}
.kb-dim {
  color: #7f8fa4;
  font-size: 12px;
}
.kb-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
</style>
