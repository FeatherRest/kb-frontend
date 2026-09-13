<template>
  <div>
    <div v-if="!file" class="kb-dim">选择文件后在此查看内容</div>

    <template v-else>
      <!-- 图片直出 -->
      <div v-if="file.kind === 'image'" class="kb-preview-img-wrap">
        <img :src="kbRawUrl(kbId, file.rel_path)" :alt="file.name" class="kb-preview-img" />
      </div>

      <!-- PDF 等二进制：交给浏览器 -->
      <n-alert v-else-if="file.kind === 'binary'" type="info" :show-icon="true">
        该类型（{{ file.ext }}）不在内嵌预览范围内，可点「新窗口打开」查看。
      </n-alert>

      <!-- Markdown 渲染 -->
      <div
        v-else-if="isMarkdown && file.content"
        class="kb-md"
        v-html="rendered"
      />

      <!-- 其他文本：等宽原样 -->
      <pre v-else-if="file.content" class="kb-pre">{{ file.content }}</pre>

      <n-alert v-else type="info" :show-icon="true">{{ file.note || '暂无可预览内容' }}</n-alert>

      <div v-if="file.truncated" class="kb-dim" style="margin-top: 8px">
        文件较大，仅显示前 256 KB（可下载后完整查看）
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import { kbRawUrl } from '../api/kbApi.js'

const props = defineProps({
  file: { type: Object, default: null },
  kbId: { type: String, required: true },
})

const md = new MarkdownIt({ html: false, linkify: true })

const isMarkdown = computed(() => ['.md', '.markdown'].includes(String(props.file?.ext || '').toLowerCase()))
const rendered = computed(() => (props.file?.content ? md.render(props.file.content) : ''))
</script>

<style scoped>
.kb-preview-img-wrap {
  text-align: center;
  background: var(--kb-bg);
  border-radius: 12px;
  padding: 12px;
}
.kb-preview-img {
  max-width: 100%;
  max-height: 60vh;
  border-radius: 8px;
}
</style>

<style>
/* markdown 正文排版（v-html 需要全局作用） */
.kb-md {
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--kb-text);
  word-break: break-word;
}
.kb-md h1,
.kb-md h2,
.kb-md h3,
.kb-md h4 {
  font-weight: 600;
  margin: 14px 0 6px;
  line-height: 1.4;
}
.kb-md h1 {
  font-size: 19px;
}
.kb-md h2 {
  font-size: 16px;
}
.kb-md h3 {
  font-size: 14.5px;
}
.kb-md p {
  margin: 6px 0;
}
.kb-md ul,
.kb-md ol {
  padding-left: 22px;
  margin: 6px 0;
}
.kb-md li {
  margin: 3px 0;
}
.kb-md code {
  font-family: var(--kb-mono);
  font-size: 12px;
  background: var(--kb-bg);
  border-radius: 4px;
  padding: 1px 5px;
}
.kb-md pre {
  background: var(--kb-bg);
  border: 1px solid var(--kb-border);
  border-radius: 10px;
  padding: 12px;
  overflow: auto;
}
.kb-md pre code {
  background: transparent;
  padding: 0;
}
.kb-md table {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}
.kb-md th,
.kb-md td {
  border: 1px solid var(--kb-border);
  padding: 6px 9px;
}
.kb-md th {
  background: var(--kb-surface-2);
}
.kb-md blockquote {
  margin: 8px 0;
  padding: 6px 12px;
  border-left: 3px solid var(--kb-accent);
  background: var(--kb-accent-soft);
  border-radius: 0 8px 8px 0;
}
.kb-md a {
  color: var(--kb-accent);
}
</style>
