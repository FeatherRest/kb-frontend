<template>
  <div>
    <div class="kb-page-title">解析器</div>

    <n-space class="kb-toolbar" align="center" :size="10" style="margin-bottom: 14px" wrap>
      <n-input v-model:value="q" placeholder="按名称 / 引擎 / 扩展名过滤" style="width: 280px" clearable />
      <n-select v-model:value="category" :options="categoryOptions" style="width: 160px" />
      <n-button size="small" :loading="loading" @click="load">刷新</n-button>
      <span class="kb-dim">共 {{ parsers.length }} 个解析器 · {{ enabledCount }} 个启用</span>
    </n-space>

    <n-spin :show="loading">
      <n-grid :cols="2" :x-gap="12" :y-gap="12">
        <n-grid-item v-for="p in filtered" :key="p.parser">
          <n-card size="small" class="kb-parser-card" :class="{ 'kb-parser-off': !p.enabled }">
            <div class="kb-parser-head">
              <span class="kb-parser-name">{{ p.name || p.parser }}</span>
              <n-switch
                :value="p.enabled"
                size="small"
                :loading="toggling === p.parser"
                @update:value="(v) => toggle(p, v)"
              />
            </div>
            <div class="kb-dim" style="margin: 4px 0">{{ p.engine }}</div>
            <div class="kb-parser-note">{{ p.note }}</div>
            <n-space :size="4" style="margin-top: 8px" wrap>
              <n-tag v-for="ext in p.extensions || []" :key="ext" size="tiny" :bordered="false" round>
                {{ ext }}
              </n-tag>
            </n-space>
            <n-space :size="6" style="margin-top: 8px" align="center">
              <n-tag size="tiny" :type="p.active ? 'success' : 'default'" round>
                {{ p.active ? '可用' : '未就绪' }}
              </n-tag>
              <n-tag size="tiny" :bordered="false" round>{{ p.category || '-' }}</n-tag>
              <n-button size="tiny" quaternary @click="detail = p">详情</n-button>
            </n-space>
          </n-card>
        </n-grid-item>
      </n-grid>
      <n-empty v-if="!loading && !filtered.length" description="无匹配解析器" style="margin-top: 40px" />
    </n-spin>

    <n-modal v-model:show="detailShow" preset="card" :title="detail?.name || detail?.parser" style="width: 820px">
      <n-descriptions :column="1" bordered size="small" label-placement="left">
        <n-descriptions-item label="标识">{{ detail?.parser }}</n-descriptions-item>
        <n-descriptions-item label="引擎">{{ detail?.engine }}</n-descriptions-item>
        <n-descriptions-item label="分类">{{ detail?.category }}</n-descriptions-item>
        <n-descriptions-item label="状态">
          {{ detail?.enabled ? '已启用' : '已禁用' }} / {{ detail?.active ? '可用' : '未就绪' }}
        </n-descriptions-item>
        <n-descriptions-item label="扩展名">
          {{ (detail?.extensions || []).join('  ') || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="说明">{{ detail?.note || '-' }}</n-descriptions-item>
      </n-descriptions>

      <n-divider style="margin: 14px 0 10px">解析流程</n-divider>
      <div v-if="detail && !PARSER_WORKFLOWS[detail.name]" class="kb-dim" style="margin-bottom: 8px">
        该解析器暂无专属流程图，以下为通用流程
      </div>
      <WorkflowDiagram :stages="detailStages" :active-parser="detail?.parser" />
    </n-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'
import WorkflowDiagram from '../components/WorkflowDiagram.vue'
import { PARSER_WORKFLOWS, workflowFor } from '../data/parserWorkflows.js'
import { getParsers, toggleParser } from '../api/kbApi.js'

const message = useMessage()

const parsers = ref([])
const loading = ref(false)
const toggling = ref('')
const q = ref('')
const category = ref('')
const detail = ref(null)

const detailShow = computed({
  get: () => Boolean(detail.value),
  set: (v) => {
    if (!v) detail.value = null
  },
})

const categoryOptions = computed(() => {
  const set = new Set(parsers.value.map((p) => p.category).filter(Boolean))
  return [{ label: '全部分类', value: '' }, ...[...set].sort().map((c) => ({ label: c, value: c }))]
})

const enabledCount = computed(() => parsers.value.filter((p) => p.enabled).length)

/** 详情弹窗里的流程图（按解析器显示名取，未命中回退通用流程） */
const detailStages = computed(() => workflowFor(detail.value?.name))

const filtered = computed(() => {
  const kw = q.value.trim().toLowerCase()
  return parsers.value.filter((p) => {
    if (category.value && p.category !== category.value) return false
    if (!kw) return true
    return (
      String(p.name || '').toLowerCase().includes(kw) ||
      String(p.parser || '').toLowerCase().includes(kw) ||
      String(p.engine || '').toLowerCase().includes(kw) ||
      (p.extensions || []).some((e) => e.toLowerCase().includes(kw))
    )
  })
})

async function load() {
  loading.value = true
  try {
    const data = await getParsers()
    parsers.value = data.parsers || []
  } catch (e) {
    message.error(`加载失败：${e.message}`)
  } finally {
    loading.value = false
  }
}

async function toggle(parser, enabled) {
  toggling.value = parser.parser
  try {
    await toggleParser(parser.parser, enabled)
    parser.enabled = enabled
    message.success(`${parser.name || parser.parser} 已${enabled ? '启用' : '禁用'}`)
  } catch (e) {
    message.error(e.message)
  } finally {
    toggling.value = ''
  }
}

onMounted(load)
</script>

<style scoped>
.kb-parser-card {
  background: #ffffff;
  border: 1px solid #e8e8ed;
}
.kb-parser-off {
  opacity: 0.6;
}
.kb-parser-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.kb-parser-name {
  font-weight: 600;
  color: #1d1d1f;
}
.kb-parser-note {
  font-size: 12px;
  color: #6e6e73;
  line-height: 1.6;
}
</style>
