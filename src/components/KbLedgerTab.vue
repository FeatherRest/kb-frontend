<template>
  <n-card size="small" class="kb-card">
    <template #header>
      <div class="kb-card-head">
        <span>投递文件台账</span>
        <n-space :size="6" align="center">
          <n-tag
            v-for="(label, s) in (ledger?.labels || {})"
            :key="s"
            size="tiny"
            round
            :bordered="false"
            :type="statusFilter.includes(s) ? statusType(s) : 'default'"
            style="cursor: pointer"
            @click="toggleStatus(s)"
          >
            {{ label }} {{ ledger?.counts?.[s] || 0 }}
          </n-tag>
        </n-space>
      </div>
    </template>
    <template #header-extra>
      <n-space :size="8" align="center">
        <n-input
          v-model:value="q"
          size="small"
          placeholder="搜索文件名/标题/来源"
          style="width: 190px"
          clearable
          @keyup.enter="apply"
        />
        <n-select v-model:value="sort" size="small" style="width: 116px" :options="sortOptions"
                  @update:value="apply" />
        <n-button size="small" quaternary @click="toggleOrder">
          {{ order === 'desc' ? '↓ 降序' : '↑ 升序' }}
        </n-button>
        <n-checkbox v-model:checked="inclDeleted" size="small" @update:checked="apply">
          含已删除
        </n-checkbox>
        <n-button size="small" tertiary :loading="loading" @click="apply">刷新</n-button>
      </n-space>
    </template>

    <n-spin :show="loading">
      <n-table v-if="ledger?.rows?.length" size="small" :single-line="false" striped>
        <thead>
          <tr>
            <th>文件 / 标题</th>
            <th style="width: 104px">状态</th>
            <th style="width: 76px">解析器</th>
            <th style="width: 56px">块数</th>
            <th style="width: 78px">大小</th>
            <th style="width: 140px">投递/更新</th>
            <th style="width: 118px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in ledger.rows" :key="r.doc_id || r.job_id || r.name">
            <td>
              <div class="kb-ledger-name">{{ r.display_name || r.name }}</div>
              <div class="kb-dim kb-ledger-sub">
                {{ r.rel_path || r.name }}<span v-if="r.error"> · ⚠️ {{ String(r.error).slice(0, 60) }}</span>
              </div>
            </td>
            <td>
              <n-tag size="tiny" round :bordered="false" :type="statusType(r.status)">
                {{ ledger.labels[r.status] || r.status }}
              </n-tag>
            </td>
            <td class="kb-dim">{{ r.parser || '—' }}</td>
            <td>{{ r.chunks || '—' }}</td>
            <td class="kb-dim">{{ fmtBytes(r.bytes) }}</td>
            <td class="kb-dim">{{ (r.updated_at || r.created_at || r.indexed_at || '').slice(0, 16) }}</td>
            <td>
              <n-space :size="4">
                <n-button v-if="r.doc_id" size="tiny" quaternary @click="openDoc(r)">详情</n-button>
                <n-button
                  size="tiny"
                  quaternary
                  type="error"
                  :disabled="!r.doc_id && !r.rel_path"
                  :title="deleteTitle(r)"
                  @click="askDelete(r)"
                >删除</n-button>
              </n-space>
            </td>
          </tr>
        </tbody>
      </n-table>
      <n-empty v-else-if="!loading" description="没有匹配的文件" style="margin: 18px 0" />
    </n-spin>

    <div class="kb-ledger-foot">
      <n-pagination
        v-model:page="page"
        :page-count="ledger?.pages || 1"
        size="small"
        :page-slot="6"
        @update:page="load"
      />
      <span class="kb-dim">共 {{ ledger?.total || 0 }} 条</span>
    </div>

    <DeleteFileModal
      v-model:show="delShow"
      :kb-id="kbId"
      :target="delTarget"
      @done="afterDelete"
    />
  </n-card>
</template>

<script setup>
import { onActivated, onMounted, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { getKbFiles, kbRawUrl } from '../api/kbApi.js'
import DeleteFileModal from './DeleteFileModal.vue'

const props = defineProps({
  kbId: { type: String, required: true },
})
const emit = defineEmits(['update:count', 'changed'])

const message = useMessage()

const ledger = ref(null)
const loading = ref(false)
const q = ref('')
const statusFilter = ref([])
const sort = ref('updated')
const order = ref('desc')
const inclDeleted = ref(false)
const page = ref(1)
const perPage = ref(50)

const delShow = ref(false)
const delTarget = ref({ name: '', docId: '', relPath: '' })

const sortOptions = [
  { label: '更新时间', value: 'updated' },
  { label: '投递时间', value: 'created' },
  { label: '文件名', value: 'name' },
  { label: '大小', value: 'size' },
  { label: '块数', value: 'chunks' },
  { label: '状态', value: 'status' },
  { label: '解析器', value: 'parser' },
]

function fmtBytes(n) {
  const x = Number(n || 0)
  if (!x) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = x
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1 }
  return `${i === 0 ? v : v.toFixed(1)}${units[i]}`
}

function statusType(st) {
  return {
    indexed: 'success',
    not_indexed: 'warning',
    pending: 'default',
    parsing: 'info',
    superseded: 'default',
    failed: 'error',
    deleted: 'default',
  }[st] || 'default'
}

function toggleStatus(s) {
  const i = statusFilter.value.indexOf(s)
  if (i >= 0) statusFilter.value.splice(i, 1)
  else statusFilter.value.push(s)
  apply()
}

function toggleOrder() {
  order.value = order.value === 'desc' ? 'asc' : 'desc'
  apply()
}

function apply() {
  page.value = 1
  load()
}

async function load() {
  if (!props.kbId) return
  loading.value = true
  try {
    ledger.value = await getKbFiles(props.kbId, {
      q: q.value,
      status: statusFilter.value.join(','),
      sort: sort.value,
      order: order.value,
      page: page.value,
      perPage: perPage.value,
      includeDeleted: inclDeleted.value,
    })
    emit('update:count', Number(ledger.value?.total || 0))
  } catch (e) {
    message.error(`台账加载失败：${e?.message || e}`)
  } finally {
    loading.value = false
  }
}

function openDoc(r) {
  if (r.html_path) {
    window.open(kbRawUrl(props.kbId, r.html_path), '_blank')
    return
  }
  navigator.clipboard?.writeText(r.doc_id)
  message.info(`已复制 doc_id：${r.doc_id}`)
}

function deleteTitle(r) {
  if (r.doc_id) return '删除这份文档（索引 + 原件 + 解析产物）'
  if (r.rel_path) return `删除磁盘文件：${r.rel_path}`
  return '没有可删除的对象'
}

function askDelete(r) {
  delTarget.value = {
    docId: r.doc_id || '',
    relPath: r.doc_id ? '' : (r.rel_path || ''),
    name: r.display_name || r.name,
  }
  delShow.value = true
}

async function afterDelete() {
  await load()
  emit('changed')
}

watch(() => props.kbId, () => { page.value = 1; load() })
onMounted(load)
onActivated(load)
</script>
