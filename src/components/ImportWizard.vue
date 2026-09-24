<template>
  <!--
    导入向导（4 步，参照 FastGPT 的 dataset 导入流程）
    Step 1 选择文件 → Step 2 分段设置 → Step 3 预览分段 → Step 4 开始导入
    关键：预览与入库共用后端同一套分段函数，所以「预览什么样、入库就什么样」。
  -->
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="`导入文件到「${kbName || kbId}」`"
    style="width: 980px; max-width: 96vw"
    :bordered="false"
    :mask-closable="!uploading"
    @after-leave="resetAll"
  >
    <n-steps :current="step + 1" size="small" style="margin-bottom: 18px">
      <n-step title="选择文件" description="可多选" />
      <n-step title="分段设置" description="决定怎么切" />
      <n-step title="预览分段" description="看切出来什么样" />
      <n-step title="开始导入" description="逐份入库" />
    </n-steps>

    <!-- ── Step 1 选择文件 ── -->
    <div v-if="step === 0">
      <n-upload
        v-model:file-list="fileList"
        :default-upload="false"
        multiple
        :disabled="uploading"
        @change="onFilesChange"
      >
        <n-upload-dragger class="iw-dragger">
          <n-icon size="34" :component="CloudUploadOutline" />
          <div class="iw-drop-title">点击或拖拽文件到此处（可多选）</div>
          <div class="kb-dim">支持 pdf / docx / xlsx / pptx / md / txt / csv / 图片 等；单文件建议 ≤ 100MB</div>
        </n-upload-dragger>
      </n-upload>

      <n-alert v-if="!files.length" type="default" :show-icon="false" style="margin-top: 12px">
        选好文件后点「下一步」设置分段方式；<b>预览满意再导入</b>，不会提前入库。
      </n-alert>

      <n-table v-else :bordered="false" size="small" style="margin-top: 12px">
        <thead>
          <tr>
            <th style="width: 70%">文件</th>
            <th style="width: 18%">大小</th>
            <th style="width: 12%"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(f, i) in files" :key="f.uid || i">
            <td>{{ f.name }}</td>
            <td class="kb-dim">{{ formatSize(f.size) }}</td>
            <td>
              <n-button size="tiny" quaternary type="error" @click="removeFile(i)">移除</n-button>
            </td>
          </tr>
        </tbody>
      </n-table>
    </div>

    <!-- ── Step 2 分段设置 ── -->
    <div v-else-if="step === 1">
      <n-alert v-if="files.length" type="default" :show-icon="false" style="margin-bottom: 10px">
        正在为 <b>{{ files.length }}</b> 个文件设置分段：{{ files.map((f) => f.name).join('、') }}
      </n-alert>
      <n-alert type="info" :show-icon="true" style="margin-bottom: 14px">
        分段方式决定检索粒度：分得太粗 → 检索命中内容不精准；分得太细 → 语义被切碎。
        不确定就用<b>系统默认</b>，或先按某种方式<b>预览</b>再定。
      </n-alert>

      <n-space align="center" :size="10" style="margin-bottom: 12px">
        <n-switch v-model:value="customMode" size="small" />
        <span>自定义分段参数</span>
        <span class="kb-dim">{{ customMode ? '（下面设置会对本次导入生效）' : '（使用系统默认：解析器自动判断 + 512 字/段、重叠 64）' }}</span>
      </n-space>

      <n-form label-placement="top" :disabled="!customMode">
        <n-form-item label="分段方式">
          <n-radio-group v-model:value="form.strategy" size="small">
            <n-space :size="14" wrap>
              <n-radio v-for="opt in STRATEGIES" :key="opt.value" :value="opt.value">
                {{ opt.label }}
                <n-tooltip trigger="hover">
                  <template #trigger><span class="iw-q">?</span></template>
                  {{ opt.tip }}
                </n-tooltip>
              </n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>

        <n-form-item v-if="form.strategy === 'delimiter'" label="分隔符（按它切段）">
          <n-space vertical :size="6" style="width: 100%">
            <n-input v-model:value="form.delimiter" placeholder="例如：===== 或 ## 或 。" style="max-width: 320px" />
            <n-space :size="6" wrap>
              <n-tag
                v-for="d in DELIMITER_PRESETS"
                :key="d.value"
                size="small"
                style="cursor: pointer"
                @click="form.delimiter = d.value"
              >
                {{ d.label }}
              </n-tag>
            </n-space>
          </n-space>
        </n-form-item>

        <n-form-item :label="form.strategy === 'delimiter' ? '每段最大长度（字符）' : '分段长度（字符）'">
          <n-space align="center" :size="10">
            <n-input-number v-model:value="form.size" :min="128" :max="8192" :step="64" style="width: 160px" />
            <span class="kb-dim">128 - 8192，默认 512</span>
          </n-space>
        </n-form-item>

        <n-form-item label="段间重叠（字符）">
          <n-space align="center" :size="10">
            <n-input-number v-model:value="form.overlap" :min="0" :max="1024" :step="16" style="width: 160px" />
            <span class="kb-dim">相邻两段共享的字符数（0-1024，需小于分段长度）；默认 64</span>
          </n-space>
        </n-form-item>
      </n-form>

      <div style="margin-top: 4px">
        <n-checkbox v-model:checked="forceOverwrite" size="small">
          强制重新入库（内容与库中已有文档重复时，覆盖并重新解析）
        </n-checkbox>
        <div class="kb-dim" style="margin-top: 4px">
          默认关闭：重复内容会直接报错并指出与哪份文档重复，不会在 inbox 留下「待处理」文件。
        </div>
      </div>

      <n-alert v-if="!paramsValid" type="warning" :show-icon="true" style="margin-top: 10px">
        {{ invalidReason }}
      </n-alert>

      <n-space :size="8" style="margin-top: 6px">
        <n-button size="tiny" quaternary @click="restoreDefaults">恢复默认值</n-button>
        <span class="kb-dim">当前生效：{{ effectiveParamsText }}</span>
      </n-space>
    </div>

    <!-- ── Step 3 预览分段 ── -->
    <div v-else-if="step === 2">
      <n-space align="center" :size="10" style="margin-bottom: 10px" wrap>
        <n-button size="tiny" quaternary :loading="previewing" @click="runPreview(true)">重新预览</n-button>
        <span class="kb-dim">{{ effectiveParamsText }}</span>
        <n-tag v-if="preview" size="tiny" round :bordered="false">
          解析器 {{ preview.parser || '—' }} · 共 {{ preview.total }} 段
        </n-tag>
        <n-tag v-if="preview?.small_doc_single_chunk" size="tiny" type="warning" round>
          文档较短：默认参数下整篇作为 1 段
        </n-tag>
      </n-space>

      <n-grid :cols="3" :x-gap="12" class="iw-preview-grid">
        <n-grid-item :span="1">
          <n-card size="small" title="待导入文件">
            <n-space vertical :size="6">
              <div
                v-for="f in files"
                :key="f.uid || f.name"
                class="kb-row iw-file-row"
                :class="{ 'kb-row-active': activeUid === (f.uid || f.name) }"
                @click="selectPreview(f)"
              >
                <span class="kb-row-icon">📄</span>
                <span class="kb-row-name">{{ f.name }}</span>
              </div>
            </n-space>
          </n-card>
        </n-grid-item>
        <n-grid-item :span="2">
          <n-card size="small">
            <template #header>
              <div class="kb-card-head">
                <span>分段预览</span>
                <span class="kb-dim">{{ activeFile?.name || '未选择文件' }}</span>
              </div>
            </template>
            <n-spin :show="previewing">
              <n-alert v-if="previewError" type="error" style="margin-bottom: 10px">{{ previewError }}</n-alert>
              <div v-if="preview?.truncated" class="kb-dim" style="margin-bottom: 8px">
                段数过多，仅展示前 {{ preview.chunks.length }} 段（共 {{ preview.total }} 段）
            <div v-if="preview.chunk_param_source" class="param-source">
              分段参数来自：<b>{{ preview.chunk_param_source }}</b>
              <span v-if="preview.chunk_param_sources?.chunk_size === 'kb_config'">
                （本库配置的段长 {{ preview.chunk_size }}，改配置后新导入即生效）
              </span>
            </div>
              </div>
              <div class="iw-chunk-wrap">
                <div v-for="c in preview?.chunks || []" :key="c.index" class="iw-chunk">
                  <div class="iw-chunk-head">
                    <span class="iw-chunk-no">#{{ c.index + 1 }}</span>
                    <n-tag size="tiny" round :bordered="false">{{ c.chunk_type }}</n-tag>
                    <span class="kb-dim">{{ c.chars }} 字符</span>
                  </div>
                  <pre class="iw-chunk-body">{{ c.content }}</pre>
                </div>
                <n-empty
                  v-if="!previewing && !previewError && !(preview?.chunks || []).length"
                  description="选择左侧文件后自动预览"
                  style="margin: 24px 0"
                />
              </div>
            </n-spin>
          </n-card>
        </n-grid-item>
      </n-grid>
    </div>

    <!-- ── Step 4 导入 ── -->
    <div v-else>
      <n-alert v-if="!uploading && !results.length" type="info" :show-icon="true" style="margin-bottom: 12px">
        将按上面的分段参数把 {{ files.length }} 个文件投递到「{{ kbName || kbId }}」，
        解析入库由后台 worker 执行（可稍后在文档列表看进度）。
      </n-alert>
      <n-spin :show="uploading">
        <n-space vertical :size="8">
          <div v-for="r in results" :key="r.key" class="iw-result">
            <span class="kb-row-icon">{{ r.ok ? '✅' : '❌' }}</span>
            <span class="kb-row-name">{{ r.name }}</span>
            <n-tag size="tiny" round :type="r.ok ? 'success' : 'error'">
              {{ r.ok ? '已提交解析' : '失败' }}
            </n-tag>
            <span class="kb-dim">{{ r.detail }}</span>
          </div>
          <div v-if="uploading" class="kb-dim">正在上传…（{{ results.length }} / {{ files.length }}）</div>
        </n-space>
      </n-spin>

      <n-alert v-if="!uploading && results.length && failedCount" type="warning" :show-icon="true" style="margin-top: 12px">
        有 {{ failedCount }} 个文件失败，可修正后重试（其余已成功提交的部分不受影响）。
      </n-alert>
    </div>

    <template #footer>
      <n-space justify="space-between" align="center" style="width: 100%">
        <span class="kb-dim">导入后可在「已入库文档」列表里查看进度、删除</span>
        <n-space :size="8">
          <n-button v-if="step > 0 && !uploading" quaternary @click="step -= 1">上一步</n-button>
          <n-button v-if="step === 0" type="primary" :disabled="!files.length" @click="goStep1">下一步</n-button>
          <n-button v-else-if="step === 1" type="primary" :disabled="!paramsValid" @click="goStep2">
            预览分段
          </n-button>
          <n-button v-else-if="step === 2" type="primary" :disabled="!files.length" @click="goStep3">
            开始导入（{{ files.length }} 个文件）
          </n-button>
          <n-button v-else type="primary" :disabled="uploading" @click="visible = false">
            {{ uploading ? '导入中…' : '完成' }}
          </n-button>
        </n-space>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { CloudUploadOutline } from '@vicons/ionicons5'
import { ingestFile, previewChunks } from '../api/kbApi.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  kbId: { type: String, default: 'default' },
  kbName: { type: String, default: '' },
})
const emit = defineEmits(['update:show', 'done'])

const message = useMessage()

const STRATEGIES = [
  { value: 'auto', label: '自动', tip: '交给解析器按文件类型判断（pdf 按页、xlsx 按表、pptx 按页…），最省心' },
  { value: 'paragraph', label: '按段落', tip: '按空行分段落，段落太长的部分再按长度切开' },
  { value: 'hybrid', label: '按标题层级', tip: '按 markdown 标题树切，保留章节结构，适合有层级的文档' },
  { value: 'sentence', label: '按句子', tip: '按句号分句成组，适合问答型文本' },
  { value: 'delimiter', label: '按分隔符', tip: '按你指定的分隔符切段（如 ===== 或 ## ），分隔符本身不保留' },
]

const DELIMITER_PRESETS = [
  { label: '空行', value: '\n\n' },
  { label: '换行', value: '\n' },
  { label: '句号 .|。', value: '.|。' },
  { label: '感叹号 !|！', value: '!|！' },
  { label: '问号 ?|？', value: '?|？' },
  { label: '分隔线 =====', value: '=====' },
  { label: '二级标题 ## ', value: '## ' },
]

const DEFAULTS = { strategy: 'auto', size: 512, overlap: 64, delimiter: '' }

const visible = computed({
  get: () => props.show,
  set: (v) => emit('update:show', v),
})

const step = ref(0)
/** 内容重复时是否强制覆盖（默认关闭：重复直接报错，不静默留在 inbox） */
const forceOverwrite = ref(false)
const fileList = ref([])
const files = ref([])
const customMode = ref(false)
const form = reactive({ ...DEFAULTS })
const uploading = ref(false)
const results = ref([])

const activeUid = ref('')
const preview = ref(null)
const previewError = ref('')
const previewing = ref(false)
const previewCache = new Map()

const paramsValid = computed(() => {
  if (!customMode.value) return true
  if (form.strategy === 'delimiter' && !form.delimiter) return false
  if (form.size !== null && (form.size < 128 || form.size > 8192)) return false
  if (form.overlap !== null && form.size !== null && form.overlap >= form.size) return false
  return true
})

const invalidReason = computed(() => {
  if (!customMode.value) return ''
  if (form.strategy === 'delimiter' && !form.delimiter) return '请填写分隔符（选择「按分隔符」时必填）'
  if (form.size !== null && (form.size < 128 || form.size > 8192)) return '分段长度需在 128 - 8192 之间'
  if (form.overlap !== null && form.size !== null && form.overlap >= form.size) {
    return `重叠长度（${form.overlap}）必须小于分段长度（${form.size}）`
  }
  return ''
})

const effectiveParamsText = computed(() => {
  if (!customMode.value) return '生效参数：系统默认（解析器自动分段 · 512 字/段 · 重叠 64）'
  const label = STRATEGIES.find((s) => s.value === form.strategy)?.label || form.strategy
  if (form.strategy === 'delimiter') {
    return `生效参数：按分隔符「${form.delimiter}」 · 每段 ≤ ${form.size} 字符 · 重叠 ${form.overlap}`
  }
  return `生效参数：${label} · ${form.size} 字/段 · 重叠 ${form.overlap}`
})

const activeFile = computed(() => files.value.find((f) => uidOf(f) === activeUid.value) || null)
const failedCount = computed(() => results.value.filter((r) => !r.ok).length)

function uidOf(f) {
  return f.uid || f.name
}

function formatSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

/** 只保留真实 File 对象（n-upload 的列表项结构在不同版本间会变，逐个兜底） */
function onFilesChange({ fileList: list }) {
  files.value = (list || [])
    .map((item) => item?.file || item)
    .filter((f) => f && typeof f.name === 'string')
    .map((f) => ({ name: f.name, size: f.size, uid: f.uid || `${f.name}:${f.size}`, file: f }))
}

function removeFile(i) {
  const removed = files.value[i]
  files.value.splice(i, 1)
  fileList.value = fileList.value.filter((item) => (item?.file || item) !== removed?.file)
}

function restoreDefaults() {
  Object.assign(form, { ...DEFAULTS })
}

function goStep1() {
  if (!files.value.length) {
    message.warning('请先选择文件')
    return
  }
  step.value = 1
}

async function goStep2() {
  if (!paramsValid.value) {
    message.warning('分段参数不合法，请检查')
    return
  }
  step.value = 2
  if (!activeUid.value && files.value.length) activeUid.value = uidOf(files.value[0])
  await runPreview()
}

function selectPreview(f) {
  activeUid.value = uidOf(f)
  runPreview()
}

function payloadParams() {
  if (!customMode.value) return { chunkStrategy: '', chunkSize: null, chunkOverlap: null, chunkDelimiter: '' }
  return {
    chunkStrategy: form.strategy,
    chunkSize: form.size,
    chunkOverlap: form.overlap,
    chunkDelimiter: form.strategy === 'delimiter' ? form.delimiter : '',
  }
}

function cacheKey(f, p) {
  return `${uidOf(f)}|${p.chunkStrategy}|${p.chunkSize}|${p.chunkOverlap}|${p.chunkDelimiter}`
}

async function fileToBase64(file) {
  const buf = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

async function runPreview(force = false) {
  const f = activeFile.value
  if (!f) return
  const p = payloadParams()
  const key = cacheKey(f, p)
  if (!force && previewCache.has(key)) {
    preview.value = previewCache.get(key)
    previewError.value = ''
    return
  }
  previewing.value = true
  previewError.value = ''
  try {
    const content = await fileToBase64(f.file)
    const data = await previewChunks({ filename: f.name, content, kbId: props.kbId, ...p })
    if (!data?.ok) {
      preview.value = null
      previewError.value = data?.error || '预览失败'
    } else {
      previewCache.set(key, data)
      preview.value = data
    }
  } catch (e) {
    preview.value = null
    previewError.value = `预览失败：${e.message}`
  } finally {
    previewing.value = false
  }
}

async function goStep3() {
  step.value = 3
  uploading.value = true
  results.value = []
  const p = payloadParams()
  for (const f of files.value) {
    try {
      const r = await ingestFile(f.file, props.kbId, { ...p, force: forceOverwrite.value })
      results.value.push({
        key: uidOf(f),
        name: f.name,
        ok: true,
        detail: r?.stored_filename || r?.job_id || 'ok',
      })
    } catch (e) {
      results.value.push({ key: uidOf(f), name: f.name, ok: false, detail: e.message })
    }
  }
  uploading.value = false
  emit('done', { total: files.value.length, failed: failedCount.value })
}

function resetAll() {
  step.value = 0
  fileList.value = []
  files.value = []
  results.value = []
  preview.value = null
  previewError.value = ''
  previewCache.clear()
  activeUid.value = ''
  customMode.value = false
  forceOverwrite.value = false
  restoreDefaults()
}

watch(
  () => props.show,
  (v) => {
    if (v) resetAll()
  },
)

watch(
  () => [form.strategy, form.size, form.overlap, form.delimiter, customMode.value].join('|'),
  () => {
    // 参数变了 → 已预览过的结果作废（预览与入库必须同参数）
    preview.value = null
    previewError.value = ''
  },
)
</script>

<style scoped>
.param-source {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
}

.iw-dragger {
  background: #ffffff;
  border: 1px dashed #d2d2d7;
  border-radius: 10px;
  padding: 22px;
  text-align: center;
}
.iw-drop-title {
  margin-top: 6px;
  color: #1d1d1f;
  font-size: 14px;
}
.iw-q {
  display: inline-block;
  width: 14px;
  height: 14px;
  line-height: 14px;
  text-align: center;
  border-radius: 50%;
  background: #e8e8ed;
  color: #6e6e73;
  font-size: 10px;
}
.iw-file-row {
  border: 1px solid transparent;
}
.iw-chunk-wrap {
  max-height: 46vh;
  overflow: auto;
}
.iw-chunk {
  border-bottom: 1px dashed #ececf1;
  padding: 8px 2px 10px;
}
.iw-chunk-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.iw-chunk-no {
  font-weight: 600;
  color: #1d1d1f;
  font-size: 12px;
}
.iw-chunk-body {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.65;
  color: #3a3a3c;
  background: #fafafa;
  border-radius: 8px;
  padding: 8px 10px;
  max-height: 240px;
  overflow: auto;
}
.iw-result {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
