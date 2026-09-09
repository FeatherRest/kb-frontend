<template>
  <div>
    <n-h2>📊 统计概览</n-h2>
    <StatsCard :stats="store.stats" />

    <n-h2 style="margin-top:32px;">📚 文档列表</n-h2>

    <n-data-table
      :columns="columns"
      :data="store.documents"
      :loading="store.loading"
      :single-line="false"
      :bordered="false"
      size="small"
      style="margin-top:12px;"
    />

    <n-h2 style="margin-top:32px;">🔍 最近搜索</n-h2>
    <n-timeline v-if="store.stats?.recent_searches?.length">
      <n-timeline-item v-for="s in store.stats.recent_searches" :key="s.timestamp" :time="s.timestamp">
        {{ s.query }} ({{ s.total_results }} 结果, {{ s.elapsed_ms }}ms)
      </n-timeline-item>
    </n-timeline>
    <n-empty v-else description="暂无搜索记录" />
  </div>
</template>

<script setup>
import { onMounted, h } from 'vue'
import { useKbStore } from '../stores/kbStore'
import { NButton, NTag } from 'naive-ui'
import StatsCard from '../components/StatsCard.vue'

const store = useKbStore()

const columns = [
  { title: '文档ID', key: 'doc_id', ellipsis: { tooltip: true } },
  { title: '标题', key: 'title', ellipsis: { tooltip: true } },
  { title: '来源', key: 'source', ellipsis: true },
  { title: '权限', key: 'access_level', render: (r) => h(NTag, { type: r.access_level === 'open' ? 'success' : 'warning', size: 'tiny' }, { default: () => r.access_level }) },
  { title: 'Chunks', key: 'chunk_count', width: 80 },
  { title: '索引时间', key: 'indexed_at', width: 160 },
]

onMounted(() => {
  store.loadDocuments()
  store.loadStats()
})
</script>
