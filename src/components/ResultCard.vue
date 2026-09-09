<template>
  <n-card :title="result.title || '无标题'" style="margin-bottom:12px;" hoverable>
    <template #header-extra>
      <n-tag :type="result.access_level==='open'?'success':'warning'" size="tiny">
        {{ result.access_level }}
      </n-tag>
    </template>
    <div v-if="result.snippet" style="color:#c0c8d8;font-size:14px;line-height:1.7;white-space:pre-wrap;"
         v-html="highlightSnippet(result.snippet)"></div>
    <div v-if="result.score !== undefined" style="margin-top:8px;font-size:12px;color:#666;">
      相关度: {{ (result.score * 100).toFixed(1) }}%
    </div>
    <template #footer>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#666;">
        <span v-if="result.source">📄 {{ result.source }}</span>
        <n-button size="tiny" quaternary @click="expanded = !expanded">
          {{ expanded ? '收起' : '展开全文' }}
        </n-button>
      </div>
      <div v-if="expanded && result.content" style="margin-top:8px;padding:12px;background:#16162a;border-radius:8px;font-size:13px;color:#b0b8d0;line-height:1.6;white-space:pre-wrap;">
        {{ result.content }}
      </div>
    </template>
  </n-card>
</template>

<script setup>
import { ref } from 'vue'
import { useKbStore } from '../stores/kbStore'

const props = defineProps({ result: Object })
const expanded = ref(false)
const store = useKbStore()

function highlightSnippet(text) {
  if (!text) return ''
  const q = store.searchQuery || ''
  if (!q) return text
  const parts = q.split(/\s+/).filter(Boolean)
  let result = text
  parts.forEach(part => {
    result = result.replace(new RegExp(`(${part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
      '<span style="background:#ffcc0044;color:#ffcc00;padding:0 2px;border-radius:2px;">$1</span>')
  })
  return result
}
</script>
