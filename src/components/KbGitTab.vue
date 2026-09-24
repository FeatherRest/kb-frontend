<template>
  <n-card size="small" class="kb-card">
    <template #header>
      <div class="kb-card-head">
        <span>Git 变更</span>
        <n-tag v-if="st?.is_repo" size="tiny" round :bordered="false">
          {{ st.branch || 'main' }} · {{ st.commits ?? 0 }} 次提交
        </n-tag>
        <n-tag v-if="st?.dirty" size="tiny" round type="warning" :bordered="false">
          未提交 {{ st.dirty_count ?? 0 }}
        </n-tag>
        <n-tag v-else-if="st?.is_repo" size="tiny" round type="success" :bordered="false">工作区干净</n-tag>
      </div>
    </template>
    <template #header-extra>
      <n-space :size="6" align="center">
        <n-tag v-if="st?.pending" size="tiny" round :bordered="false" type="error">
          待提交队列 {{ st.pending }}
        </n-tag>
        <n-tag size="tiny" round :bordered="false">自动提交{{ st?.auto_commit ? '开' : '关' }}</n-tag>
        <n-button size="small" quaternary :loading="loading" @click="load">刷新</n-button>
      </n-space>
    </template>

    <n-alert v-if="st && !st.is_repo" type="warning" :show-icon="true">
      这个知识库还不是 git 仓库 —— 到「知识库配置」页初始化，之后每次入库都会自动提交。
    </n-alert>

    <template v-else>
      <div v-if="st?.last_commit?.hash" class="kb-dim" style="margin-bottom: 10px">
        最近提交：
        <span class="kb-mono">{{ st.last_commit.hash }}</span>
        · {{ st.last_commit.date }} · {{ st.last_commit.subject }}
      </div>

      <n-tabs v-model:value="group" type="segment" size="small">
        <n-tab-pane
          v-for="g in GROUPS"
          :key="g.key"
          :name="g.key"
          :tab="`${g.label} (${(st?.[g.key] || []).length})`"
        >
          <n-spin :show="loading">
            <div v-if="(st?.[g.key] || []).length" class="kb-git-list">
              <div v-for="p in st[g.key]" :key="p" class="kb-git-row">
                <n-tag size="tiny" round :bordered="false" :type="g.type">{{ g.badge }}</n-tag>
                <span class="kb-mono kb-git-path">{{ p }}</span>
                <n-button size="tiny" quaternary @click="copy(p)">复制路径</n-button>
              </div>
            </div>
            <n-empty v-else-if="!loading" :description="`没有${g.label}的文件`" style="margin: 18px 0" />
          </n-spin>
        </n-tab-pane>
      </n-tabs>

      <div class="kb-dim" style="margin-top: 10px">
        说明：未追踪 = 新文件尚未 add；已修改 = 已跟踪文件内容变了；已删除 = 已跟踪文件被移除。
        入库会自动提交，出现变更通常意味着有文件被手动增删（或上一次提交失败，可到知识库配置页点「补救提交」）。
      </div>
    </template>
  </n-card>
</template>

<script setup>
import { onActivated, onMounted, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { getKbGitStatus } from '../api/kbApi.js'

const props = defineProps({
  kbId: { type: String, required: true },
})
const emit = defineEmits(['update:count'])

const GROUPS = [
  { key: 'untracked', label: '未追踪', badge: '??', type: 'warning' },
  { key: 'modified', label: '已修改', badge: 'M', type: 'info' },
  { key: 'deleted', label: '已删除', badge: 'D', type: 'error' },
]

const message = useMessage()
const loading = ref(false)
const st = ref(null)
const group = ref('untracked')

async function load() {
  if (!props.kbId) return
  loading.value = true
  try {
    st.value = await getKbGitStatus(props.kbId)
    emit('update:count', Number(st.value?.dirty_count || 0))
  } catch (e) {
    message.error(`Git 状态加载失败：${e.message}`)
  } finally {
    loading.value = false
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text || '')
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

watch(() => props.kbId, load)
onMounted(load)
onActivated(load)
</script>

<style scoped>
.kb-git-list {
  max-height: 46vh;
  overflow: auto;
}
.kb-git-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 8px;
}
.kb-git-row:hover {
  background: var(--kb-bg);
}
.kb-git-path {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
