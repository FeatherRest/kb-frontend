<template>
  <n-card size="small" class="kb-result" :bordered="true">
    <div class="kb-result-head">
      <n-tag size="tiny" type="info" round>#{{ rank }}</n-tag>
      <span class="kb-result-title" :title="result.title">{{ result.title || '(无标题)' }}</span>
      <n-tag size="tiny" :type="scoreType" round>{{ score }}</n-tag>
    </div>

    <n-space :size="6" style="margin: 8px 0" align="center">
      <n-tag v-if="result.category" size="tiny" round :bordered="false">{{ result.category }}</n-tag>
      <n-tag size="tiny" round :bordered="false" :type="result.access_level === 'private' ? 'warning' : 'default'">
        {{ result.access_level || 'open' }}
      </n-tag>
      <n-tag v-if="result.chunk_type" size="tiny" round :bordered="false">{{ result.chunk_type }}</n-tag>
      <n-tag v-if="result.page" size="tiny" round :bordered="false">p.{{ result.page }}</n-tag>
      <n-tag v-if="result.search_source" size="tiny" round :bordered="false" type="success">
        {{ result.search_source }}
      </n-tag>
      <span v-if="result.section" class="kb-dim kb-ellipsis" :title="result.section">§{{ result.section }}</span>
    </n-space>

    <div class="kb-snippet" v-html="snippet"></div>

    <div class="kb-result-actions">
      <n-space :size="6">
        <n-button size="tiny" tertiary @click="$emit('detail', result)">详情</n-button>
        <n-button size="tiny" quaternary @click="copyDocId">复制 doc_id</n-button>
        <n-button
          size="tiny"
          quaternary
          :type="result.access_level === 'private' ? 'warning' : 'default'"
        >
          {{ result.source || '-' }}
        </n-button>
      </n-space>
    </div>
  </n-card>
</template>

<script setup>
import { computed } from 'vue'
import { useMessage } from 'naive-ui'

const props = defineProps({
  result: { type: Object, required: true },
  rank: { type: Number, default: 1 },
  query: { type: String, default: '' },
})
defineEmits(['detail'])

const message = useMessage()

const score = computed(() => {
  const s = props.result?.relevance_score
  return typeof s === 'number' ? s.toFixed(4) : '-'
})
const scoreType = computed(() => {
  const s = props.result?.relevance_score || 0
  if (s >= 0.7) return 'success'
  if (s >= 0.4) return 'info'
  return 'default'
})

const snippet = computed(() => {
  const text =
    props.result?.content ||
    props.result?.content_preview ||
    '(无内容预览)'
  return highlight(truncate(text, 600), props.query)
})

function truncate(text, max) {
  const t = String(text)
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 关键词高亮：先转义，再对查询词做 <mark> 包裹（大小写不敏感） */
function highlight(text, query) {
  const safe = escapeHtml(text)
  const terms = String(query || '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .map((t) => escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!terms.length) return safe
  const re = new RegExp(`(${terms.join('|')})`, 'gi')
  return safe.replace(re, '<mark class="kb-mark">$1</mark>')
}

async function copyDocId() {
  try {
    await navigator.clipboard.writeText(props.result?.doc_id || '')
    message.success('已复制 doc_id')
  } catch {
    message.error('复制失败（浏览器未授权剪贴板）')
  }
}
</script>

<style scoped>
.kb-result {
  background: #20203a;
  border: 1px solid #2a2a3e;
}
.kb-result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.kb-result-title {
  flex: 1;
  font-weight: 600;
  color: #e6e6f5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-snippet {
  color: #b9c3d6;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow: auto;
}
.kb-result-actions {
  margin-top: 10px;
}
.kb-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}
:deep(.kb-mark) {
  background: #ffe08a;
  color: #1a1a2e;
  border-radius: 3px;
  padding: 0 2px;
}
</style>
