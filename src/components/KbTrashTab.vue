<template>
  <n-card size="small" class="kb-card">
    <template #header>
      <div class="kb-card-head">
        <span>回收站</span>
        <n-tag size="tiny" round :bordered="false">{{ stats?.entries ?? 0 }} 个删除批次</n-tag>
        <n-tag size="tiny" round :bordered="false">{{ fmtBytes(stats?.bytes) }}</n-tag>
        <n-tag v-if="stats?.expired_entries" size="tiny" round type="warning" :bordered="false">
          过期 {{ stats.expired_entries }}
        </n-tag>
      </div>
    </template>
    <template #header-extra>
      <n-space :size="6" align="center">
        <n-tag size="tiny" round :bordered="false">
          保留 {{ stats?.retention_days ?? 30 }} 天 · 自动清理{{ stats?.auto_purge ? '开' : '关' }}
        </n-tag>
        <n-button size="small" quaternary :loading="loading" @click="load">刷新</n-button>
        <n-popconfirm @positive-click="purgeExpired">
          <template #trigger>
            <n-button size="small" tertiary :disabled="!stats?.expired_entries">清理过期</n-button>
          </template>
          清理超过 {{ stats?.retention_days ?? 30 }} 天的 {{ stats?.expired_entries || 0 }} 个批次？
        </n-popconfirm>
        <n-popconfirm @positive-click="purgeAll">
          <template #trigger>
            <n-button size="small" tertiary type="error" :disabled="!stats?.entries">清空回收站</n-button>
          </template>
          清空全部 {{ stats?.entries || 0 }} 个批次（{{ fmtBytes(stats?.bytes) }}），不可恢复？
        </n-popconfirm>
      </n-space>
    </template>

    <n-alert v-if="stats?.unparsable?.length" type="info" :show-icon="true" style="margin-bottom: 10px">
      有 {{ stats.unparsable.length }} 个条目名字无法解析（不是本系统生成的），不会被自动清理：
      <span class="kb-mono">{{ stats.unparsable.join('、') }}</span>
    </n-alert>

    <n-spin :show="loading">
      <n-table v-if="items.length" size="small" :bordered="false">
        <thead>
          <tr>
            <th>删除时间</th>
            <th>条目</th>
            <th>删除的对象</th>
            <th style="width: 70px">文件</th>
            <th style="width: 84px">占用</th>
            <th style="width: 78px">状态</th>
            <th style="width: 132px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in items" :key="it.name">
            <td class="kb-dim">{{ (it.timestamp || '').replace('T', ' ').slice(0, 19) || it.name }}</td>
            <td class="kb-mono kb-ledger-sub">{{ it.name }}</td>
            <td>
              <div class="kb-ledger-name">{{ it.requested_path || '（无删除清单）' }}</div>
              <div v-if="it.doc_id" class="kb-dim kb-mono kb-ledger-sub">{{ it.doc_id }}</div>
            </td>
            <td class="kb-dim">{{ it.files }}</td>
            <td class="kb-dim">{{ fmtBytes(it.bytes) }}</td>
            <td>
              <n-tag size="tiny" round :bordered="false" :type="statusType(it)">
                {{ statusText(it) }}
              </n-tag>
            </td>
            <td>
              <n-space :size="4">
                <n-button
                  size="tiny"
                  tertiary
                  :disabled="!it.has_manifest"
                  :title="it.has_manifest ? '把文件还原回原相对路径' : '没有删除清单，无法自动还原'"
                  @click="askRestore(it)"
                >恢复</n-button>
                <n-button size="tiny" quaternary type="error" @click="askDelete(it)">删除</n-button>
              </n-space>
            </td>
          </tr>
        </tbody>
      </n-table>
      <n-empty v-else-if="!loading" description="回收站是空的" style="margin: 18px 0" />
    </n-spin>

    <!-- 恢复确认（先 dry-run 列出会还原哪些文件） -->
    <n-modal v-model:show="restoreShow" preset="card" title="恢复回收站条目" style="width: 660px; max-width: 94vw">
      <n-alert type="info" :show-icon="true" style="margin-bottom: 12px">
        文件会按删除时的相对路径放回库根原位；<b>索引不会自动恢复</b>
        —— 还原后请重新导入这份文件，才能重新被检索到。
      </n-alert>
      <div style="margin-bottom: 12px">
        <div class="kb-dim">条目</div>
        <div class="kb-doc-title">{{ restoreTarget?.name }}</div>
      </div>
      <n-spin :show="planLoading">
        <div v-if="plan">
          <div class="kb-dim">将还原（{{ (plan.restored || []).length }}）</div>
          <div v-for="p in plan.restored || []" :key="p" class="kb-mono kb-del-file">· {{ p }}</div>
          <div v-if="(plan.skipped || []).length" class="kb-dim" style="margin-top: 8px">
            跳过（{{ plan.skipped.length }}）
          </div>
          <div v-for="s in plan.skipped || []" :key="s.path" class="kb-mono kb-del-file">
            · {{ s.path }} —— {{ s.reason }}
          </div>
        </div>
      </n-spin>
      <template #footer>
        <n-space justify="end" align="center">
          <n-checkbox v-model:checked="overwrite" size="small">覆盖已存在的目标文件</n-checkbox>
          <n-button @click="restoreShow = false">取消</n-button>
          <n-button type="primary" :loading="acting" :disabled="!(plan?.restored || []).length"
                    @click="doRestore">确认恢复</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 单条删除确认 -->
    <n-modal v-model:show="deleteShow" preset="card" title="删除回收站条目" style="width: 560px; max-width: 94vw">
      <n-alert type="warning" :show-icon="true" style="margin-bottom: 12px">
        这是<b>彻底删除</b>，删掉后无法再恢复。
      </n-alert>
      <div class="kb-dim">条目</div>
      <div class="kb-doc-title">{{ deleteTarget?.name }}</div>
      <div v-if="deletePlan" class="kb-dim" style="margin-top: 8px">
        将删除 {{ deletePlan.files }} 个文件，释放 {{ fmtBytes(deletePlan.bytes) }}
      </div>
      <template #footer>
        <n-space justify="end">
          <n-button @click="deleteShow = false">取消</n-button>
          <n-button type="error" :loading="acting" @click="doDelete">确认删除</n-button>
        </n-space>
      </template>
    </n-modal>
  </n-card>
</template>

<script setup>
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import {
  deleteKbTrashEntry,
  getKbTrash,
  purgeKbTrash,
  restoreKbTrashEntry,
} from '../api/kbApi.js'

const props = defineProps({
  kbId: { type: String, required: true },
})
const emit = defineEmits(['update:count'])

const message = useMessage()
const loading = ref(false)
const acting = ref(false)
const stats = ref(null)

const restoreShow = ref(false)
const restoreTarget = ref(null)
const plan = ref(null)
const planLoading = ref(false)
const overwrite = ref(false)

const deleteShow = ref(false)
const deleteTarget = ref(null)
const deletePlan = ref(null)

const items = computed(() => stats.value?.items || [])
const count = computed(() => items.value.length)

function fmtBytes(n) {
  const x = Number(n || 0)
  if (!x) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = x
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1 }
  return `${i === 0 ? v : v.toFixed(1)}${units[i]}`
}

function statusType(it) {
  if (!it.parsable) return 'default'
  const age = Number(it.age_days ?? 0)
  if (age >= (stats.value?.retention_days ?? 30)) return 'error'
  return 'success'
}

function statusText(it) {
  if (!it.parsable) return '不可解析'
  const age = Number(it.age_days ?? 0)
  if (age >= (stats.value?.retention_days ?? 30)) return '已过期'
  return `${age} 天`
}

async function load() {
  if (!props.kbId) return
  loading.value = true
  try {
    stats.value = await getKbTrash(props.kbId)
    emit('update:count', count.value)
  } catch (e) {
    message.error(`回收站加载失败：${e.message}`)
  } finally {
    loading.value = false
  }
}

async function purgeExpired() {
  acting.value = true
  try {
    const r = await purgeKbTrash(props.kbId, { confirm: true })
    message.success(`已清理 ${r.removed_count} 个过期批次，释放 ${fmtBytes(r.freed_bytes)}`)
    await load()
  } catch (e) {
    message.error(`清理失败：${e.message}`)
  } finally {
    acting.value = false
  }
}

async function purgeAll() {
  acting.value = true
  try {
    const r = await purgeKbTrash(props.kbId, { days: 0, confirm: true })
    message.success(`已清空 ${r.removed_count} 个批次，释放 ${fmtBytes(r.freed_bytes)}`)
    await load()
  } catch (e) {
    message.error(`清空失败：${e.message}`)
  } finally {
    acting.value = false
  }
}

async function askRestore(it) {
  restoreTarget.value = it
  plan.value = null
  overwrite.value = false
  restoreShow.value = true
  planLoading.value = true
  try {
    plan.value = await restoreKbTrashEntry(props.kbId, it.name, { dryRun: true })
  } catch (e) {
    message.error(`读取恢复计划失败：${e.message}`)
  } finally {
    planLoading.value = false
  }
}

async function doRestore() {
  acting.value = true
  try {
    const r = await restoreKbTrashEntry(props.kbId, restoreTarget.value.name, {
      dryRun: false,
      overwrite: overwrite.value,
    })
    message.success(
      `已还原 ${(r.restored || []).length} 个文件` +
      (r.skipped?.length ? `，跳过 ${r.skipped.length} 个` : '') +
      '（索引需重新导入才会恢复检索）',
    )
    restoreShow.value = false
    await load()
  } catch (e) {
    message.error(`恢复失败：${e.message}`)
  } finally {
    acting.value = false
  }
}

async function askDelete(it) {
  deleteTarget.value = it
  deletePlan.value = null
  deleteShow.value = true
  try {
    deletePlan.value = await deleteKbTrashEntry(props.kbId, it.name, { confirm: false })
  } catch (e) {
    message.error(`读取删除计划失败：${e.message}`)
  }
}

async function doDelete() {
  acting.value = true
  try {
    const r = await deleteKbTrashEntry(props.kbId, deleteTarget.value.name, { confirm: true })
    message.success(`已删除条目 ${r.name}，释放 ${fmtBytes(r.bytes)}`)
    deleteShow.value = false
    await load()
  } catch (e) {
    message.error(`删除失败：${e.message}`)
  } finally {
    acting.value = false
  }
}

watch(() => props.kbId, load)
onMounted(load)
onActivated(load)
</script>
