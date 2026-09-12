<template>
  <n-card size="small" class="kb-stat" :bordered="true">
    <div class="kb-stat-value">{{ display }}</div>
    <div class="kb-stat-label">{{ label }}</div>
  </n-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [Number, String], default: 0 },
  suffix: { type: String, default: '' },
})

const display = computed(() => {
  const v = props.value
  const n = typeof v === 'number' ? v.toLocaleString('zh-CN') : v
  return `${n}${props.suffix}`
})
</script>

<style scoped>
.kb-stat {
  background: #ffffff;
  border: 1px solid #e8e8ed;
  min-width: 120px;
}
.kb-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #0071e3;
  line-height: 1.3;
}
.kb-stat-label {
  font-size: 12px;
  color: #6e6e73;
  margin-top: 2px;
}
</style>
