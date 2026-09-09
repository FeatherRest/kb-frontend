<template>
  <div style="max-width:800px;margin:0 auto;">
    <n-h2>📝 录入知识</n-h2>

    <n-form>
      <n-form-item label="标题">
        <n-input v-model:value="title" placeholder="文档标题" />
      </n-form-item>

      <n-form-item label="访问级别">
        <n-radio-group v-model:value="accessLevel">
          <n-radio value="open">公开</n-radio>
          <n-radio value="private">私有</n-radio>
        </n-radio-group>
      </n-form-item>

      <n-form-item label="内容 (Markdown)">
        <n-input
          v-model:value="content"
          type="textarea"
          placeholder="输入 Markdown 内容"
          :autosize="{ minRows: 12, maxRows: 24 }"
        />
      </n-form-item>

      <n-form-item label="文件上传">
        <FileUploader @files-selected="onFiles" />
      </n-form-item>

      <n-form-item>
        <n-button type="primary" :loading="submitting" @click="submit">
          提交录入
        </n-button>
      </n-form-item>
    </n-form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import FileUploader from '../components/FileUploader.vue'
import { ingestFile } from '../api/kbApi'

const message = useMessage()
const title = ref('')
const content = ref('')
const accessLevel = ref('open')
const submitting = ref(false)
const files = ref([])

function onFiles(fileList) { files.value = fileList }

async function submit() {
  const selectedFile = files.value[0]?.file
  const file = selectedFile || (content.value
    ? new File([content.value], title.value.trim() ? `${title.value.trim()}.md` : 'knowledge.md', { type: 'text/markdown' })
    : null)
  if (!file) { message.warning('请输入内容或选择文件'); return }
  submitting.value = true
  try {
    await ingestFile(file)
    message.success('录入成功 ✅')
    content.value = ''
    title.value = ''
  } catch (e) {
    message.error(`录入失败: ${e.message}`)
  } finally {
    submitting.value = false
  }
}
</script>
