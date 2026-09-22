<template>
  <div>
    <div class="kb-page-title">专区</div>

    <!-- 工具栏：两条分支各用一个 n-space（避免 v-if/v-else 片段在 n-space 插槽内被复用不替换） -->
    <n-space v-if="zone !== 'errors'" class="kb-toolbar" align="center" :size="10" style="margin-bottom: 14px" wrap>
      <n-select v-model:value="zone" :options="ZONE_OPTIONS" style="width: 190px" @update:value="onZoneChange" />
      <n-input
        v-model:value="q"
        placeholder="按标题/来源过滤"
        style="width: 260px"
        clearable
        @keyup.enter="loadLibrary"
      />
      <n-select v-model:value="orderBy" :options="ORDER_OPTIONS" style="width: 150px" @update:value="loadLibrary" />
      <n-select v-model:value="learned" :options="LEARNED_OPTIONS" style="width: 140px" @update:value="loadLibrary" />
      <n-button size="small" @click="loadLibrary">刷新</n-button>
    </n-space>

    <n-space v-else class="kb-toolbar" align="center" :size="10" style="margin-bottom: 14px" wrap>
      <n-select v-model:value="zone" :options="ZONE_OPTIONS" style="width: 190px" @update:value="onZoneChange" />
      <n-input v-model:value="q" placeholder="按标题/摘要过滤" style="width: 260px" clearable />
      <n-select v-model:value="errSort" :options="ERR_SORT_OPTIONS" style="width: 170px" />
      <n-select v-model:value="errLearned" :options="ERR_LEARNED_OPTIONS" style="width: 150px" />
      <n-button size="small" @click="loadErrors">刷新</n-button>
      <span class="kb-dim">
        {{ filteredErrors.length }} / {{ errors.length }} 条 ·
        {{ errors.filter((r) => !r.read).length }} 条未学习
      </span>
    </n-space>

    <!-- ── 文档库 / 待学习 / 新闻 / GitHub 周报 ── -->
    <template v-if="zone !== 'errors'">
      <n-spin :show="loading">
        <n-space vertical :size="10">
          <n-card
            v-for="d in docs"
            :key="d.doc_id"
            size="small"
            class="kb-doc-card"
            hoverable
            @click="openDetail(d.doc_id)"
          >
            <div class="kb-doc-head">
              <n-tag size="tiny" :type="d.learned_at ? 'success' : 'default'" round>
                {{ d.learned_at ? '已学习' : '未学习' }}
              </n-tag>
              <span class="kb-doc-title" :title="d.title">{{ d.title || d.doc_id }}</span>
              <span class="kb-dim">{{ d.indexed_at }}</span>
            </div>
            <n-space :size="6" style="margin-top: 6px" align="center" wrap>
              <n-tag v-if="d.category" size="tiny" :bordered="false" round>{{ d.category }}</n-tag>
              <n-tag size="tiny" :bordered="false" round>{{ d.parser }}</n-tag>
              <n-tag size="tiny" :bordered="false" round>{{ d.chunk_count }} 分块</n-tag>
              <n-tag size="tiny" :bordered="false" round>{{ formatSize(d.file_size) }}</n-tag>
              <n-button
                size="tiny"
                quaternary
                :type="d.learned_at ? 'success' : 'default'"
                @click.stop="toggleDocLearned(d)"
              >
                {{ d.learned_at ? '✓ 已学习' : '标记已学习' }}
              </n-button>
            </n-space>
          </n-card>
        </n-space>
        <n-empty v-if="!loading && !docs.length" description="暂无文档" style="margin-top: 40px" />
      </n-spin>

      <n-space justify="center" align="center" :size="12" style="margin-top: 16px">
        <n-button size="small" :disabled="page <= 1" @click="go(-1)">上一页</n-button>
        <span class="kb-dim">{{ page }} / {{ totalPages }}（共 {{ total }} 篇）</span>
        <n-button size="small" :disabled="page >= totalPages" @click="go(1)">下一页</n-button>
      </n-space>
    </template>

    <!-- ── 错误报告 ── -->
    <template v-else>
      <n-spin :show="loading">
        <n-space vertical :size="8">
          <n-card
            v-for="r in filteredErrors"
            :key="r.id"
            size="small"
            class="kb-doc-card"
            :class="{ 'kb-err-unread': !r.read, 'kb-err-missing': r.exists === false }"
          >
            <div class="kb-doc-head">
              <n-tag size="tiny" :type="severityType(r.severity)" round>{{ r.severity }}</n-tag>
              <span class="kb-doc-title" :title="r.title">{{ r.title }}</span>
              <span class="kb-dim">{{ r.date }}</span>
            </div>
            <div class="kb-dim" style="margin-top: 4px">{{ r.summary || r.component }}</div>
            <n-space :size="8" style="margin-top: 8px" align="center">
              <n-button size="tiny" tertiary @click="openErr(r)">详解</n-button>
              <n-button size="tiny" quaternary :type="r.read ? 'success' : 'primary'" @click="toggleRead(r)">
                {{ r.read ? '✓ 已学习' : '标记已学习' }}
              </n-button>
              <n-tag v-if="r.flagged" size="tiny" type="warning" round>已标记</n-tag>
              <span class="kb-dim">{{ r.comment_count || 0 }} 条评论</span>
            </n-space>
          </n-card>
        </n-space>
        <n-empty v-if="!loading && !filteredErrors.length" description="暂无错误报告" style="margin-top: 40px" />
      </n-spin>
    </template>

    <DocDetailDrawer v-model:show="detailShow" :doc-id="detailDocId" @changed="loadLibrary" />

    <n-modal
      v-model:show="errShow"
      preset="card"
      :title="errDetail?.title || '错误报告'"
      style="width: 80vw"
      :content-style="{ padding: '0 16px 16px' }"
    >
      <n-space vertical :size="10">
        <n-space :size="8" align="center">
          <n-tag size="small" :type="severityType(errDetail?.severity)">{{ errDetail?.severity }}</n-tag>
          <span class="kb-dim">{{ errDetail?.date }} · {{ errDetail?.component }}</span>
          <n-button size="tiny" quaternary @click="openErrHtml">新窗口打开</n-button>
        </n-space>
        <div class="kb-dim">{{ errDetail?.summary }}</div>
        <iframe
          v-if="errHtml"
          :srcdoc="errHtml"
          style="width: 100%; height: 62vh; border: 1px solid #e8e8ed; border-radius: 8px; background: #fff"
        ></iframe>

        <n-divider style="margin: 6px 0">评论</n-divider>
        <div v-for="c in errDetail?.comments || []" :key="c.id" class="kb-comment">
          <span class="kb-dim">{{ c.author }} · {{ c.created_at }}</span>
          <div>{{ c.content }}</div>
        </div>
        <n-input v-model:value="errComment" type="textarea" :rows="2" placeholder="追加评论…" />
        <n-button size="small" type="primary" :disabled="!errComment.trim()" @click="postErrComment">
          提交评论
        </n-button>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, onActivated, ref } from 'vue'
import { useMessage } from 'naive-ui'
import DocDetailDrawer from '../components/DocDetailDrawer.vue'
import {
  addErrorComment,
  getErrorReport,
  listDocuments,
  listErrorReports,
  setErrorRead,
  setLearned,
} from '../api/kbApi.js'

const message = useMessage()

const ZONE_OPTIONS = [
  { label: '📚 待学习', value: 'tolearn' },
  { label: '🗂 文档库', value: 'library' },
  { label: '📰 新闻事件', value: 'news' },
  { label: '🚀 GitHub 周报', value: 'github' },
  { label: '🐞 错误报告', value: 'errors' },
]
const ORDER_OPTIONS = [
  { label: '最新优先', value: 'ingested_at_desc' },
  { label: '最早优先', value: 'ingested_at_asc' },
  { label: '标题', value: 'title_asc' },
  { label: '更新时间', value: 'updated_at_desc' },
]
const LEARNED_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '已学习', value: '1' },
  { label: '未学习', value: '0' },
]
const ERR_SORT_OPTIONS = [
  { label: '日期 ↓', value: 'date_desc' },
  { label: '日期 ↑', value: 'date_asc' },
  { label: '级别 ↓', value: 'severity_desc' },
  { label: '未学习优先', value: 'unread' },
]
/** 错误报告的「已学习」三态过滤（read 标记即学习状态，与 Dashboard 一致） */
const ERR_LEARNED_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '仅未学习', value: 'unlearned' },
  { label: '仅已学习', value: 'learned' },
]
const CATEGORY_OF = {
  tolearn: '待学习',
  library: '',
  news: '新闻事件',
  github: 'GitHub 周报',
}
const SEVERITY_TYPE = { high: 'error', critical: 'error', medium: 'warning', low: 'default' }

const zone = ref('tolearn')
const q = ref('')
const orderBy = ref('ingested_at_desc')
const learned = ref('')
const loading = ref(false)

const docs = ref([])
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)

const errors = ref([])
const errSort = ref('date_desc')
const errLearned = ref('')
const errShow = ref(false)
const errDetail = ref(null)
const errHtml = ref('')
const errComment = ref('')

const detailShow = ref(false)
const detailDocId = ref('')

const filteredErrors = computed(() => {
  const kw = q.value.trim().toLowerCase()
  let list = errors.value.filter((r) => {
    if (errLearned.value === 'unlearned' && r.read) return false
    if (errLearned.value === 'learned' && !r.read) return false
    return (
      !kw ||
      String(r.title || '').toLowerCase().includes(kw) ||
      String(r.summary || '').toLowerCase().includes(kw)
    )
  })
  const order = { high: 3, critical: 3, medium: 2, low: 1 }
  if (errSort.value === 'date_desc') list = [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  if (errSort.value === 'date_asc') list = [...list].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (errSort.value === 'severity_desc')
    list = [...list].sort((a, b) => (order[b.severity] || 0) - (order[a.severity] || 0))
  if (errSort.value === 'unread') list = [...list].sort((a, b) => Number(a.read) - Number(b.read))
  return list
})

async function loadLibrary() {
  loading.value = true
  try {
    const data = await listDocuments({
      category: CATEGORY_OF[zone.value] ?? '',
      q: q.value.trim(),
      learned: learned.value,
      page: page.value,
      per_page: 20,
      order_by: orderBy.value,
    })
    docs.value = data.documents || []
    total.value = data.total ?? docs.value.length
    totalPages.value = data.total_pages ?? 1
  } catch (e) {
    message.error(`加载失败：${e.message}`)
  } finally {
    loading.value = false
  }
}

function go(delta) {
  page.value = Math.max(1, Math.min(totalPages.value, page.value + delta))
  loadLibrary()
}

function onZoneChange() {
  page.value = 1
  q.value = ''
  if (zone.value === 'errors') loadErrors()
  else loadLibrary()
}

async function loadErrors() {
  loading.value = true
  try {
    const data = await listErrorReports()
    errors.value = data.reports || []
  } catch (e) {
    message.error(`错误报告加载失败：${e.message}`)
  } finally {
    loading.value = false
  }
}

function severityType(s) {
  return SEVERITY_TYPE[String(s || 'medium').toLowerCase()] || 'default'
}

async function openErr(r) {
  errDetail.value = null
  errHtml.value = ''
  errShow.value = true
  try {
    const detail = await getErrorReport(r.id)
    errDetail.value = detail
    const htmlPath = detail?.html_path
    if (htmlPath) {
      const res = await fetch(`/kb/api/errors/${encodeURIComponent(r.id)}/html`)
      if (res.ok) errHtml.value = await res.text()
    }
  } catch (e) {
    message.error(`报告加载失败：${e.message}`)
  }
}

function openErrHtml() {
  if (errDetail.value?.id) window.open(`/kb/api/errors/${encodeURIComponent(errDetail.value.id)}/html`, '_blank')
}

async function toggleRead(r) {
  try {
    await setErrorRead(r.id, !r.read)
    r.read = !r.read
  } catch (e) {
    message.error(e.message)
  }
}

async function postErrComment() {
  if (!errDetail.value?.id || !errComment.value.trim()) return
  try {
    await addErrorComment(errDetail.value.id, errComment.value.trim())
    errComment.value = ''
    const detail = await getErrorReport(errDetail.value.id)
    errDetail.value = detail
    await loadErrors()
    message.success('评论已提交')
  } catch (e) {
    message.error(e.message)
  }
}

function openDetail(docId) {
  detailDocId.value = docId
  detailShow.value = true
  // 与 Dashboard 一致：打开详情即视为已学习（异步、不阻塞抽屉渲染）
  autoMarkLearned(docId)
}

/** 点开文档即标记已学习（仅当当前未标记；失败静默，不打断阅读） */
async function autoMarkLearned(docId) {
  const doc = docs.value.find((d) => d.doc_id === docId)
  if (!doc || doc.learned_at) return
  try {
    await setLearned(docId, true)
    doc.learned_at = new Date().toISOString()
  } catch {
    /* 静默：自动标记失败不影响阅读 */
  }
}

/** 列表内快捷标记 / 取消已学习 */
async function toggleDocLearned(doc) {
  const next = !doc.learned_at
  try {
    await setLearned(doc.doc_id, next)
    doc.learned_at = next ? new Date().toISOString() : ''
    message.success(next ? '已标记学习' : '已取消学习')
  } catch (e) {
    message.error(e.message)
  }
}

function formatSize(bytes) {
  const b = Number(bytes) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

// onActivated：keep-alive 缓存下每次回到本页都重新拉专区数据
onActivated(loadLibrary)
</script>

<style scoped>
.kb-doc-card {
  background: #ffffff;
  border: 1px solid #e8e8ed;
  cursor: pointer;
}
.kb-doc-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.kb-doc-title {
  flex: 1;
  color: #1d1d1f;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-err-unread {
  border-left: 3px solid #0071e3;
}
.kb-err-missing {
  opacity: 0.55;
}
.kb-comment {
  background: #ffffff;
  border-radius: 6px;
  padding: 8px 10px;
  color: #3a3a3c;
  font-size: 13px;
}
</style>
