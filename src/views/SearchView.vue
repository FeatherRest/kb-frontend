<template>
  <div>
    <div class="kb-page-title">搜索</div>

    <n-space :size="10" align="center" style="margin-bottom: 12px">
      <n-input
        v-model:value="query"
        style="width: 460px"
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

    <n-space :size="8" align="center" style="margin-bottom: 14px" wrap>
      <n-radio-group v-model:value="mode" size="small" @update:value="onModeChange">
        <n-radio-button value="hybrid">混合</n-radio-button>
        <n-radio-button value="dense">向量</n-radio-button>
        <n-radio-button value="sparse">关键词</n-radio-button>
      </n-radio-group>

      <n-divider vertical />

      <n-select v-model:value="scope" :options="SCOPE_OPTIONS" size="small" style="width: 130px" />
      <n-select
        v-model:value="category"
        :options="categoryOptions"
        size="small"
        style="width: 170px"
        filterable
        tag
      />

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
        {{ store.searchResults.length }} 条结果 · {{ MODE_LABEL[store.searchMode] }}
      </div>
      <n-space vertical :size="10">
        <ResultCard
          v-for="(r, i) in store.searchResults"
          :key="r.doc_id + '-' + i"
          :result="r"
          :rank="i + 1"
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
import { computed, onMounted, ref } from 'vue'
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
const scope = ref('')
const category = ref('')
const detailShow = ref(false)
const detailDocId = ref('')
const stats = ref(null)
const categoryOptions = ref([])

const TOPK_OPTIONS = [5, 8, 10, 15, 20, 30].map((v) => ({ label: String(v), value: v }))
const SCOPE_OPTIONS = [
  { label: '全部权限', value: '' },
  { label: 'open', value: 'open' },
  { label: 'private', value: 'private' },
]
const MODE_LABEL = { hybrid: '混合检索', dense: '向量检索', sparse: '关键词检索' }

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
  await store.search({ q: text, mode: mode.value, top_k: topK.value, rerank: null })
}

async function doRerank() {
  await store.search({ q: store.searchQuery, mode: mode.value, top_k: topK.value, rerank: true })
}

function onModeChange() {
  if (store.searchQuery) doSearch()
}

function openDetail(docId) {
  detailDocId.value = docId
  detailShow.value = true
}

onMounted(async () => {
  try {
    stats.value = await getStats()
    const docs = await listDocuments({ per_page: 200, page: 1 })
    const set = new Set()
    for (const d of docs.documents || []) if (d.category) set.add(d.category)
    categoryOptions.value = [
      { label: '全部分类', value: '' },
      ...[...set].sort().map((c) => ({ label: c, value: c })),
    ]
  } catch {
    /* 统计/分类加载失败不阻塞搜索 */
  }
})
</script>
