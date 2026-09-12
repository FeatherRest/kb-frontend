<template>
  <n-drawer :show="show" :width="drawerWidth" placement="right" @update:show="(v) => emit('update:show', v)">
    <n-drawer-content closable>
      <template #header>
        <div class="kb-detail-title" :title="detail?.title">
          {{ detail?.title || docId }}
        </div>
      </template>

      <n-spin :show="loading">
        <n-tabs v-model:value="tab" type="line" animated>
          <!-- ── 概览 ── -->
          <n-tab-pane name="overview" tab="概览">
            <n-descriptions :column="1" size="small" bordered label-placement="left">
              <n-descriptions-item label="doc_id">
                <span class="kb-mono">{{ docId }}</span>
              </n-descriptions-item>
              <n-descriptions-item label="标题">{{ detail?.title || '-' }}</n-descriptions-item>
              <n-descriptions-item label="分类">{{ detail?.category || '-' }}</n-descriptions-item>
              <n-descriptions-item label="来源">{{ detail?.source || '-' }}</n-descriptions-item>
              <n-descriptions-item label="解析器">{{ detail?.parser || '-' }}</n-descriptions-item>
              <n-descriptions-item label="分块数">
                {{ chunkCount }}
              </n-descriptions-item>
              <n-descriptions-item label="文件大小">
                {{ formatSize(detail?.file_size) }}
              </n-descriptions-item>
              <n-descriptions-item label="索引时间">{{ detail?.indexed_at || '-' }}</n-descriptions-item>
              <n-descriptions-item label="学习状态">
                <n-tag size="small" :type="detail?.learned_at ? 'success' : 'default'">
                  {{ detail?.learned_at ? `已学习 ${detail.learned_at}` : '未学习' }}
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="索引状态">{{ detail?.index_status || '-' }}</n-descriptions-item>
            </n-descriptions>

            <div v-if="chunking" style="margin-top: 14px">
              <div class="kb-dim">分段策略</div>
              <pre class="kb-pre">{{ JSON.stringify(chunking, null, 2) }}</pre>
            </div>
          </n-tab-pane>

          <!-- ── 正文 ── -->
          <n-tab-pane name="content" tab="正文">
            <n-space :size="8" style="margin-bottom: 10px" align="center">
              <n-tag size="tiny" round :bordered="false">{{ content?.format || '-' }}</n-tag>
              <n-tag size="tiny" round :bordered="false">{{ content?.chars || 0 }} 字</n-tag>
              <span class="kb-dim">来源：{{ content?.from || '-' }}</span>
              <n-button size="tiny" quaternary @click="openRawHtml" :disabled="!rawHtmlUrl">
                原始报告
              </n-button>
            </n-space>
            <div v-if="content?.html" class="kb-doc-body" v-html="content.html"></div>
            <pre v-else class="kb-pre">{{ content?.content || '(无正文)' }}</pre>
          </n-tab-pane>

          <!-- ── 分块 ── -->
          <n-tab-pane name="chunks" :tab="`分块 (${chunkCount})`">
            <n-collapse v-if="chunks.length">
              <n-collapse-item
                v-for="c in chunks"
                :key="c.chunk_id"
                :name="c.chunk_id"
                :title="`#${c.chunk_index} · ${c.chunk_type || 'text'} · ${c.token_count || 0} tokens`"
              >
                <div class="kb-dim">
                  {{ c.section_path || c.section || '-' }}
                  <span v-if="c.page_number"> · p.{{ c.page_number }}</span>
                  · 向量：{{ c.vector?.available ? `${c.vector.dim} 维` : '缺失' }}
                </div>
                <pre class="kb-pre kb-pre-chunk">{{ c.content }}</pre>
              </n-collapse-item>
            </n-collapse>
            <n-empty v-else description="无分块" />
          </n-tab-pane>

          <!-- ── 讲解 ── -->
          <n-tab-pane name="explain" tab="讲解">
            <n-space :size="8" style="margin-bottom: 10px" align="center">
              <n-button size="small" type="primary" :loading="generatingText" @click="genExplain()">
                {{ explain?.has_explain ? '重新生成讲解' : '生成讲解' }}
              </n-button>
              <n-button
                size="small"
                :disabled="!explain?.has_explain"
                :loading="generatingAudio"
                @click="genAudio()"
              >
                生成语音
              </n-button>
            </n-space>

            <div v-if="explain?.has_explain" class="kb-explain">{{ explain.explain_text }}</div>
            <n-empty v-else description="尚无讲解文本" />

            <div v-if="audioUrl" class="kb-audio">
              <audio
                ref="audioEl"
                :src="audioUrl"
                preload="metadata"
                @timeupdate="onTimeUpdate"
                @loadedmetadata="onLoaded"
                @ended="playing = false"
              ></audio>
              <n-space align="center" :size="8">
                <n-button size="small" circle @click="togglePlay">
                  <template #icon>
                    <n-icon :component="playing ? PauseOutline : PlayOutline" />
                  </template>
                </n-button>
                <n-button size="small" quaternary @click="seek(-10)">-10s</n-button>
                <n-button size="small" quaternary @click="seek(10)">+10s</n-button>
                <n-button size="small" quaternary @click="cycleSpeed">{{ speed }}x</n-button>
                <span class="kb-dim">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
                <n-button size="small" quaternary @click="genAudio(true)">重新生成</n-button>
              </n-space>
            </div>
          </n-tab-pane>
        </n-tabs>
      </n-spin>

      <template #footer>
        <n-space>
          <n-button size="small" :type="detail?.learned_at ? 'warning' : 'success'" @click="toggleLearned">
            {{ detail?.learned_at ? '标记未学习' : '标记已学习' }}
          </n-button>
          <n-popconfirm @positive-click="removeDoc">
            <template #trigger>
              <n-button size="small" type="error" tertiary>删除文档</n-button>
            </template>
            确认删除该文档？（软删除，Qdrant 同步清除）
          </n-popconfirm>
          <n-button size="small" quaternary @click="copyDocId">复制 doc_id</n-button>
        </n-space>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { PauseOutline, PlayOutline } from '@vicons/ionicons5'
import {
  deleteDocument,
  generateExplain,
  generateTts,
  getDocument,
  getDocumentChunks,
  getDocumentContent,
  getDocumentExplain,
  reportHtmlUrl,
  setLearned,
} from '../api/kbApi.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  docId: { type: String, default: '' },
})
const emit = defineEmits(['update:show', 'changed'])

const message = useMessage()
const tab = ref('overview')
const loading = ref(false)
const detail = ref(null)
const chunks = ref([])
const content = ref(null)
const explain = ref(null)
const chunking = ref(null)
const generatingText = ref(false)
const generatingAudio = ref(false)

const audioEl = ref(null)
const playing = ref(false)
const speed = ref(1)
const currentTime = ref(0)
const duration = ref(0)

const drawerWidth = '74vw'
const chunkCount = computed(() => chunks.value.length)
const audioUrl = computed(() => explain.value?.audio_url || '')
const rawHtmlUrl = computed(() => {
  const p = detail.value?.html_path
  return p ? reportHtmlUrl(p) : ''
})

watch(
  () => [props.show, props.docId],
  ([show, id]) => {
    if (show && id) load(id)
  },
)

async function load(id) {
  loading.value = true
  tab.value = 'overview'
  try {
    const [doc, ch, ct, ex] = await Promise.allSettled([
      getDocument(id),
      getDocumentChunks(id),
      getDocumentContent(id),
      getDocumentExplain(id),
    ])
    detail.value = doc.status === 'fulfilled' ? doc.value.document : null
    chunking.value = doc.status === 'fulfilled' ? doc.value.chunking : null
    chunks.value = ch.status === 'fulfilled' ? ch.value.chunks || [] : []
    content.value = ct.status === 'fulfilled' ? ct.value : null
    explain.value = ex.status === 'fulfilled' ? ex.value : null
  } catch (e) {
    message.error(`加载失败：${e.message}`)
  } finally {
    loading.value = false
  }
}

async function toggleLearned() {
  if (!detail.value) return
  const next = !detail.value.learned_at
  try {
    await setLearned(props.docId, next)
    message.success(next ? '已标记学习' : '已取消学习')
    detail.value.learned_at = next ? new Date().toISOString() : ''
    emit('changed')
  } catch (e) {
    message.error(e.message)
  }
}

async function removeDoc() {
  try {
    await deleteDocument(props.docId)
    message.success('已删除')
    emit('changed')
    emit('update:show', false)
  } catch (e) {
    message.error(e.message)
  }
}

async function copyDocId() {
  try {
    await navigator.clipboard.writeText(props.docId)
    message.success('已复制 doc_id')
  } catch {
    message.error('复制失败')
  }
}

function openRawHtml() {
  if (rawHtmlUrl.value) window.open(rawHtmlUrl.value, '_blank')
}

async function genExplain(force = false) {
  generatingText.value = true
  try {
    const r = await generateExplain(props.docId, { force })
    explain.value = { ...(explain.value || {}), ...r, has_explain: Boolean(r.explain_text) }
    message.success(r.generated ? '讲解已生成' : '已有讲解文本')
  } catch (e) {
    message.error(`生成失败：${e.message}`)
  } finally {
    generatingText.value = false
  }
}

async function genAudio(force = false) {
  generatingAudio.value = true
  try {
    const r = await generateTts(props.docId, { force })
    explain.value = { ...(explain.value || {}), ...r, has_audio: Boolean(r.audio_url) }
    message.success(r.generated ? '语音已生成' : '已有语音')
  } catch (e) {
    message.error(`TTS 失败：${e.message}`)
  } finally {
    generatingAudio.value = false
  }
}

function togglePlay() {
  const el = audioEl.value
  if (!el) return
  if (el.paused) {
    el.playbackRate = speed.value
    el.play()
    playing.value = true
  } else {
    el.pause()
    playing.value = false
  }
}
function seek(delta) {
  const el = audioEl.value
  if (!el) return
  el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta))
}
function cycleSpeed() {
  const options = [1, 1.25, 1.5, 2, 0.75]
  const i = options.indexOf(speed.value)
  speed.value = options[(i + 1) % options.length]
  if (audioEl.value) audioEl.value.playbackRate = speed.value
}
function onTimeUpdate(e) {
  currentTime.value = e.target.currentTime
}
function onLoaded(e) {
  duration.value = e.target.duration
}

function formatTime(s) {
  const v = Number(s) || 0
  const m = Math.floor(v / 60)
  const sec = Math.floor(v % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}
function formatSize(bytes) {
  const b = Number(bytes) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}
</script>

<style scoped>
.kb-detail-title {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60vw;
}
.kb-pre {
  background: #16162a;
  border: 1px solid #2a2a3e;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  color: #c8d0e0;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.kb-pre-chunk {
  max-height: 280px;
}
.kb-doc-body {
  background: #fdfdfd;
  color: #222;
  border-radius: 8px;
  padding: 16px 18px;
  max-height: 62vh;
  overflow: auto;
  line-height: 1.75;
  font-size: 14px;
}
.kb-doc-body :deep(img) {
  max-width: 100%;
}
.kb-explain {
  background: #20203a;
  border: 1px solid #2a2a3e;
  border-radius: 8px;
  padding: 12px 14px;
  color: #d7dcea;
  line-height: 1.9;
  white-space: pre-wrap;
  font-size: 14px;
}
.kb-audio {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #2a2a3e;
}
.kb-audio audio {
  display: none;
}
</style>
