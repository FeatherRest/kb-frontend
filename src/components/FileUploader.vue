<template>
  <div>
    <!-- 知识库选择器：决定文件投递到哪个库（缺省 default） -->
    <n-space v-if="withKbSelect" align="center" :size="8" style="margin-bottom: 10px" wrap>
      <span class="kb-dim">投递到知识库：</span>
      <n-select
        v-model:value="selectedKb"
        size="small"
        :options="kbOptions"
        :loading="kbLoading"
        style="width: 220px"
      />
      <n-tag v-if="selectedKbPath" size="tiny" round :bordered="false" :title="selectedKbPath">
        📁 {{ selectedKbPath }}
      </n-tag>
      <n-button size="tiny" quaternary @click="loadKbs">刷新列表</n-button>
    </n-space>

    <n-upload
      :custom-request="customRequest"
      :show-file-list="false"
      :disabled="uploading"
      multiple
    >
      <n-upload-dragger class="kb-dragger">
        <n-icon size="30" :component="CloudUploadOutline" />
        <div class="kb-drop-title">{{ uploading ? '上传中…' : '点击或拖拽文件到此处' }}</div>
        <div class="kb-dim">{{ hint }}</div>
      </n-upload-dragger>
    </n-upload>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { CloudUploadOutline } from '@vicons/ionicons5'
import { ingestFile, listKbs } from '../api/kbApi.js'

const props = defineProps({
  hint: { type: String, default: '上传后进入该知识库的 inbox 并提交摄取任务' },
  maxSizeMb: { type: Number, default: 100 },
  /** 受控选中值（不传则组件自管，缺省 default） */
  kbId: { type: String, default: 'default' },
  /** 是否显示知识库选择器 */
  withKbSelect: { type: Boolean, default: true },
})
const emit = defineEmits(['uploaded', 'update:kbId'])

const message = useMessage()
const uploading = ref(false)
const kbLoading = ref(false)
const kbs = ref([])
const selectedKb = ref(props.kbId || 'default')

watch(
  () => props.kbId,
  (v) => {
    if (v && v !== selectedKb.value) selectedKb.value = v
  },
)
watch(selectedKb, (v) => emit('update:kbId', v))

const kbOptions = computed(() =>
  kbs.value.map((k) => ({
    label: `${k.name}（${k.kb_id}）`,
    value: k.kb_id,
  })),
)
const selectedKbPath = computed(() => kbs.value.find((k) => k.kb_id === selectedKb.value)?.root_path || '')

async function loadKbs() {
  kbLoading.value = true
  try {
    const data = await listKbs()
    kbs.value = data?.kbs || []
    // 选中项已不存在时回落到 default
    if (!kbs.value.some((k) => k.kb_id === selectedKb.value)) selectedKb.value = 'default'
  } catch (e) {
    /* 选择器拉取失败不阻塞上传：仍按 default 投递 */
  } finally {
    kbLoading.value = false
  }
}

async function customRequest({ file, onFinish, onError }) {
  const raw = file.file
  if (!raw) return
  if (raw.size > props.maxSizeMb * 1024 * 1024) {
    message.error(`文件超过 ${props.maxSizeMb}MB 上限`)
    onError()
    return
  }
  uploading.value = true
  try {
    const result = await ingestFile(raw, selectedKb.value || 'default')
    const kbName = kbs.value.find((k) => k.kb_id === selectedKb.value)?.name || selectedKb.value
    message.success(`已投递到「${kbName}」：${result?.job_id || result?.doc_id || 'ok'}`)
    emit('uploaded', { ...result, kb_id: selectedKb.value })
    onFinish()
  } catch (e) {
    message.error(`上传失败：${e.message}`)
    onError()
  } finally {
    uploading.value = false
  }
}

onMounted(() => {
  if (props.withKbSelect) loadKbs()
})
</script>

<style scoped>
.kb-dragger {
  background: #ffffff;
  border: 1px dashed #d2d2d7;
  border-radius: 10px;
  padding: 18px;
  text-align: center;
}
.kb-drop-title {
  margin-top: 6px;
  color: #1d1d1f;
  font-size: 13px;
}
</style>
