<template>
  <div>
    <div class="kb-page-title">文档解析（预览，不落库）</div>

    <n-grid :cols="2" :x-gap="16" :y-gap="16">
      <n-grid-item>
        <n-card size="small" title="选择文件" class="kb-card">
          <n-upload
            :custom-request="onFile"
            :show-file-list="false"
            :disabled="loading"
          >
            <n-upload-dragger class="kb-dragger">
              <n-icon size="30" :component="DocumentTextOutline" />
              <div class="kb-drop-title">{{ loading ? '解析中…' : '点击或拖拽任意类型文件' }}</div>
              <div class="kb-dim">与摄取链路同一解析管线（dry-run，不写库）</div>
            </n-upload-dragger>
          </n-upload>

          <n-divider style="margin: 12px 0">或粘贴文本</n-divider>
          <n-input
            v-model:value="pastedText"
            type="textarea"
            :rows="6"
            placeholder="粘贴 Markdown / 文本内容，将按 .md 预览解析"
          />
          <n-button
            size="small"
            style="margin-top: 8px"
            :disabled="!pastedText.trim()"
            :loading="loading"
            @click="previewText"
          >
            预览粘贴内容
          </n-button>

          <n-alert v-if="error" type="error" style="margin-top: 12px">{{ error }}</n-alert>
        </n-card>

        <n-card v-if="result" size="small" title="解析结果" class="kb-card" style="margin-top: 14px">
          <n-descriptions :column="1" size="small" bordered label-placement="left">
            <n-descriptions-item label="文件">{{ result.filename }}</n-descriptions-item>
            <n-descriptions-item label="类型">{{ result.ext }} · {{ result.category || '-' }}</n-descriptions-item>
            <n-descriptions-item label="解析器">
              {{ result.parser }} <span class="kb-dim">{{ result.parser_version }}</span>
            </n-descriptions-item>
            <n-descriptions-item label="PDF 模式">{{ result.pdf_mode || '-' }}</n-descriptions-item>
            <n-descriptions-item label="大小">{{ formatSize(result.size) }}</n-descriptions-item>
            <n-descriptions-item label="Markdown 长度">{{ result.full_length }} 字</n-descriptions-item>
            <n-descriptions-item label="状态">
              <n-tag size="small" :type="result.success ? 'success' : 'error'">
                {{ result.success ? '成功' : '失败' }}
              </n-tag>
            </n-descriptions-item>
          </n-descriptions>

          <n-space :size="8" style="margin-top: 12px">
            <n-button size="small" tertiary @click="download('md')" :disabled="!result.markdown">
              下载 Markdown
            </n-button>
            <n-button size="small" tertiary @click="download('json')">下载元数据</n-button>
            <n-button size="small" quaternary @click="injectToLearn" :disabled="!result.filename">
              上传到待学习
            </n-button>
          </n-space>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card v-if="result" size="small" class="kb-card">
          <n-tabs v-model:value="tab" type="line" animated>
            <n-tab-pane name="markdown" tab="Markdown">
              <pre class="kb-pre">{{ result.markdown }}</pre>
            </n-tab-pane>
            <n-tab-pane name="workflow" tab="解析流程">
              <WorkflowDiagram :stages="stages" :active-parser="result.parser" />
              <n-divider style="margin: 12px 0" />
              <pre class="kb-pre">{{ JSON.stringify(result.meta?.selection || {}, null, 2) }}</pre>
            </n-tab-pane>
            <n-tab-pane name="meta" :tab="`元数据 (${metaKeys})`">
              <pre class="kb-pre">{{ JSON.stringify(result.meta, null, 2) }}</pre>
            </n-tab-pane>
            <n-tab-pane name="issues" :tab="`警告/错误 (${issues.length})`">
              <n-space vertical :size="8">
                <n-alert
                  v-for="(it, i) in issues"
                  :key="i"
                  :type="it.level === 'error' ? 'error' : 'warning'"
                  :title="it.code || it.level"
                >
                  {{ it.message }}
                </n-alert>
                <n-empty v-if="!issues.length" description="无警告与错误" />
              </n-space>
            </n-tab-pane>
            <n-tab-pane name="assets" :tab="`资源 (${(result.meta?.assets || []).length})`">
              <n-data-table
                size="small"
                :bordered="true"
                :data="result.meta?.assets || []"
                :columns="assetColumns"
                :max-height="420"
              />
            </n-tab-pane>
          </n-tabs>
        </n-card>
        <n-empty v-else description="选择文件后在此查看解析结果" style="margin-top: 60px" />
      </n-grid-item>
    </n-grid>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { DocumentTextOutline } from '@vicons/ionicons5'
import WorkflowDiagram from '../components/WorkflowDiagram.vue'
import { previewParse, uploadToLearn } from '../api/kbApi.js'

const message = useMessage()

const loading = ref(false)
const error = ref('')
const result = ref(null)
const pastedText = ref('')
const tab = ref('markdown')
const lastFile = ref(null)

const assetColumns = [
  { title: '类型', key: 'asset_type', width: 110 },
  { title: '来源', key: 'source', ellipsis: { tooltip: true } },
  { title: '说明', key: 'note', ellipsis: { tooltip: true } },
]

const metaKeys = computed(() => Object.keys(result.value?.meta?.metadata || {}).length)

const issues = computed(() => {
  const meta = result.value?.meta || {}
  return [
    ...(meta.errors || []).map((e) => ({ ...e, level: 'error' })),
    ...(meta.warnings || []).map((w) => ({ ...w, level: 'warning' })),
  ]
})

const stages = computed(() => {
  const r = result.value
  if (!r) return []
  const sel = r.meta?.selection || {}
  const out = []
  out.push({ role: 'input', label: r.filename || '输入文件', desc: `${r.ext || ''} · ${formatSize(r.size)}` })
  if (sel.route) out.push({ role: 'branch', label: sel.route, desc: sel.reason || '路由选择' })
  if (r.parser) out.push({ role: 'process', label: r.parser, desc: `解析器 ${r.parser_version || ''}` })
  for (const a of r.meta?.assets || []) {
    out.push({ role: 'process', label: a.asset_type || 'asset', desc: a.source || '' })
  }
  out.push({ role: 'output', label: '输出 Markdown', desc: `${r.full_length || 0} 字` })
  return out
})

async function onFile({ file, onFinish, onError }) {
  const raw = file.file
  if (!raw) return
  await runPreview(raw.name, raw)
  onFinish?.()
  onError?.()
}

async function previewText() {
  const text = pastedText.value
  if (!text.trim()) return
  const blob = new Blob([text], { type: 'text/markdown' })
  await runPreview('pasted.md', blob, text)
}

async function runPreview(filename, rawFile, rawText) {
  loading.value = true
  error.value = ''
  try {
    // 后端 /preview-parse 要求 base64；粘贴的文本必须先编码（直接传明文在非 ASCII 内容上会解码报错）
    const content = rawText != null ? textToBase64(rawText) : await fileToBase64(rawFile)
    lastFile.value = { filename, content }
    result.value = await previewParse({ filename, content })
    tab.value = 'markdown'
    if (result.value?.error) message.warning(result.value.error)
  } catch (e) {
    error.value = e.message
    result.value = null
  } finally {
    loading.value = false
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

/** 文本 → base64（UTF-8 安全，中文不会炸） */
function textToBase64(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin)
}

function download(kind) {
  if (!result.value) return
  const isMd = kind === 'md'
  const text = isMd ? result.value.markdown : JSON.stringify(result.value.meta, null, 2)
  if (!text) {
    message.warning('内容为空')
    return
  }
  const blob = new Blob([text], { type: isMd ? 'text/markdown' : 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = isMd ? 'preview.md' : 'preview.meta.json'
  a.click()
  URL.revokeObjectURL(url)
}

async function injectToLearn() {
  if (!lastFile.value) return
  loading.value = true
  try {
    const r = await uploadToLearn(lastFile.value)
    if (r.success === false) {
      message.error(r.error || '上传失败')
    } else {
      message.success('已提交到待学习并触发摄取')
    }
  } catch (e) {
    message.error(e.message)
  } finally {
    loading.value = false
  }
}

function formatSize(bytes) {
  const b = Number(bytes) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}
</script>

<style scoped>
.kb-card {
  background: #ffffff;
  border: 1px solid #e8e8ed;
}
.kb-dragger {
  background: #f5f5f7;
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
.kb-pre {
  background: #ffffff;
  border: 1px solid #e8e8ed;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  color: #3a3a3c;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
