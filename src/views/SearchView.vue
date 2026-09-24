<template>
  <div>
    <div class="kb-page-title">搜索</div>

    <n-space class="kb-toolbar" :size="10" align="center" style="margin-bottom: 12px">
      <!-- 🔴 作用域必须显式选（用户 2026-09-23：不允许"一下全查"） -->
      <!-- 概念图档（pages/both）在数据源迁移期隐藏；lacuna 已退役，等 LLM Wiki 接入后
           把 CONCEPT_DOMAIN_READY 置 true 即恢复（契约本身未变，见 SearchView 脚本区）。 -->
      <n-radio-group v-model:value="searchTarget" size="small" @update:value="onTargetChange">
        <n-radio-button value="kb">只查知识库</n-radio-button>
        <n-radio-button v-if="CONCEPT_DOMAIN_READY" value="pages">只查概念图</n-radio-button>
        <n-radio-button v-if="CONCEPT_DOMAIN_READY" value="both">两者都要</n-radio-button>
      </n-radio-group>
      <n-select
        v-if="searchTarget !== 'pages'"
        :value="store.currentKbId"
        :options="kbOptions"
        size="small"
        style="width: 160px"
        @update:value="onKbChange"
      />
      <n-input
        v-model:value="query"
        class="kb-search-input"
        style="width: 420px"
        placeholder="输入自然语言问题 / 关键词，回车检索"
        clearable
        @keyup.enter="doSearch()"
      >
        <template #prefix>
          <n-icon :component="SearchOutline" />
        </template>
      </n-input>
      <n-button type="primary" :loading="store.loading" @click="doSearch()">搜索</n-button>
      <n-select v-model:value="topK" :options="TOPK_OPTIONS" style="width: 110px" size="medium" />
    </n-space>

    <n-space class="kb-toolbar" :size="8" align="center" style="margin-bottom: 14px" wrap>
      <n-radio-group v-model:value="mode" size="small" @update:value="onModeChange">
        <n-radio-button value="hybrid">混合</n-radio-button>
        <n-radio-button value="dense">向量</n-radio-button>
        <n-radio-button value="sparse">关键词</n-radio-button>
      </n-radio-group>

      <n-divider vertical />

      <n-button
        size="small"
        type="info"
        :loading="store.rerankLoading"
        :disabled="!store.searchQuery"
        @click="doRerank"
      >
        🔀 重排
      </n-button>
      <n-tag v-if="store.reranked" size="small" type="success" round>✨ 已重排</n-tag>

      <n-radio-group
        v-if="store.canCompare"
        size="small"
        :value="store.viewMode"
        @update:value="store.setView"
      >
        <n-radio-button value="raw">原始排序</n-radio-button>
        <n-radio-button value="reranked">重排后</n-radio-button>
      </n-radio-group>

      <span v-if="timingText" class="kb-dim">{{ timingText }}</span>
    </n-space>

    <n-space v-if="store.searchHistory.length" :size="6" style="margin-bottom: 14px" align="center" wrap>
      <span class="kb-dim">历史</span>
      <n-tag
        v-for="h in store.searchHistory.slice(0, 10)"
        :key="h"
        size="small"
        round
        checkable
        @update:checked="() => doSearch(h)"
      >
        {{ h }}
      </n-tag>
      <n-button size="tiny" quaternary @click="store.clearHistory()">清空</n-button>
    </n-space>

    <n-grid v-if="statsCards.length" :cols="4" :x-gap="12" :y-gap="12" style="margin-bottom: 16px">
      <n-grid-item v-for="c in statsCards" :key="c.label">
        <StatsCard :label="c.label" :value="c.value" :suffix="c.suffix" />
      </n-grid-item>
    </n-grid>

    <n-alert v-if="store.error" type="error" style="margin-bottom: 12px" closable @close="store.error = ''">
      {{ store.error }}
    </n-alert>

    <n-spin :show="store.loading">
      <div v-if="store.searchResults.length" class="kb-dim" style="margin-bottom: 8px">
        {{ store.searchResults.length }} 条结果 · {{ MODE_LABEL[store.searchMode] }} ·
        {{ store.viewMode === 'reranked' ? '重排后排序' : '原始排序' }}
        <span v-if="movedCount"> · 其中 {{ movedCount }} 条排名发生变化</span>
      </div>
      <n-space vertical :size="10">
        <ResultCard
          v-for="(r, i) in store.searchResults"
          :key="r.doc_id + '-' + i"
          :result="r"
          :rank="i + 1"
          :rank-delta="rankDelta(r)"
          :query="store.searchQuery"
          @detail="openDetail(r.doc_id)"
        />
      </n-space>
      <n-empty
        v-if="!store.loading && !store.searchResults.length"
        description="输入关键词开始检索（支持混合 / 向量 / 关键词三种模式）"
        style="margin-top: 40px"
      />
    </n-spin>

    <DocDetailDrawer v-model:show="detailShow" :doc-id="detailDocId" @changed="doSearch()" />
  </div>
</template>

<script setup>
import { computed, onActivated, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { SearchOutline } from '@vicons/ionicons5'
import StatsCard from '../components/StatsCard.vue'
import ResultCard from '../components/ResultCard.vue'
import DocDetailDrawer from '../components/DocDetailDrawer.vue'
import { useKbStore } from '../stores/kbStore.js'
import { getStats, listDocuments } from '../api/kbApi.js'

const store = useKbStore()
const message = useMessage()

const query = ref('')
const mode = ref('hybrid')
const topK = ref(8)
const detailShow = ref(false)
const detailDocId = ref('')
const stats = ref(null)

const TOPK_OPTIONS = [5, 8, 10, 15, 20, 30].map((v) => ({ label: String(v), value: v }))
// 「分类 / 权限」筛选器已移除（2026-09-22）：分类是 default 库的「专区」概念，不该全库通用；
// 权限级别全库都是 open，且 Dashboard 侧没有按身份裁剪的需求。要按专区检索请去「专区」页。
const MODE_LABEL = { hybrid: '混合检索', dense: '向量检索', sparse: '关键词检索' }

// 🔴 检索目标域：kb（只知识库）/ pages（只概念图）/ both；本页默认 kb（KB 搜索页的本职）。
// 概念图档在数据源迁移期关闭：lacuna 已于 2026-09-24 退役，新数据源 LLM Wiki 未接入 ——
// 此时 kb-api 会对 pages/both 回 503（不静默返回空）。接入完成后置 true 即恢复。
const CONCEPT_DOMAIN_READY = false
const searchTarget = ref('kb')
const TARGET_LABEL = { kb: '只查知识库', pages: '只查概念图', both: '两者都查' }

const kbOptions = computed(() => {
  const opts = (store.kbList || []).map((kb) => ({
    label: kb.name || kb.kb_id,
    value: kb.kb_id,
  }))
  // 「全部库」是一项**显式选择**（协议里写作 kb_id="all"）；缺省不再等于全查
  opts.unshift({ label: '全部库（显式）', value: 'all' })
  if (!opts.some((o) => o.value === store.currentKbId)) {
    opts.unshift({ label: store.currentKbId, value: store.currentKbId })
  }
  return opts
})

function onKbChange(kbId) {
  store.setCurrentKb(kbId)
  if (store.searchQuery) doSearch()
}

/** 切换作用域后自动重查（作用域变了，结果必须跟着变） */
function onTargetChange() {
  if (store.searchQuery) doSearch()
}

const statsCards = computed(() => {
  if (!stats.value) return []
  return [
    { label: '文档', value: stats.value.documents ?? 0 },
    { label: '分块', value: stats.value.chunks ?? 0 },
    { label: '向量点', value: stats.value.qdrant_points ?? 0 },
    { label: '嵌入模型', value: stats.value.model || '-' },
  ]
})

const timingText = computed(() => {
  const t = store.timing
  if (!t) return ''
  const ms = t.elapsed_ms ?? t.total_ms
  const parts = []
  if (ms !== undefined) parts.push(`${ms} ms`)
  if (t.rerank_ms !== undefined) parts.push(`重排 ${t.rerank_ms} ms`)
  return parts.join(' · ')
})

async function doSearch(q) {
  const text = typeof q === 'string' ? q : query.value
  if (!text || !text.trim()) {
    message.warning('请输入检索内容')
    return
  }
  query.value = text
  await store.search({
    q: text,
    target: searchTarget.value,
    mode: mode.value,
    top_k: topK.value,
    rerank: null,
    kb_id: searchTarget.value === 'pages' ? '' : store.currentKbId,
  })
}

async function doRerank() {
  await store.search({
    q: store.searchQuery,
    target: searchTarget.value,
    mode: mode.value,
    top_k: topK.value,
    rerank: true,
    kb_id: searchTarget.value === 'pages' ? '' : store.currentKbId,
  })
}

function onModeChange() {
  if (store.searchQuery) doSearch()
}

function openDetail(docId) {
  detailDocId.value = docId
  detailShow.value = true
}

/** 重排后每条结果的排名变化（正数=上升，null=新出现） */
function rankDelta(result) {
  if (store.viewMode !== 'reranked' || !store.canCompare) return 0
  const oldIdx = store.rawResults.findIndex((x) => x.doc_id === result.doc_id)
  if (oldIdx < 0) return null
  const newIdx = store.rerankedResults.findIndex((x) => x.doc_id === result.doc_id)
  if (newIdx < 0) return 0
  return oldIdx - newIdx
}

/** 排名发生变化的条数（用于结果头提示） */
const movedCount = computed(() => {
  if (store.viewMode !== 'reranked' || !store.canCompare) return 0
  return store.rerankedResults.filter((r) => {
    const d = rankDelta(r)
    return d !== 0
  }).length
})

// onActivated：keep-alive 缓存下每次回到搜索页都刷新统计/知识库列表
// （不重跑用户的搜索本身，只刷新筛选器的可选值）
onActivated(async () => {
  try {
    stats.value = await getStats()
  } catch {
    /* 统计加载失败不阻塞搜索 */
  }
  try {
    await store.loadKbList()
  } catch {
    /* 知识库列表加载失败不阻塞搜索 */
  }
})
</script>
