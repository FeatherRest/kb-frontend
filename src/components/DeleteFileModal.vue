<template>
  <n-modal
    :show="show"
    preset="card"
    title="删除确认"
    style="width: 640px; max-width: 94vw"
    @update:show="(v) => emit('update:show', v)"
  >
    <n-alert type="warning" :show-icon="true" style="margin-bottom: 12px">
      删除会同时处理这份文档的<b>索引</b>、<b>原件</b>与<b>解析产物</b>，避免出现
      「索引删了、文件还在」的半死状态。
    </n-alert>
    <div style="margin-bottom: 10px">
      <div class="kb-dim">对象</div>
      <div class="kb-doc-title">{{ target.name || target.relPath || target.docId }}</div>
      <div v-if="plan?.doc_id" class="kb-dim kb-mono">doc_id: {{ plan.doc_id }}</div>
    </div>
    <div style="margin-bottom: 14px">
      <div class="kb-dim">将一起处理的文件（{{ (plan?.planned || []).length }}）</div>
      <div v-for="p in plan?.planned || []" :key="p" class="kb-mono kb-del-file">· {{ p }}</div>
      <div v-if="!planLoading && !(plan?.planned || []).length" class="kb-dim">（没有找到关联文件）</div>
    </div>
    <n-radio-group v-model:value="mode">
      <n-space vertical :size="8">
        <n-radio value="trash">移入回收站（默认）：清索引 + 文件移到 &lt;库&gt;/trash/，可在「回收站」标签页恢复</n-radio>
        <n-radio value="soft">仅移出检索：磁盘文件都不动（可重新导入）</n-radio>
        <n-radio value="hard">彻底删除：索引记录 + 文件直接删掉，<b>不可恢复</b></n-radio>
      </n-space>
    </n-radio-group>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:show', false)">取消</n-button>
        <n-button type="error" :loading="deleting" @click="doDelete">确认删除</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { deleteKbFile, deleteKbFileDocId } from '../api/kbApi.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  kbId: { type: String, required: true },
  /** { relPath, docId, name } —— 有 relPath 按文件删，只有 docId 按文档删 */
  target: { type: Object, default: () => ({ relPath: '', docId: '', name: '' }) },
})
const emit = defineEmits(['update:show', 'done'])

const message = useMessage()
const mode = ref('trash')
const plan = ref(null)
const planLoading = ref(false)
const deleting = ref(false)

function callDelete(m, dryRun) {
  return props.target.relPath
    ? deleteKbFile(props.kbId, props.target.relPath, { mode: m, dryRun })
    : deleteKbFileDocId(props.kbId, props.target.docId, { mode: m, dryRun })
}

async function loadPlan() {
  mode.value = 'trash'
  plan.value = null
  planLoading.value = true
  try {
    // dry-run：先让用户看清「这一删会动哪些文件」
    plan.value = await callDelete('trash', true)
  } catch (e) {
    message.error(`读取删除计划失败：${e.message}`)
  } finally {
    planLoading.value = false
  }
}

async function doDelete() {
  deleting.value = true
  try {
    const payload = await callDelete(mode.value, false)
    const n = (payload?.files || []).filter((x) => x.action !== 'missing').length
    const nm = props.target.name || props.target.relPath || props.target.docId
    message.success(
      payload?.mode === 'soft'
        ? `已移出检索：「${nm}」（磁盘文件保留）`
        : `已删除「${nm}」，处理 ${n} 个文件`,
    )
    emit('update:show', false)
    emit('done', payload)
  } catch (e) {
    message.error(`删除失败：${e.message}`)
  } finally {
    deleting.value = false
  }
}

watch(
  () => props.show,
  (v) => {
    if (v) loadPlan()
  },
)
</script>
