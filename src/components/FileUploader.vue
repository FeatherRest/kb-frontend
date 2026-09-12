<template>
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
</template>

<script setup>
import { ref } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { CloudUploadOutline } from '@vicons/ionicons5'
import { ingestFile } from '../api/kbApi.js'

const props = defineProps({
  hint: { type: String, default: '上传后进入 inbox 并提交摄取任务' },
  maxSizeMb: { type: Number, default: 100 },
})
const emit = defineEmits(['uploaded'])

const message = useMessage()
const uploading = ref(false)

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
    const result = await ingestFile(raw)
    message.success(`已提交摄取：${result?.job_id || result?.doc_id || 'ok'}`)
    emit('uploaded', result)
    onFinish()
  } catch (e) {
    message.error(`上传失败：${e.message}`)
    onError()
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.kb-dragger {
  background: #20203a;
  border: 1px dashed #3a3a55;
  border-radius: 10px;
  padding: 18px;
  text-align: center;
}
.kb-drop-title {
  margin-top: 6px;
  color: #dfe4f0;
  font-size: 13px;
}
</style>
