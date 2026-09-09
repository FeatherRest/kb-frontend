<template>
  <n-upload
    :default-upload="false"
    :file-list-style="{ maxHeight: '200px', overflowY: 'auto' }"
    accept=".pdf,.md,.docx,.txt,.html"
    @change="handleChange"
  >
    <n-upload-dragger>
      <div style="padding:24px;text-align:center;">
        <n-icon size="48" color="#66ccff"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg></n-icon>
        <p style="margin-top:8px;color:#c0c8d8;">拖拽文件到此处，或点击上传</p>
        <p style="font-size:12px;color:#666;">支持 PDF / MD / DOCX / TXT / HTML</p>
      </div>
    </n-upload-dragger>
  </n-upload>
</template>

<script setup>
const emit = defineEmits(['files-selected'])
function handleChange({ fileList }) {
  emit('files-selected', fileList)
}
</script>
