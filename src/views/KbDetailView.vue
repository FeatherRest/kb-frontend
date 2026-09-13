<template>
  <div>
    <!-- ── 顶部：知识库概览 ── -->
    <n-card size="small" class="kb-card kb-kb-head-card">
      <div class="kb-kb-head">
        <n-button size="small" quaternary @click="router.push('/kbs')">← 列表</n-button>
        <span class="kb-kb-name">{{ kb?.name || kbId }}</span>
        <n-tag size="tiny" round :bordered="false">{{ kbId }}</n-tag>
        <n-tag v-if="kbId === 'default'" size="tiny" type="info" round>系统</n-tag>
      </div>
      <div class="kb-meta-row">
        <n-tag size="tiny" round :bordered="false">{{ kb?.stats?.documents ?? 0 }} 文档</n-tag>
        <n-tag size="tiny" round :bordered="false">{{ kb?.stats?.chunks ?? 0 }} 分块</n-tag>
        <n-tag size="tiny" round :bordered="false" :title="kb?.root_path">📁 {{ kb?.root_path }}</n-tag>
        <n-button size="tiny" quaternary @click="copyPath">复制路径</n-button>
      </div>
      <n-space :size="8" style="margin-top: 10px" align="center" wrap>
        <n-button size="small" tertiary @click="router.push(`/kbs/${kbId}/config`)">配置</n-button>
        <n-button size="small" quaternary @click="reloadAll">刷新</n-button>
        <n-switch v-model:value="showAll" size="small" @update:value="reloadAll" />
        <span class="kb-dim">显示全部（含忽略名单里的目录）</span>
        <n-tag v-if="dirInfo?.ignored_patterns?.length" size="tiny" round :bordered="false">
          忽略 {{ dirInfo.ignored_patterns.length }} 项
        </n-tag>
      </n-space>
    </n-card>

    <n-grid :cols="3" :x-gap="14" :y-gap="14" class="kb-browse-grid">
      <!-- ── 目录树 ── -->
      <n-grid-item :span="1">
        <n-card size="small" title="目录" class="kb-card">
          <div class="kb-tree-wrap">
            <n-tree
              block-line
              :data="treeData"
              :selected-keys="selectedKeys"
              :default-expanded-keys="['__root__']"
              :load-data="loadNode"
              @update:selected-keys="onSelectKeys"
            />
          </div>
        </n-card>
      </n-grid-item>

      <!-- ── 右侧：摘要 + 文件列表 / 预览 ── -->
      <n-grid-item :span="2">
        <!-- OV 风格目录摘要 -->
        <n-card size="small" class="kb-card">
          <template #header>
            <div class="kb-card-head">
              <span>目录摘要</span>
              <n-tag size="tiny" round :bordered="false" :type="overview?.exists ? 'success' : 'default'">
                {{ overview?.exists ? (overview.stale ? '内容已变，建议重生成' : 'L0+L1 已生成') : '未生成' }}
              </n-tag>
            </div>
          </template>
          <template #header-extra>
            <n-space :size="6">
              <n-button size="tiny" tertiary :loading="genLoading" @click="generate(false)">生成摘要</n-button>
              <n-button
                v-if="overview?.exists"
                size="tiny"
                quaternary
                :loading="genLoading"
                @click="generate(true)"
              >
                重新生成
              </n-button>
            </n-space>
          </template>

          <n-alert v-if="overviewError" type="warning" :show-icon="true" style="margin-bottom: 10px">
            {{ overviewError }}
          </n-alert>

          <div v-if="overview?.abstract" class="kb-l0">
            <span class="kb-l0-tag">L0</span>{{ overview.abstract }}
          </div>
          <div v-if="overview?.overview" class="kb-l1" v-html="renderedOverview" />
          <div v-else-if="!overviewError" class="kb-dim">
            当前目录还没有摘要。点击「生成摘要」会用本机模型读取该目录的文件清单与内容抽样，产出
            <b>L0 一句话摘要</b> 与 <b>L1 结构化概览</b>（结果缓存，内容没变不会重复生成）。
          </div>
          <div v-if="overview?.generated_at" class="kb-dim" style="margin-top: 8px">
            {{ overview.model }} · {{ overview.generated_at }}
          </div>
        </n-card>

        <!-- 文件列表 -->
        <n-card size="small" class="kb-card" style="margin-top: 14px">
          <template #header>
            <div class="kb-card-head">
              <span>内容</span>
              <span class="kb-mono kb-path-line">{{ currentPath || '/' }}</span>
            </div>
          </template>
          <template #header-extra>
            <span class="kb-dim">{{ dirInfo?.dir_count ?? 0 }} 目录 · {{ dirInfo?.file_count ?? 0 }} 文件</span>
          </template>

          <n-space v-if="dirInfo?.breadcrumbs?.length > 1" :size="4" align="center" style="margin-bottom: 10px" wrap>
            <n-button
              v-for="(b, i) in dirInfo.breadcrumbs"
              :key="b.rel_path"
              size="tiny"
              :quaternary="i !== dirInfo.breadcrumbs.length - 1"
              :tertiary="i === dirInfo.breadcrumbs.length - 1"
              @click="openDir(b.rel_path)"
            >
              {{ b.name }}
            </n-button>
          </n-space>

          <n-spin :show="dirLoading">
            <n-space vertical :size="6">
              <div v-for="d in dirInfo?.dirs || []" :key="d.rel_path" class="kb-row kb-row-dir" @click="openDir(d.rel_path)">
                <span class="kb-row-icon">📁</span>
                <span class="kb-row-name">{{ d.name }}/</span>
                <span class="kb-dim">{{ d.children }} 项</span>
              </div>
              <div
                v-for="f in dirInfo?.files || []"
                :key="f.rel_path"
                class="kb-row"
                :class="{ 'kb-row-active': file?.rel_path === f.rel_path }"
                @click="openFile(f.rel_path)"
              >
                <span class="kb-row-icon">{{ fileIcon(f) }}</span>
                <span class="kb-row-name">{{ f.name }}</span>
                <span class="kb-dim">{{ formatSize(f.size) }}</span>
              </div>
              <n-empty
                v-if="!dirLoading && !(dirInfo?.dirs || []).length && !(dirInfo?.files || []).length"
                description="该目录为空"
                style="margin: 20px 0"
              />
            </n-space>
          </n-spin>
          <div v-if="dirInfo?.truncated" class="kb-dim" style="margin-top: 8px">条目过多，仅显示前部分</div>
        </n-card>

        <!-- 文件预览（桌面内嵌 / 手机抽屉） -->
        <n-card v-if="file && !isMobile" size="small" class="kb-card" style="margin-top: 14px">
          <template #header>
            <div class="kb-card-head">
              <span>{{ file.name }}</span>
              <n-tag size="tiny" round :bordered="false">{{ file.kind }}</n-tag>
            </div>
          </template>
          <template #header-extra>
            <n-space :size="6">
              <span class="kb-dim">{{ formatSize(file.size) }} · {{ file.mtime }}</span>
              <n-button size="tiny" quaternary @click="openRaw">新窗口打开</n-button>
              <n-button size="tiny" quaternary @click="file = null">关闭</n-button>
            </n-space>
          </template>
          <FilePreview :file="file" :kb-id="kbId" />
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 手机：文件预览全屏抽屉 -->
    <n-drawer v-if="isMobile" v-model:show="mobilePreview" placement="bottom" height="88vh" :trap-focus="false">
      <n-drawer-content :title="file?.name || '预览'" closable>
        <template #header>
          <div class="kb-card-head">
            <span>{{ file?.name }}</span>
            <n-tag size="tiny" round :bordered="false">{{ file?.kind }}</n-tag>
          </div>
        </template>
        <template #footer>
          <n-space :size="8">
            <n-button size="small" quaternary @click="openRaw">新窗口打开</n-button>
            <n-button size="small" quaternary @click="mobilePreview = false">关闭</n-button>
          </n-space>
        </template>
        <FilePreview :file="file" :kb-id="kbId" />
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import MarkdownIt from 'markdown-it'
import {
  generateKbOverview,
  getKb,
  getKbOverview,
  kbRawUrl,
  listKbTree,
  previewKbFile,
} from '../api/kbApi.js'
import { useIsMobile } from '../composables/useIsMobile.js'
import FilePreview from '../components/FilePreview.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { isMobile } = useIsMobile()

const md = new MarkdownIt({ html: false, linkify: true, breaks: false })

const kbId = computed(() => String(route.params.id || ''))
const kb = ref(null)
const showAll = ref(false)

const treeData = ref([])
const selectedKeys = ref([])
const currentPath = ref('')
const dirInfo = ref(null)
const dirLoading = ref(false)

const file = ref(null)
const mobilePreview = ref(false)

const overview = ref(null)
const overviewError = ref('')
const genLoading = ref(false)

const renderedOverview = computed(() =>
  overview.value?.overview ? md.render(overview.value.overview) : '',
)

function formatSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function fileIcon(f) {
  if (f.kind === 'image') return '🖼'
  if (f.ext === '.md') return '📝'
  if (f.ext === '.json') return '🧩'
  if (f.kind === 'binary') return '📕'
  if (f.kind === 'text') return '📄'
  return '📦'
}

/* ── 加载知识库基本信息 ── */
async function loadKb() {
  try {
    kb.value = await getKb(kbId.value)
  } catch (e) {
    message.error(`知识库加载失败：${e.message}`)
  }
}

/* ── 目录树（懒加载）── */
function toTreeNodes(dirs) {
  return dirs.map((d) => ({ label: `${d.name} (${d.children})`, key: d.rel_path, isLeaf: false }))
}

async function loadNode(node) {
  const rel = node.key === '__root__' ? '' : String(node.key)
  try {
    const data = await listKbTree(kbId.value, { path: rel, showAll: showAll.value })
    return toTreeNodes(data.dirs || [])
  } catch (e) {
    message.error(`读取目录失败：${e.message}`)
    return []
  }
}

async function initTree() {
  try {
    const data = await listKbTree(kbId.value, { path: '', showAll: showAll.value })
    treeData.value = [
      {
        label: '根目录',
        key: '__root__',
        // 默认展开根节点，进页即可看到一级目录
        expanded: true,
        children: toTreeNodes(data.dirs || []),
      },
    ]
    dirInfo.value = data
  } catch (e) {
    message.error(`读取知识库目录失败：${e.message}`)
  }
}

/* ── 打开目录 ── */
async function openDir(rel) {
  currentPath.value = rel || ''
  file.value = null
  dirLoading.value = true
  try {
    dirInfo.value = await listKbTree(kbId.value, { path: currentPath.value, showAll: showAll.value })
  } catch (e) {
    message.error(`读取目录失败：${e.message}`)
  } finally {
    dirLoading.value = false
  }
  selectedKeys.value = [currentPath.value || '__root__']
  loadOverview()
}

/* ── 打开文件 ── */
async function openFile(rel) {
  try {
    file.value = await previewKbFile(kbId.value, rel)
    if (isMobile.value) mobilePreview.value = true
  } catch (e) {
    message.error(`预览失败：${e.message}`)
  }
}

function openRaw() {
  if (!file.value) return
  window.open(kbRawUrl(kbId.value, file.value.rel_path), '_blank')
}

/* ── 目录摘要 ── */
async function loadOverview() {
  overviewError.value = ''
  try {
    overview.value = await getKbOverview(kbId.value, currentPath.value, showAll.value)
  } catch (e) {
    overview.value = null
    overviewError.value = e.message
  }
}

async function generate(force) {
  genLoading.value = true
  overviewError.value = ''
  try {
    const r = await generateKbOverview(kbId.value, {
      path: currentPath.value,
      force,
      showAll: showAll.value,
    })
    overview.value = { ...(overview.value || {}), ...r, exists: true }
    message.success('摘要已生成')
  } catch (e) {
    overviewError.value = `生成失败：${e.message}`
  } finally {
    genLoading.value = false
  }
}

/* ── 交互 ── */
function onSelectKeys(keys) {
  const k = keys[0]
  if (k === undefined) return
  openDir(k === '__root__' ? '' : String(k))
}

async function copyPath() {
  try {
    await navigator.clipboard.writeText(kb.value?.root_path || '')
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

async function reloadAll() {
  file.value = null
  await Promise.all([loadKb(), initTree()])
  if (currentPath.value) await openDir(currentPath.value)
  else await loadOverview()
}

watch(
  () => route.params.id,
  async () => {
    currentPath.value = ''
    file.value = null
    overview.value = null
    await reloadAll()
  },
)

onMounted(async () => {
  await reloadAll()
  selectedKeys.value = ['__root__']
})
</script>

<style scoped>
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
.kb-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.kb-tree-wrap {
  max-height: 70vh;
  overflow: auto;
}
.kb-path-line {
  color: var(--kb-text-2);
  word-break: break-all;
}
.kb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.kb-row:hover {
  background: var(--kb-bg);
}
.kb-row-active {
  background: var(--kb-accent-soft);
}
.kb-row-icon {
  font-size: 15px;
}
.kb-row-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  color: var(--kb-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-l0 {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  background: var(--kb-accent-soft);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--kb-text);
  margin-bottom: 10px;
}
.kb-l0-tag {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--kb-accent);
  border-radius: 6px;
  padding: 1px 6px;
  margin-top: 2px;
}
</style>

<style>
/* 手机端：浏览页降为单列（n-grid-item 的 span 也要归零，否则会撑出横向滚动） */
@media (max-width: 768px) {
  .kb-browse-grid > * {
    grid-column: span 1 !important;
  }
  .kb-browse-grid .kb-tree-wrap {
    max-height: 42vh;
  }
}
</style>

<style>
/* L1 概览的 markdown 排版（非 scoped：v-html 内容需要全局作用） */
.kb-l1 {
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--kb-text);
}
.kb-l1 h2 {
  font-size: 14.5px;
  font-weight: 600;
  margin: 12px 0 6px;
  color: var(--kb-text);
}
.kb-l1 h3 {
  font-size: 13.5px;
  font-weight: 600;
  margin: 10px 0 4px;
}
.kb-l1 ul,
.kb-l1 ol {
  padding-left: 20px;
  margin: 6px 0;
}
.kb-l1 li {
  margin: 3px 0;
}
.kb-l1 code {
  font-family: var(--kb-mono);
  font-size: 12px;
  background: var(--kb-bg);
  border-radius: 4px;
  padding: 1px 5px;
}
.kb-l1 strong {
  font-weight: 600;
}
.kb-l1 p {
  margin: 6px 0;
}
</style>
