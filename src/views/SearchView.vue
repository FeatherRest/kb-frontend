<template>
  <div style="max-width:800px;margin:0 auto;">
    <n-input
      v-model:value="query"
      size="large"
      placeholder="搜索知识库..."
      clearable
      :loading="store.loading"
      @keyup.enter="doSearch"
    >
      <template #prefix>
        <n-icon><svg viewBox="0 0 24 24" width="20"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></n-icon>
      </template>
      <template #suffix>
        <n-button type="primary" size="small" @click="doSearch">搜索</n-button>
      </template>
    </n-input>

    <!-- 搜索历史 -->
    <n-collapse v-if="store.searchHistory.length && !store.searchResults.length" style="margin-top:16px;">
      <n-collapse-item title="搜索历史" name="history">
        <n-tag v-for="h in store.searchHistory" :key="h" style="margin:4px;cursor:pointer;" @click="query=h;doSearch()">
          {{ h }}
        </n-tag>
      </n-collapse-item>
    </n-collapse>

    <!-- 结果 -->
    <div style="margin-top:20px;">
      <n-empty v-if="!store.loading && store.searchQuery && !store.searchResults.length" description="未找到相关内容" />
      <ResultCard v-for="(r, i) in store.searchResults" :key="i" :result="r" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useKbStore } from '../stores/kbStore'
import ResultCard from '../components/ResultCard.vue'

const store = useKbStore()
const query = ref('')

function doSearch() {
  if (query.value.trim()) store.search(query.value.trim())
}
</script>
