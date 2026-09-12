<template>
  <n-message-provider>
    <n-dialog-provider>
      <n-config-provider
        :theme="lightTheme"
        :theme-overrides="themeOverrides"
        :locale="zhCN"
        :date-locale="dateZhCN"
      >
        <div class="kb-shell">
          <!-- ── 顶栏 ── -->
          <header class="kb-header">
            <n-button
              v-if="isMobile"
              quaternary
              size="small"
              class="kb-burger"
              aria-label="打开导航"
              @click="drawerOpen = true"
            >
              <template #icon><n-icon size="20" :component="MenuOutline" /></template>
            </n-button>
            <div class="kb-brand">📚 知识库</div>
            <div class="kb-header-right">
              <n-tag :type="healthType" size="small" round>{{ healthLabel }}</n-tag>
              <n-tag v-if="!isMobile && stats" size="small" round :bordered="false">
                {{ stats.documents ?? 0 }} 文档 · {{ stats.chunks ?? 0 }} 分块
              </n-tag>
              <n-button quaternary size="small" :loading="loadingHealth" @click="refreshHealth">
                <template #icon><n-icon :component="RefreshOutline" /></template>
              </n-button>
            </div>
          </header>

          <div class="kb-body">
            <!-- 桌面：常驻侧边栏 -->
            <aside v-if="!isMobile" class="kb-sider">
              <n-menu
                :value="activeKey"
                :options="menuOptions"
                :root-indirection="5"
                @update:value="onSelect"
              />
            </aside>

            <main class="kb-content">
              <router-view v-slot="{ Component }">
                <keep-alive :max="4">
                  <component :is="Component" />
                </keep-alive>
              </router-view>
            </main>
          </div>

          <!-- ── 手机：抽屉导航 ── -->
          <n-drawer v-model:show="drawerOpen" :width="288" placement="left" :trap-focus="false">
            <n-drawer-content body-content-style="padding: 10px;">
              <div class="kb-drawer-brand">📚 知识库</div>
              <n-menu
                :value="activeKey"
                :options="menuOptions"
                :root-indirection="5"
                @update:value="onSelect"
              />
              <template #footer>
                <div class="kb-dim">
                  {{ stats ? `${stats.documents ?? 0} 文档 · ${stats.chunks ?? 0} 分块` : '—' }}
                </div>
              </template>
            </n-drawer-content>
          </n-drawer>
        </div>
      </n-config-provider>
    </n-dialog-provider>
  </n-message-provider>
</template>

<script setup>
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { lightTheme, zhCN, dateZhCN, NIcon } from 'naive-ui'
import {
  ChatbubbleOutline,
  ClipboardOutline,
  DocumentTextOutline,
  FolderOpenOutline,
  LibraryOutline,
  MenuOutline,
  RefreshOutline,
  SearchOutline,
  ServerOutline,
} from '@vicons/ionicons5'
import { getHealth, getStats } from './api/kbApi.js'

const route = useRoute()
const router = useRouter()

const health = ref(null)
const stats = ref(null)
const loadingHealth = ref(false)

/* ── 手机端：抽屉导航状态 ── */
const MOBILE_QUERY = '(max-width: 768px)'
const isMobile = ref(typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false)
const drawerOpen = ref(false)
let mql = null

function syncMobile(e) {
  isMobile.value = e.matches
  if (!e.matches) drawerOpen.value = false
}

/* 路由变化自动收起抽屉 */
watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
  },
)

/* ── Apple 简约白色主题覆盖 ── */
const themeOverrides = {
  common: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif',
    fontSize: '14px',
    primaryColor: '#0071e3',
    primaryColorHover: '#0077ed',
    primaryColorPressed: '#006edb',
    primaryColorSuppl: '#0077ed',
    infoColor: '#0071e3',
    successColor: '#34c759',
    warningColor: '#ff9500',
    errorColor: '#ff3b30',
    borderRadius: '8px',
    borderRadiusSmall: '8px',
    bodyColor: '#f5f5f7',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',
    tableHeaderColor: '#fbfbfd',
    inputColor: '#ffffff',
    borderColor: '#e8e8ed',
    dividerColor: '#e8e8ed',
    textColorBase: '#1d1d1f',
    textColor1: '#1d1d1f',
    textColor2: '#3a3a3c',
    textColor3: '#6e6e73',
    placeholderColor: '#a1a1a6',
    hoverColor: '#f5f5f7',
  },
  Card: { borderRadius: '16px', color: '#ffffff', borderColor: '#e8e8ed' },
  Button: { borderRadiusMedium: '8px', borderRadiusSmall: '8px', textColorPrimary: '#ffffff' },
  Menu: {
    itemColorActive: '#e8f1fd',
    itemColorActiveHover: '#dceafc',
    itemTextColorActive: '#0071e3',
    itemTextColorActiveHover: '#0071e3',
    itemIconColorActive: '#0071e3',
    itemIconColorActiveHover: '#0071e3',
    borderRadius: '10px',
    itemHeight: '42px',
  },
  DataTable: {
    thColor: '#fbfbfd',
    thTextColor: '#6e6e73',
    tdColor: '#ffffff',
    borderColor: '#e8e8ed',
    thFontWeight: '600',
  },
  Tag: { borderRadius: '100px' },
  Drawer: { color: '#ffffff' },
  Modal: { color: '#ffffff' },
}

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
  drawerOpen.value = false
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

onMounted(() => {
  refreshHealth()
  if (typeof window !== 'undefined' && window.matchMedia) {
    mql = window.matchMedia(MOBILE_QUERY)
    isMobile.value = mql.matches
    mql.addEventListener('change', syncMobile)
  }
})

onBeforeUnmount(() => {
  if (mql) mql.removeEventListener('change', syncMobile)
})
</script>

<style>
.kb-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f7;
}

/* ── 顶栏 ── */
.kb-header {
  flex: 0 0 auto;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid #e8e8ed;
  position: sticky;
  top: 0;
  z-index: 20;
}
.kb-brand {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #1d1d1f;
}
.kb-header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── 主体 ── */
.kb-body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.kb-sider {
  flex: 0 0 208px;
  width: 208px;
  padding: 10px 8px;
  background: #ffffff;
  border-right: 1px solid #e8e8ed;
  overflow-y: auto;
}
.kb-content {
  flex: 1 1 auto;
  min-width: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 20px 24px calc(24px + env(safe-area-inset-bottom, 0px));
  background: #f5f5f7;
}
.kb-drawer-brand {
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
  padding: 8px 12px 12px;
}

/* ── 手机端 ── */
@media (max-width: 768px) {
  .kb-header {
    padding: 0 12px;
    height: 52px;
  }
  .kb-content {
    padding: 14px 12px calc(20px + env(safe-area-inset-bottom, 0px));
  }
  .kb-burger {
    margin-left: -6px;
  }
}
</style>
