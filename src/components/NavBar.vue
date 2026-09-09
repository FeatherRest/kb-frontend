<template>
  <n-layout-header style="height:64px;background:#1a1a2e;border-bottom:1px solid #2a2a3e;display:flex;align-items:center;padding:0 24px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="font-size:20px;font-weight:700;color:#66ccff;">📚 知识库</span>
    </div>
    <n-space style="margin-left:32px;">
      <n-button :type="route.name==='Search'?'primary':'default'" @click="$router.push('/search')" tertiary>
        <template #icon><n-icon><svg viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg></n-icon></template>
        搜索
      </n-button>
      <n-button :type="route.name==='Ingest'?'primary':'default'" @click="$router.push('/ingest')" tertiary>
        <template #icon><n-icon><svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></n-icon></template>
        录入
      </n-button>
      <n-button :type="route.name==='Admin'?'primary':'default'" @click="$router.push('/admin')" tertiary>
        <template #icon><n-icon><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg></n-icon></template>
        管理
      </n-button>
    </n-space>
    <div style="flex:1;"></div>
    <n-tag v-if="health?.status === 'ok'" type="success" size="small">系统正常</n-tag>
    <n-tag v-else type="error" size="small">离线</n-tag>
  </n-layout-header>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useKbStore } from '../stores/kbStore'
import { onMounted, computed } from 'vue'

const route = useRoute()
const store = useKbStore()
const health = computed(() => store.health)

onMounted(() => store.checkHealth())
</script>
