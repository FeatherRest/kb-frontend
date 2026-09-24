<template>
  <div class="kb-browse-root" @dragover.prevent="onDragOver" @dragleave="onDragLeave" @drop.prevent="onDrop">
    <!-- 整页拖拽提示 -->
    <div v-if="dragging" class="kb-drop-overlay">
      <div class="kb-drop-box">松开鼠标 → 打开导入向导</div>
    </div>

    <!-- 知识库头部 -->
    <n-card size="small" class="kb-card">
      <div class="kb-kb-head">
        <span class="kb-kb-name">{{ kb?.name || kbId }}</span>
        <n-tag v-if="kb?.is_system" size="tiny" type="info" round>系统</n-tag>
      </div>
      <div class="kb-meta-row">
        <n-tag size="tiny" round :bordered="false">{{ kb?.stats?.documents ?? 0 }} 文档</n-tag>
        <n-tag size="tiny" round :bordered="false">{{ kb?.stats?.chunks ?? 0 }} 分块</n-tag>
        <n-tag size="tiny" round :bordered="false" :title="kb?.root_path">📁 {{ kb?.root_path }}</n-tag>
        <n-button size="tiny" quaternary @click="copyPath">复制路径</n-button>
      </div>
      <n-space :size="8" style="margin-top: 10px" align="center" wrap>
        <n-button size="small" type="primary" @click="wizardShow = true">＋ 导入文件</n-button>
        <n-button size="small" tertiary @click="router.push(`/kbs/${kbId}/config`)">配置</n-button>
        <n-button size="small" quaternary @click="reloadAll">刷新</n-button>
        <n-switch v-model:value="showAll" size="small" />
        <span class="kb-dim">显示全部（含忽略名单里的目录）</span>
      </n-space>
    </n-card>

    <!-- 四个标签页：台账 / 目录与内容 / 回收站 / Git 变更 -->
    <n-tabs v-model:value="detailTab" type="line" size="small" animated style="margin-top: 14px">
      <n-tab-pane name="ledger" :tab="counts.ledger === null ? '文件台账' : `文件台账 (${counts.ledger})`">
        <KbLedgerTab
          v-if="detailTab === 'ledger'"
          :key="`ledger-${reloadKey}`"
          :kb-id="kbId"
          @update:count="(n) => (counts.ledger = n)"
          @changed="loadKb"
        />
      </n-tab-pane>

      <n-tab-pane name="browse" tab="目录与内容">
        <KbBrowseTab
          v-if="detailTab === 'browse'"
          ref="browseRef"
          :key="`browse-${reloadKey}`"
          :kb-id="kbId"
          :show-all="showAll"
          @changed="loadKb"
        />
      </n-tab-pane>

      <n-tab-pane name="trash" :tab="counts.trash === null ? '回收站' : `回收站 (${counts.trash})`">
        <KbTrashTab
          v-if="detailTab === 'trash'"
          :key="`trash-${reloadKey}`"
          :kb-id="kbId"
          @update:count="(n) => (counts.trash = n)"
        />
      </n-tab-pane>

      <n-tab-pane name="git" :tab="counts.git === null ? 'Git 变更' : `Git 变更 (${counts.git})`">
        <KbGitTab
          v-if="detailTab === 'git'"
          :key="`git-${reloadKey}`"
          :kb-id="kbId"
          @update:count="(n) => (counts.git = n)"
        />
      </n-tab-pane>
    </n-tabs>

    <ImportWizard
      v-model:show="wizardShow"
      :kb-id="kbId"
      :kb-name="kb?.name || kbId"
      @done="onImported"
    />
  </div>
</template>

<script setup>
import { computed, onActivated, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { getKb } from '../api/kbApi.js'
import ImportWizard from '../components/ImportWizard.vue'
import KbBrowseTab from '../components/KbBrowseTab.vue'
import KbGitTab from '../components/KbGitTab.vue'
import KbLedgerTab from '../components/KbLedgerTab.vue'
import KbTrashTab from '../components/KbTrashTab.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const kbId = computed(() => String(route.params.id || ''))
const kb = ref(null)
const showAll = ref(false)
const detailTab = ref('ledger')
const counts = ref({ ledger: null, trash: null, git: null })
const wizardShow = ref(false)
const dragging = ref(false)
/** 自增即重建激活中的 tab 组件（子 tab 各管自己的加载，父级只负责触发） */
const reloadKey = ref(0)
const browseRef = ref(null)

async function loadKb() {
  if (!kbId.value) return
  try {
    kb.value = await getKb(kbId.value)
  } catch (e) {
    message.error(`知识库加载失败：${e.message}`)
  }
}

function reloadAll() {
  if (!kbId.value) return
  counts.value = { ledger: null, trash: null, git: null }
  reloadKey.value += 1
  loadKb()
}

function onImported() {
  message.success('已提交解析，稍后可在「文件台账」查看进度')
  reloadAll()
}

async function copyPath() {
  try {
    await navigator.clipboard.writeText(kb.value?.root_path || '')
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

/* 整页拖拽 → 打开导入向导（浏览页本身没有静默上传入口，避免"文件拖进来就没了"） */
function onDragOver() {
  dragging.value = true
}
function onDragLeave() {
  dragging.value = false
}
function onDrop(ev) {
  dragging.value = false
  const dropped = ev?.dataTransfer?.files
  wizardShow.value = true
  if (dropped?.length) {
    message.info(`检测到 ${dropped.length} 个文件：在向导里拖入（或点击选择）即可设置分段并预览`)
  }
}

watch(
  () => route.params.id,
  (id) => {
    // 🔴 离开详情页时 route.params.id 会变成空 → 组件即将卸载，**不要**再发请求
    //（否则会打 /kbs//tree、/kbs//overview，经 nginx 合并斜杠后被后端当成 kb_id=tree → 404）
    if (!id) return
    counts.value = { ledger: null, trash: null, git: null }
    reloadKey.value += 1
    loadKb()
  },
)

// onActivated：keep-alive 缓存下每次回到详情页都重新拉数据
onActivated(() => {
  reloadAll()
})
</script>

<style scoped>
.kb-browse-root {
  position: relative;
}
.kb-drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 122, 255, 0.08);
  border: 2px dashed #007aff;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.kb-drop-box {
  background: #ffffff;
  border-radius: 12px;
  padding: 14px 22px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  color: #1d1d1f;
  font-size: 14px;
  font-weight: 600;
}
.kb-kb-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.kb-kb-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--kb-text);
}
.kb-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
</style>
