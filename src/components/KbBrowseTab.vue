<template>
  <div>
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
          <n-button v-if="overview?.exists" size="tiny" quaternary :loading="genLoading" @click="generate(true)">
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
          <div v-for="d in dirInfo?.dirs || []" :key="d.rel_path" class="kb-row" @click="openDir(d.rel_path)">
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
            <n-tag v-if="f.indexed" size="tiny" round type="success" :bordered="false">已入库</n-tag>
            <n-tag v-else-if="f.doc_id" size="tiny" round :bordered="false">已删索引</n-tag>
            <span class="kb-dim">{{ formatSize(f.size) }}</span>
            <n-button
              size="tiny"
              quaternary
              type="error"
              class="kb-row-del"
              title="删除这个文件"
              @click.stop="askDelete({ relPath: f.rel_path, name: f.name, docId: f.doc_id || '' })"
            >删除</n-button>
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

    <!-- 已入库文档（该库的检索单元；删除入口在这里最直观） -->
    <n-card size="small" class="kb-card" style="margin-top: 14px">
      <template #header>
        <div class="kb-card-head">
          <span>已入库文档</span>
          <n-tag size="tiny" round :bordered="false">{{ docTotal }} 篇</n-tag>
        </div>
      </template>
      <template #header-extra>
        <n-space :size="6" align="center">
          <n-input
            v-model:value="docQuery"
            size="tiny"
            placeholder="按标题/来源筛选"
            style="width: 150px"
            @keyup.enter="loadDocs"
          />
          <n-switch v-model:value="docIncludeDeleted" size="small" @update:value="loadDocs" />
          <span class="kb-dim">含已删/未索引</span>
          <n-button size="tiny" quaternary @click="loadDocs">刷新</n-button>
        </n-space>
      </template>
      <n-spin :show="docLoading">
        <n-table v-if="(docs || []).length" :bordered="false" size="small">
          <thead>
            <tr>
              <th>标题 / 来源文件</th>
              <th style="width: 92px">解析器</th>
              <th style="width: 62px">分块</th>
              <th style="width: 92px">状态</th>
              <th style="width: 150px">入库时间</th>
              <th style="width: 64px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in docs" :key="d.doc_id">
              <td>
                <div class="kb-doc-title">{{ d.title || '(无标题)' }}</div>
                <div class="kb-dim kb-mono">{{ d.original_filename || d.source }}</div>
              </td>
              <td class="kb-dim">{{ d.parser }}</td>
              <td class="kb-dim">{{ d.chunk_count }}</td>
              <td>
                <n-tag size="tiny" round :type="d.index_status === 'indexed' ? 'success' : 'warning'" :bordered="false">
                  {{ statusText(d.index_status) }}
                </n-tag>
              </td>
              <td class="kb-dim">{{ d.indexed_at }}</td>
              <td>
                <n-button
                  size="tiny"
                  quaternary
                  type="error"
                  :title="d.index_status === 'indexed' ? '删除（索引 + 原件 + 解析产物）' : '清理磁盘残留文件'"
                  @click="askDelete({
                    docId: d.doc_id,
                    name: (d.original_filename || d.title || d.doc_id),
                  })"
                >{{ d.index_status === 'indexed' ? '删除' : '清理' }}</n-button>
              </td>
            </tr>
          </tbody>
        </n-table>
        <n-empty v-else-if="!docLoading" description="该知识库还没有入库文档" style="margin: 18px 0" />
      </n-spin>
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
          <n-button size="tiny" quaternary @click="openRaw()">新窗口打开</n-button>
          <n-popconfirm @positive-click="deleteFile()">
            <template #trigger>
              <n-button size="tiny" type="error" tertiary>删除</n-button>
            </template>
            确认删除「{{ file.name }}」？(软删除 + 清除向量)
          </n-popconfirm>
          <n-button size="tiny" quaternary @click="file = null">关闭</n-button>
        </n-space>
      </template>
      <FilePreview :file="file" :kb-id="kbId" />
    </n-card>

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
            <n-button size="small" quaternary @click="openRaw()">新窗口打开</n-button>
            <n-button size="small" quaternary @click="mobilePreview = false">关闭</n-button>
          </n-space>
        </template>
        <FilePreview :file="file" :kb-id="kbId" />
      </n-drawer-content>
    </n-drawer>

    <DeleteFileModal v-model:show="delShow" :kb-id="kbId" :target="delTarget" @done="afterDelete" />
  </div>
</template>

<script setup>
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import MarkdownIt from 'markdown-it'
import {
  generateKbOverview,
  getKbOverview,
  kbRawUrl,
  listKbDocuments,
  listKbTree,
  previewKbFile,
} from '../api/kbApi.js'
import { useIsMobile } from '../composables/useIsMobile.js'
import FilePreview from './FilePreview.vue'
import DeleteFileModal from './DeleteFileModal.vue'

const props = defineProps({
  kbId: { type: String, required: true },
  showAll: { type: Boolean, default: false },
})
const emit = defineEmits(['changed'])

const message = useMessage()
const { isMobile } = useIsMobile()
const md = new MarkdownIt({ html: false, linkify: true, breaks: false })

const currentPath = ref('')
const dirInfo = ref(null)
const dirLoading = ref(false)
const file = ref(null)
const mobilePreview = ref(false)
const overview = ref(null)
const overviewError = ref('')
const genLoading = ref(false)

const docs = ref([])
const docTotal = ref(0)
const docQuery = ref('')
/** 显示「已删索引但磁盘文件还在」的遗留项 —— 否则删过的文件再也看不见、删不掉 */
const docIncludeDeleted = ref(false)
const docLoading = ref(false)

const delShow = ref(false)
const delTarget = ref({ name: '', docId: '', relPath: '' })

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

function statusText(s) {
  const map = { indexed: '已索引', pending: '待处理', deleted: '已删除', superseded: '已被新版替代', failed: '失败' }
  return map[s] || s || '未知'
}

async function openDir(rel) {
  currentPath.value = rel || ''
  file.value = null
  dirLoading.value = true
  try {
    dirInfo.value = await listKbTree(props.kbId, { path: currentPath.value, showAll: props.showAll })
  } catch (e) {
    message.error(`读取目录失败：${e.message}`)
  } finally {
    dirLoading.value = false
  }
  loadOverview()
}

async function openFile(rel) {
  try {
    file.value = await previewKbFile(props.kbId, rel)
    if (isMobile.value) mobilePreview.value = true
  } catch (e) {
    message.error(`预览失败：${e.message}`)
  }
}

function openRaw() {
  if (!file.value) return
  window.open(kbRawUrl(props.kbId, file.value.rel_path), '_blank')
}

function deleteFile() {
  if (!file.value) return
  askDelete({ relPath: file.value.rel_path, docId: file.value.doc_id || '', name: file.value.name })
}

async function loadDocs() {
  docLoading.value = true
  try {
    const data = await listKbDocuments(props.kbId, {
      per_page: 100,
      q: docQuery.value,
      includeDeleted: docIncludeDeleted.value,
    })
    docs.value = data?.documents || []
    docTotal.value = data?.total ?? docs.value.length
  } catch (e) {
    message.error(`文档列表加载失败：${e.message}`)
  } finally {
    docLoading.value = false
  }
}

async function loadOverview() {
  overviewError.value = ''
  try {
    overview.value = await getKbOverview(props.kbId, currentPath.value, props.showAll)
  } catch (e) {
    overview.value = null
    overviewError.value = e.message
  }
}

async function generate(force) {
  genLoading.value = true
  overviewError.value = ''
  try {
    const r = await generateKbOverview(props.kbId, {
      path: currentPath.value,
      force,
      showAll: props.showAll,
    })
    overview.value = { ...(overview.value || {}), ...r, exists: true }
    message.success('摘要已生成')
  } catch (e) {
    overviewError.value = `生成失败：${e.message}`
  } finally {
    genLoading.value = false
  }
}

function askDelete({ relPath = '', docId = '', name = '' }) {
  delTarget.value = { relPath, docId, name: name || relPath || docId }
  delShow.value = true
}

async function afterDelete() {
  file.value = null
  await Promise.all([loadDocs(), openDir(currentPath.value)])
  emit('changed')
}

/** 供父级「刷新」调用：重拉当前目录 + 文档列表 */
async function reload() {
  await Promise.all([openDir(currentPath.value), loadDocs()])
}

watch(() => props.showAll, () => openDir(currentPath.value))
watch(() => props.kbId, () => {
  currentPath.value = ''
  file.value = null
  overview.value = null
  reload()
})
onMounted(reload)
onActivated(reload)

defineExpose({ reload })
</script>
