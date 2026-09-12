<template>
  <div>
    <div class="kb-page-title">待处理</div>

    <n-space align="center" :size="10" style="margin-bottom: 14px" wrap>
      <n-input
        v-model:value="q"
        placeholder="按相对路径过滤"
        style="width: 320px"
        clearable
        @keyup.enter="reload"
      />
      <n-select v-model:value="perPage" :options="PER_PAGE" style="width: 120px" @update:value="reload" />
      <n-button size="small" @click="reload">刷新</n-button>
      <span class="kb-dim">共 {{ total }} 个文件 · 第 {{ page }}/{{ totalPages }} 页</span>
    </n-space>

    <n-spin :show="loading">
      <n-data-table
        :columns="columns"
        :data="files"
        :bordered="true"
        size="small"
        :row-key="(r) => r['相对路径']"
        :max-height="560"
        virtual-scroll
      />
    </n-spin>

    <n-space justify="center" align="center" :size="12" style="margin-top: 14px">
      <n-button size="small" :disabled="page <= 1" @click="go(-1)">上一页</n-button>
      <n-button size="small" :disabled="page >= totalPages" @click="go(1)">下一页</n-button>
    </n-space>
  </div>
</template>

<script setup>
import { h, onMounted, ref } from 'vue'
import { NButton, NTag, useMessage } from 'naive-ui'
import { getPendingFiles } from '../api/kbApi.js'

const message = useMessage()

const PER_PAGE = [20, 50, 100, 200].map((v) => ({ label: `${v} / 页`, value: v }))

const q = ref('')
const perPage = ref(50)
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)
const files = ref([])
const loading = ref(false)

const columns = [
  { title: '相对路径', key: '相对路径', ellipsis: { tooltip: true }, minWidth: 260 },
  {
    title: '大小',
    key: '大小(bytes)',
    width: 100,
    render: (row) => formatSize(row['大小(bytes)']),
  },
  { title: '修改时间', key: '修改时间', width: 160 },
  {
    title: '扩展名',
    key: '扩展名',
    width: 90,
    render: (row) => h(NTag, { size: 'tiny', bordered: false }, { default: () => row['扩展名'] || '-' }),
  },
  {
    title: '已索引',
    key: '已索引',
    width: 90,
    render: (row) =>
      h(
        NTag,
        { size: 'tiny', type: row['已索引'] === 'yes' ? 'success' : 'default', round: true },
        { default: () => row['已索引'] || 'no' },
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 190,
    render: (row) =>
      h('div', { style: 'display:flex;gap:6px' }, [
        h(
          NButton,
          { size: 'tiny', tertiary: true, onClick: () => copy(row['绝对路径']) },
          { default: () => '复制绝对路径' },
        ),
        h(
          NButton,
          { size: 'tiny', quaternary: true, onClick: () => copy(row['相对路径']) },
          { default: () => '复制相对路径' },
        ),
      ]),
  },
]

async function reload() {
  loading.value = true
  try {
    const data = await getPendingFiles({ page: page.value, per_page: perPage.value, q: q.value.trim() })
    files.value = data.files || []
    total.value = data.total || 0
    totalPages.value = data.total_pages || 1
    if (data.error) message.warning(data.error)
  } catch (e) {
    message.error(`加载失败：${e.message}`)
  } finally {
    loading.value = false
  }
}

function go(delta) {
  page.value = Math.max(1, Math.min(totalPages.value, page.value + delta))
  reload()
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text || '')
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

function formatSize(bytes) {
  const b = Number(bytes) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

onMounted(reload)
</script>
