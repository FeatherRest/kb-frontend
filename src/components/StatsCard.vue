<template>
  <n-grid :cols="3" x-gap="16">
    <n-gi>
      <n-card style="text-align:center;">
        <n-statistic :value="stats?.documents ?? stats?.total_documents ?? 0" title="文档总数">
          <template #prefix>📄</template>
        </n-statistic>
      </n-card>
    </n-gi>
    <n-gi>
      <n-card style="text-align:center;">
        <n-statistic :value="stats?.chunks ?? stats?.total_chunks ?? 0" title="文本块数">
          <template #prefix>🧩</template>
        </n-statistic>
      </n-card>
    </n-gi>
    <n-gi>
      <n-card style="text-align:center;">
        <n-statistic :value="stats?.searches ?? stats?.total_searches ?? 0" title="搜索次数">
          <template #prefix>🔍</template>
        </n-statistic>
      </n-card>
    </n-gi>
  </n-grid>
</template>

<script setup>
defineProps({ stats: Object })
</script>
