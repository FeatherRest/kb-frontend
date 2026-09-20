<template>
  <div
    class="kb-browse-root"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- 拖拽整页 → 打开导入向导（避免"文件拖进来就没了"的无声失败） -->
    <div v-if="dragging" class="kb-drop-overlay">
      <div class="kb-drop-box">松开鼠标 → 打开导入向导（选分段方式 + 预览后再入库）</div>
    </div>

    <!-- ── 顶部：知识库概览 ── -->
    <n-card size="small" class="kb-card kb-kb-head-card">
      <div class="kb-kb-head">
        <n-button size="small" quaternary @click="router.push('/kbs')">← 列表</n-button>
        <span class="kb-kb-name">{{ kb?.name || kbId }}</span>
        <n-tag size="tiny" round :bordered="false">{{ kbId }}</n-tag>
        <!-- 等级判断走接口字段（is_system），禁止硬编码 kb_id === 'default' -->
        <n-tag v-if="kb?.is_system" size="tiny" type="info" round>系统</n-tag>
      </div>
      <div class="kb-meta-row">
        <n-tag size="tiny" round :bordered="false">{{ kb?.stats?.documents ?? 0 }} 文档</n-tag>
        <n-tag size="tiny" round :bordered="false">{{ kb?.stats?.chunks ?? 0 }} 分块</n-tag>
        <n-tag size="tiny" round :bordered="false" :title="kb?.root_path">📁 {{ kb?.root_path }}</n-tag>
        <n-button size="tiny" quaternary @click="copyPath">复制路径</n-button>
      </div>
      <n-space :size="8" style="margin-top: 10px" align="center" wrap>
        <n-button size="small" type="primary" @click="openWizard">＋ 导入文件</n-button>
        <n-button size="small" tertiary @click="router.push(`/kbs/${kbId}/config`)">配置</n-button>
        <n-button size="small" quaternary @click="reloadAll">刷新</n-button>
        <n-switch v-model:value="showAll" size="small" @update:value="reloadAll" />
        <span class="kb-dim">显示全部（含忽略名单里的目录）</span>
        <n-tag v-if="dirInfo?.ignored_patterns?.length" size="tiny" round :bordered="false">
          忽略 {{ dirInfo.ignored_patterns.length }} 项
        </n-tag>
      </n-space>
    </n-card>

    <n-grid :cols="3" :x-gap="14" :y-gap="14" class="kb-browse-grid">
      <!-- ── 目录树 ── -->
      <n-grid-item :span="1">
        <n-card size="small" title="目录" class="kb-card">
          <div class="kb-tree-wrap">
            <n-tree
              block-line
              :data="treeData"
              :selected-keys="selectedKeys"
              :default-expanded-keys="['__root__']"
              :load-data="loadNode"
              @update:selected-keys="onSelectKeys"
            />
          </div>
        </n-card>
      </n-grid-item>

      <!-- ── 右侧：摘要 + 文件列表 / 预览 ── -->
      <n-grid-item :span="2">
        <n-tabs v-model:value="detailTab" type="line" size="small" animated>
          <!-- ══ 文件台账（P28-B）：投递到本库的所有文件 + 状态 + 解析信息 + 搜索/排序/过滤 ══ -->
          <n-tab-pane name="ledger" :tab="`文件台账 (${ledger?.total ?? '—'})`">
            <n-card size="small" class="kb-card">
              <template #header>
                <div class="kb-card-head">
                  <span>投递文件台账</span>
                  <n-space :size="6" align="center">
                    <n-tag v-for="(label, st) in (ledger?.labels || {})" :key="st" size="tiny" round
                           :bordered="false" :type="lstatus.includes(st) ? statusType(st) : 'default'"
                           style="cursor: pointer" @click="toggleStatus(st)">
                      {{ label }} {{ ledger?.counts?.[st] || 0 }}
                    </n-tag>
                  </n-space>
                </div>
              </template>
              <template #header-extra>
                <n-space :size="8" align="center">
                  <n-input v-model:value="lq" size="small" placeholder="搜索文件名/标题/来源" style="width: 190px"
                           clearable @keyup.enter="applyLedger" />
                  <n-select v-model:value="lsort" size="small" style="width: 116px" :options="sortOptions"
                            @update:value="applyLedger" />
                  <n-button size="small" quaternary @click="toggleOrder">{{ lorder === 'desc' ? '↓ 降序' : '↑ 升序' }}</n-button>
                  <n-checkbox v-model:checked="linclDeleted" size="small" @update:checked="applyLedger">含已删除</n-checkbox>
                  <n-button size="small" tertiary :loading="ledgerLoading" @click="applyLedger">刷新</n-button>
                </n-space>
              </template>
              <n-spin :show="ledgerLoading">
                <n-table v-if="ledger?.rows?.length" size="small" :single-line="false" striped>
                  <thead>
                    <tr>
                      <th>文件 / 标题</th>
                      <th style="width: 104px">状态</th>
                      <th style="width: 76px">解析器</th>
                      <th style="width: 56px">块数</th>
                      <th style="width: 78px">大小</th>
                      <th style="width: 140px">投递/更新</th>
                      <th style="width: 54px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in ledger.rows" :key="r.doc_id || r.job_id || r.name">
                      <td>
                        <div class="kb-ledger-name">{{ r.display_name || r.name }}</div>
                        <div class="kb-dim kb-ledger-sub">
                          {{ r.name }}<span v-if="r.error"> · ⚠️ {{ String(r.error).slice(0, 60) }}</span>
                        </div>
                      </td>
                      <td>
                        <n-tag size="tiny" round :bordered="false" :type="statusType(r.status)">
                          {{ ledger.labels[r.status] || r.status }}
                        </n-tag>
                      </td>
                      <td class="kb-dim">{{ r.parser || '—' }}</td>
                      <td>{{ r.chunks || '—' }}</td>
                      <td class="kb-dim">{{ fmtBytes(r.bytes) }}</td>
                      <td class="kb-dim">{{ (r.updated_at || r.created_at || r.indexed_at || '').slice(0, 16) }}</td>
                      <td>
                        <n-button v-if="r.doc_id" size="tiny" quaternary @click="openLedgerDoc(r)">详情</n-button>
                      </td>
                    </tr>
                  </tbody>
                </n-table>
                <n-empty v-else-if="!ledgerLoading" description="没有匹配的文件" style="margin: 18px 0" />
              </n-spin>
              <div class="kb-ledger-foot">
                <n-pagination v-model:page="lpage" :page-count="ledger?.pages || 1" size="small"
                              :page-slot="6" @update:page="loadLedger" />
                <span class="kb-dim">共 {{ ledger?.total || 0 }} 条</span>
              </div>
            </n-card>
          </n-tab-pane>

          <n-tab-pane name="browse" tab="目录与内容">
        <!-- OV 风格目录摘要 -->
        <n-card size="small" class="kb-card">
          <template #header>
            <div class="kb-card-head">
              <span>目录摘要</span>
              <n-tag size="tiny" round :bordered="false" :type="overview?.exists ? 'success' : 'default'">
                {{ overview?.exists ? (overview.stale ? '内容已变，建议重生成' : 'L0+L1 已生成') : '未生成' }}
              </n-tag>
            </div>
          </template>
          <template #header-extra>
            <n-space :size="6">
              <n-button size="tiny" tertiary :loading="genLoading" @click="generate(false)">生成摘要</n-button>
              <n-button
                v-if="overview?.exists"
                size="tiny"
                quaternary
                :loading="genLoading"
                @click="generate(true)"
              >
                重新生成
              </n-button>
            </n-space>
          </template>

          <n-alert v-if="overviewError" type="warning" :show-icon="true" style="margin-bottom: 10px">
            {{ overviewError }}
          </n-alert>

          <div v-if="overview?.abstract" class="kb-l0">
            <span class="kb-l0-tag">L0</span>{{ overview.abstract }}
          </div>
          <div v-if="overview?.overview" class="kb-l1" v-html="renderedOverview" />
          <div v-else-if="!overviewError" class="kb-dim">
            当前目录还没有摘要。点击「生成摘要」会用本机模型读取该目录的文件清单与内容抽样，产出
            <b>L0 一句话摘要</b> 与 <b>L1 结构化概览</b>（结果缓存，内容没变不会重复生成）。
          </div>
          <div v-if="overview?.generated_at" class="kb-dim" style="margin-top: 8px">
            {{ overview.model }} · {{ overview.generated_at }}
          </div>
        </n-card>

        <!-- 文件列表 -->
        <n-card size="small" class="kb-card" style="margin-top: 14px">
          <template #header>
            <div class="kb-card-head">
              <span>内容</span>
              <span class="kb-mono kb-path-line">{{ currentPath || '/' }}</span>
            </div>
          </template>
          <template #header-extra>
            <span class="kb-dim">{{ dirInfo?.dir_count ?? 0 }} 目录 · {{ dirInfo?.file_count ?? 0 }} 文件</span>
          </template>

          <n-space v-if="dirInfo?.breadcrumbs?.length > 1" :size="4" align="center" style="margin-bottom: 10px" wrap>
            <n-button
              v-for="(b, i) in dirInfo.breadcrumbs"
              :key="b.rel_path"
              size="tiny"
              :quaternary="i !== dirInfo.breadcrumbs.length - 1"
              :tertiary="i === dirInfo.breadcrumbs.length - 1"
              @click="openDir(b.rel_path)"
            >
              {{ b.name }}
            </n-button>
          </n-space>

          <n-spin :show="dirLoading">
            <n-space vertical :size="6">
              <div v-for="d in dirInfo?.dirs || []" :key="d.rel_path" class="kb-row kb-row-dir" @click="openDir(d.rel_path)">
                <span class="kb-row-icon">📁</span>
                <span class="kb-row-name">{{ d.name }}/</span>
                <span class="kb-dim">{{ d.children }} 项</span>
              </div>
              <div
                v-for="f in dirInfo?.files || []"
                :key="f.rel_path"
                class="kb-row"
                :class="{ 'kb-row-active': file?.rel_path === f.rel_path }"
                @click="openFile(f.rel_path)"
              >
                <span class="kb-row-icon">{{ fileIcon(f) }}</span>
                <span class="kb-row-name">{{ f.name }}</span>
                <n-tag v-if="f.indexed" size="tiny" round type="success" :bordered="false">已入库</n-tag>
                <n-tag v-else-if="f.doc_id" size="tiny" round :bordered="false">已删索引</n-tag>
                <span class="kb-dim">{{ formatSize(f.size) }}</span>
                <n-button
                  size="tiny"
                  quaternary
                  type="error"
                  class="kb-row-del"
                  title="删除这个文件"
                  @click.stop="askDelete({ relPath: f.rel_path, name: f.name, docId: f.doc_id || '' })"
                >删除</n-button>
              </div>
              <n-empty
                v-if="!dirLoading && !(dirInfo?.dirs || []).length && !(dirInfo?.files || []).length"
                description="该目录为空"
                style="margin: 20px 0"
              />
            </n-space>
          </n-spin>
          <div v-if="dirInfo?.truncated" class="kb-dim" style="margin-top: 8px">条目过多，仅显示前部分</div>
        </n-card>

        <!-- 已入库文档（该库的检索单元；删除入口在这里最直观） -->
        <n-card size="small" class="kb-card" style="margin-top: 14px">
          <template #header>
            <div class="kb-card-head">
              <span>已入库文档</span>
              <n-tag size="tiny" round :bordered="false">{{ docTotal }} 篇</n-tag>
            </div>
          </template>
          <template #header-extra>
            <n-space :size="6" align="center">
              <n-input
                v-model:value="docQuery"
                size="tiny"
                placeholder="按标题/来源筛选"
                style="width: 150px"
                @keyup.enter="loadDocs"
              />
              <n-switch v-model:value="docIncludeDeleted" size="small" @update:value="loadDocs" />
              <span class="kb-dim">含已删/未索引</span>
              <n-button size="tiny" quaternary @click="loadDocs">刷新</n-button>
            </n-space>
          </template>
          <n-spin :show="docLoading">
            <n-table v-if="(docs || []).length" :bordered="false" size="small">
              <thead>
                <tr>
                  <th>标题 / 来源文件</th>
                  <th style="width: 92px">解析器</th>
                  <th style="width: 62px">分块</th>
                  <th style="width: 92px">状态</th>
                  <th style="width: 150px">入库时间</th>
                  <th style="width: 64px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in docs" :key="d.doc_id">
                  <td>
                    <div class="kb-doc-title">{{ d.title || '(无标题)' }}</div>
                    <div class="kb-dim kb-mono">{{ d.original_filename || d.source }}</div>
                  </td>
                  <td class="kb-dim">{{ d.parser }}</td>
                  <td class="kb-dim">{{ d.chunk_count }}</td>
                  <td>
                    <n-tag size="tiny" round :type="d.index_status === 'indexed' ? 'success' : 'warning'" :bordered="false">
                      {{ statusText(d.index_status) }}
                    </n-tag>
                  </td>
                  <td class="kb-dim">{{ d.indexed_at }}</td>
                  <td>
                    <n-button
                      size="tiny"
                      quaternary
                      type="error"
                      :title="d.index_status === 'indexed' ? '删除（索引 + 原件 + 解析产物）' : '清理磁盘残留文件'"
                      @click="askDelete({
                        docId: d.doc_id,
                        name: (d.original_filename || d.title || d.doc_id),
                      })"
                    >{{ d.index_status === 'indexed' ? '删除' : '清理' }}</n-button>
                  </td>
                </tr>
              </tbody>
            </n-table>
            <n-empty v-else-if="!docLoading" description="该知识库还没有入库文档" style="margin: 18px 0" />
          </n-spin>
        </n-card>

        <!-- 文件预览（桌面内嵌 / 手机抽屉） -->
        <n-card v-if="file && !isMobile" size="small" class="kb-card" style="margin-top: 14px">
          <template #header>
            <div class="kb-card-head">
              <span>{{ file.name }}</span>
              <n-tag size="tiny" round :bordered="false">{{ file.kind }}</n-tag>
            </div>
          </template>
          <template #header-extra>
            <n-space :size="6">
              <span class="kb-dim">{{ formatSize(f.size) }} · {{ f.mtime }}</span>
              <n-button size="tiny" quaternary @click="openRaw(f)">新窗口打开</n-button>
              <n-popconfirm @positive-click="deleteFile(f)">
                <template #trigger>
                  <n-button size="tiny" type="error" tertiary>删除</n-button>
                </template>
                确认删除「{{ f.name }}」？(软删除 + 清除向量)
              </n-popconfirm>
              <n-button size="tiny" quaternary @click="file = null">关闭</n-button>
            </n-space>
          </template>
          <FilePreview :file="file" :kb-id="kbId" />
        </n-card>
          </n-tab-pane>
        </n-tabs>
      </n-grid-item>
    </n-grid>

    <!-- 删除确认：先 dry-run 列出会一起处理的文件，再选删除方式 -->
    <n-modal v-model:show="delShow" preset="card" title="删除确认" style="width: 640px; max-width: 94vw">
      <n-alert type="warning" :show-icon="true" style="margin-bottom: 12px">
        删除会同时处理这份文档的<b>索引</b>、<b>原件</b>与<b>解析产物</b>，避免出现
        "索引删了、文件还在"的半死状态。
      </n-alert>
      <div style="margin-bottom: 10px">
        <div class="kb-dim">对象</div>
        <div class="kb-doc-title">{{ delTarget.name }}</div>
        <div v-if="delPlan?.doc_id" class="kb-dim kb-mono">doc_id: {{ delPlan.doc_id }}</div>
      </div>
      <div style="margin-bottom: 14px">
        <div class="kb-dim">将一起处理的文件（{{ (delPlan?.planned || []).length }}）</div>
        <div v-for="pp in delPlan?.planned || []" :key="pp" class="kb-mono kb-del-file">· {{ pp }}</div>
        <div v-if="!delPlanLoading && !(delPlan?.planned || []).length" class="kb-dim">（没有找到关联文件）</div>
      </div>
      <n-radio-group v-model:value="delMode">
        <n-space vertical :size="8">
          <n-radio value="trash">移入回收站（默认）：清索引 + 文件移到 &lt;库&gt;/trash/，可人工恢复</n-radio>
          <n-radio value="soft">仅移出检索：磁盘文件都不动（可重新导入）</n-radio>
          <n-radio value="hard">彻底删除：索引记录 + 文件直接删掉，<b>不可恢复</b></n-radio>
        </n-space>
      </n-radio-group>
      <template #footer>
        <n-space justify="end">
          <n-button @click="delShow = false">取消</n-button>
          <n-button type="error" :loading="deleting" @click="doDelete">确认删除</n-button>
        </n-space>
      </template>
    </n-modal>

    <ImportWizard v-model:show="wizardShow" :kb-id="kbId" :kb-name="kb?.name || kbId" @done="onImported" />

    <!-- 手机：文件预览全屏抽屉 -->
    <n-drawer v-if="isMobile" v-model:show="mobilePreview" placement="bottom" height="88vh" :trap-focus="false">
      <n-drawer-content :title="file?.name || '预览'" closable>
        <template #header>
          <div class="kb-card-head">
            <span>{{ file?.name }}</span>
            <n-tag size="tiny" round :bordered="false">{{ file?.kind }}</n-tag>
          </div>
        </template>
        <template #footer>
          <n-space :size="8">
            <n-button size="small" quaternary @click="openRaw">新窗口打开</n-button>
            <n-button size="small" quaternary @click="mobilePreview = false">关闭</n-button>
          </n-space>
        </template>
        <FilePreview :file="file" :kb-id="kbId" />
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import MarkdownIt from 'markdown-it'
import {
  deleteKbFile,
  deleteKbFileDocId,
  generateKbOverview,
  getKb,
  getKbFiles,
  getKbOverview,
  kbRawUrl,
  listKbDocuments,
  listKbTree,
  previewKbFile,
} from '../api/kbApi.js'
import { useIsMobile } from '../composables/useIsMobile.js'
import FilePreview from '../components/FilePreview.vue'
import ImportWizard from '../components/ImportWizard.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { isMobile } = useIsMobile()

const md = new MarkdownIt({ html: false, linkify: true, breaks: false })

const kbId = computed(() => String(route.params.id || ''))

/* ── 文件台账（P28-B）── */
const detailTab = ref('ledger')
const ledger = ref(null)
const ledgerLoading = ref(false)
const lq = ref('')
const lstatus = ref([])
const lsort = ref('updated')
const lorder = ref('desc')
const linclDeleted = ref(false)
const lpage = ref(1)
const lperPage = ref(50)
const sortOptions = [
  { label: '更新时间', value: 'updated' },
  { label: '投递时间', value: 'created' },
  { label: '文件名', value: 'name' },
  { label: '大小', value: 'size' },
  { label: '块数', value: 'chunks' },
  { label: '状态', value: 'status' },
  { label: '解析器', value: 'parser' },
]

function fmtBytes(n) {
  const x = Number(n || 0)
  if (!x) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = x
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1 }
  return `${i === 0 ? v : v.toFixed(1)}${units[i]}`
}

function statusType(st) {
  return {
    indexed: 'success',
    not_indexed: 'warning',
    pending: 'default',
    parsing: 'info',
    superseded: 'default',
    failed: 'error',
    deleted: 'default',
  }[st] || 'default'
}

function toggleStatus(st) {
  const i = lstatus.value.indexOf(st)
  if (i >= 0) lstatus.value.splice(i, 1)
  else lstatus.value.push(st)
  applyLedger()
}

function toggleOrder() {
  lorder.value = lorder.value === 'desc' ? 'asc' : 'desc'
  applyLedger()
}

function applyLedger() {
  lpage.value = 1
  loadLedger()
}

async function loadLedger() {
  if (!kbId.value) return       // 路由未就绪/正在离开 → 不发请求
  ledgerLoading.value = true
  try {
    ledger.value = await getKbFiles(kbId.value, {
      q: lq.value,
      status: lstatus.value.join(','),
      sort: lsort.value,
      order: lorder.value,
      page: lpage.value,
      perPage: lperPage.value,
      includeDeleted: linclDeleted.value,
    })
  } catch (e) {
    message.error(`台账加载失败：${e?.message || e}`)
  } finally {
    ledgerLoading.value = false
  }
}

function openLedgerDoc(r) {
  if (r.html_path) {
    window.open(kbRawUrl(kbId.value, r.html_path), '_blank')
    return
  }
  navigator.clipboard?.writeText(r.doc_id)
  message.info(`已复制 doc_id：${r.doc_id}`)
}
const kb = ref(null)
const showAll = ref(false)

const treeData = ref([])
const selectedKeys = ref([])
const currentPath = ref('')
const dirInfo = ref(null)
const dirLoading = ref(false)

const file = ref(null)
const mobilePreview = ref(false)

const overview = ref(null)
const overviewError = ref('')
const genLoading = ref(false)

/* ── 导入向导（正向）── */
const wizardShow = ref(false)
const dragging = ref(false)

/* ── 已入库文档 + 删除（逆向）── */
const docs = ref([])
const docTotal = ref(0)
const docQuery = ref('')
/** 显示"已删索引但磁盘文件还在"的遗留项 —— 否则删过的文件再也看不见、删不掉 */
const docIncludeDeleted = ref(false)
const docLoading = ref(false)
const delShow = ref(false)
const delMode = ref('trash')
const delTarget = ref({ name: '', docId: '', relPath: '' })
const delPlan = ref(null)
const delPlanLoading = ref(false)
const deleting = ref(false)

const renderedOverview = computed(() =>
  overview.value?.overview ? md.render(overview.value.overview) : '',
)

function formatSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function fileIcon(f) {
  if (f.kind === 'image') return '🖼'
  if (f.ext === '.md') return '📝'
  if (f.ext === '.json') return '🧩'
  if (f.kind === 'binary') return '📕'
  if (f.kind === 'text') return '📄'
  return '📦'
}

/* ── 加载知识库基本信息 ── */
async function loadKb() {
  try {
    kb.value = await getKb(kbId.value)
  } catch (e) {
    message.error(`知识库加载失败：${e.message}`)
  }
}

/* ── 目录树（懒加载）── */
function toTreeNodes(dirs) {
  return dirs.map((d) => ({ label: `${d.name} (${d.children})`, key: d.rel_path, isLeaf: false }))
}

async function loadNode(node) {
  const rel = node.key === '__root__' ? '' : String(node.key)
  try {
    const data = await listKbTree(kbId.value, { path: rel, showAll: showAll.value })
    return toTreeNodes(data.dirs || [])
  } catch (e) {
    message.error(`读取目录失败：${e.message}`)
    return []
  }
}

async function initTree() {
  try {
    const data = await listKbTree(kbId.value, { path: '', showAll: showAll.value })
    treeData.value = [
      {
        label: '根目录',
        key: '__root__',
        // 默认展开根节点，进页即可看到一级目录
        expanded: true,
        children: toTreeNodes(data.dirs || []),
      },
    ]
    dirInfo.value = data
  } catch (e) {
    message.error(`读取知识库目录失败：${e.message}`)
  }
}

/* ── 打开目录 ── */
async function openDir(rel) {
  currentPath.value = rel || ''
  file.value = null
  dirLoading.value = true
  try {
    dirInfo.value = await listKbTree(kbId.value, { path: currentPath.value, showAll: showAll.value })
  } catch (e) {
    message.error(`读取目录失败：${e.message}`)
  } finally {
    dirLoading.value = false
  }
  selectedKeys.value = [currentPath.value || '__root__']
  loadOverview()
}

/* ── 打开文件 ── */
async function openFile(rel) {
  try {
    file.value = await previewKbFile(kbId.value, rel)
    if (isMobile.value) mobilePreview.value = true
  } catch (e) {
    message.error(`预览失败：${e.message}`)
  }
}

function openRaw(f) {
  const target = f || file.value
  if (!target) return
  window.open(kbRawUrl(kbId.value, target.rel_path), '_blank')
}

async function deleteFile(f) {
  // 预览卡片里的「删除」也走同一套确认流程（含回收站/彻底两档）
  if (!f) return
  askDelete({ relPath: f.rel_path, docId: f.doc_id || '', name: f.name })
}

/* ── 已入库文档列表 ── */
async function loadDocs() {
  docLoading.value = true
  try {
    const data = await listKbDocuments(kbId.value, {
      per_page: 100,
      q: docQuery.value,
      includeDeleted: docIncludeDeleted.value,
    })
    docs.value = data?.documents || []
    docTotal.value = data?.total ?? docs.value.length
  } catch (e) {
    message.error(`文档列表加载失败：${e.message}`)
  } finally {
    docLoading.value = false
  }
}

function statusText(s) {
  const map = { indexed: '已索引', pending: '待处理', deleted: '已删除', superseded: '已被新版替代', failed: '失败' }
  return map[s] || s || '未知'
}

/* ── 导入向导 ── */
function openWizard() {
  wizardShow.value = true
}

async function onImported() {
  message.success('已提交解析，稍后可在「已入库文档」查看进度')
  await Promise.all([loadDocs(), loadKb(), openDir(currentPath.value)])
}

/* 整页拖拽 → 打开导入向导（浏览页本身没有静默上传入口，避免"文件拖进来就没了"） */
function onDragOver() {
  dragging.value = true
}
function onDragLeave() {
  dragging.value = false
}
function onDrop(ev) {
  dragging.value = false
  const dropped = ev?.dataTransfer?.files
  wizardShow.value = true
  if (dropped?.length) {
    message.info(`检测到 ${dropped.length} 个文件：在向导里拖入（或点击选择）即可设置分段并预览`)
  }
}

/* ── 删除（逆向）── */
/** 统一入口：有 relPath 按文件删，只有 docId 按文档删 */
function callDelete({ relPath, docId }, mode, dryRun) {
  return relPath
    ? deleteKbFile(kbId.value, relPath, { mode, dryRun })
    : deleteKbFileDocId(kbId.value, docId, { mode, dryRun })
}

async function askDelete({ relPath = '', docId = '', name = '' }) {
  delTarget.value = { relPath, docId, name: name || relPath || docId }
  delMode.value = 'trash'
  delPlan.value = null
  delShow.value = true
  delPlanLoading.value = true
  try {
    // dry-run：先让用户看清"这一删会动哪些文件"
    delPlan.value = await callDelete(delTarget.value, 'trash', true)
  } catch (e) {
    message.error(`读取删除计划失败：${e.message}`)
  } finally {
    delPlanLoading.value = false
  }
}

async function doDelete() {
  deleting.value = true
  try {
    const payload = await callDelete(delTarget.value, delMode.value, false)
    const n = (payload?.files || []).filter((x) => x.action !== 'missing').length
    message.success(
      payload?.mode === 'soft'
        ? `已移出检索：「${delTarget.value.name}」（磁盘文件保留）`
        : `已删除「${delTarget.value.name}」，处理 ${n} 个文件`,
    )
    delShow.value = false
    file.value = null
    await Promise.all([loadDocs(), loadKb(), openDir(currentPath.value)])
  } catch (e) {
    message.error(`删除失败：${e.message}`)
  } finally {
    deleting.value = false
  }
}

/* ── 目录摘要 ── */
async function loadOverview() {
  overviewError.value = ''
  try {
    overview.value = await getKbOverview(kbId.value, currentPath.value, showAll.value)
  } catch (e) {
    overview.value = null
    overviewError.value = e.message
  }
}

async function generate(force) {
  genLoading.value = true
  overviewError.value = ''
  try {
    const r = await generateKbOverview(kbId.value, {
      path: currentPath.value,
      force,
      showAll: showAll.value,
    })
    overview.value = { ...(overview.value || {}), ...r, exists: true }
    message.success('摘要已生成')
  } catch (e) {
    overviewError.value = `生成失败：${e.message}`
  } finally {
    genLoading.value = false
  }
}

/* ── 交互 ── */
function onSelectKeys(keys) {
  const k = keys[0]
  if (k === undefined) return
  openDir(k === '__root__' ? '' : String(k))
}

async function copyPath() {
  try {
    await navigator.clipboard.writeText(kb.value?.root_path || '')
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

async function reloadAll() {
  if (!kbId.value) return          // 无 kb_id（路由未就绪/正在离开）→ 不发任何请求
  file.value = null
  await Promise.all([loadKb(), initTree(), loadDocs(), loadLedger()])
  if (currentPath.value) await openDir(currentPath.value)
  else await loadOverview()
}

watch(
  () => route.params.id,
  async (id) => {
    // 🔴 离开详情页时 route.params.id 会变成空 → 组件即将卸载，**不要**再发请求
    //（否则会打 /kbs//tree、/kbs//overview，经 nginx 合并斜杠后被后端当成 kb_id=tree → 404）
    if (!id) return
    currentPath.value = ''
    file.value = null
    overview.value = null
    await reloadAll()
  },
)

onMounted(async () => {
  await reloadAll()
  selectedKeys.value = ['__root__']
})
</script>

<style scoped>
.kb-browse-root {
  position: relative;
}
.kb-drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 122, 255, 0.08);
  border: 2px dashed #007aff;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.kb-drop-box {
  background: #ffffff;
  border-radius: 12px;
  padding: 14px 22px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  color: #1d1d1f;
  font-size: 14px;
  font-weight: 600;
}
.kb-row-del {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.kb-row:hover .kb-row-del {
  opacity: 1;
}
.kb-doc-title {
  font-size: 13.5px;
  color: var(--kb-text);
  font-weight: 500;
}
.kb-del-file {
  font-size: 12px;
  color: var(--kb-text-2);
  word-break: break-all;
}
@media (max-width: 768px) {
  .kb-row-del {
    opacity: 1;
  }
}
.kb-kb-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.kb-kb-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--kb-text);
}
.kb-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.kb-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.kb-tree-wrap {
  max-height: 70vh;
  overflow: auto;
}
.kb-path-line {
  color: var(--kb-text-2);
  word-break: break-all;
}
.kb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.kb-row:hover {
  background: var(--kb-bg);
}
.kb-row-active {
  background: var(--kb-accent-soft);
}
.kb-row-icon {
  font-size: 15px;
}
.kb-row-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  color: var(--kb-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-l0 {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  background: var(--kb-accent-soft);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--kb-text);
  margin-bottom: 10px;
}
.kb-l0-tag {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--kb-accent);
  border-radius: 6px;
  padding: 1px 6px;
  margin-top: 2px;
}
</style>

<style>
/* 手机端：浏览页降为单列（n-grid-item 的 span 也要归零，否则会撑出横向滚动） */
@media (max-width: 768px) {
  .kb-browse-grid > * {
    grid-column: span 1 !important;
  }
  .kb-browse-grid .kb-tree-wrap {
    max-height: 42vh;
  }
}
</style>

<style>
/* L1 概览的 markdown 排版（非 scoped：v-html 内容需要全局作用） */
.kb-l1 {
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--kb-text);
}
.kb-l1 h2 {
  font-size: 14.5px;
  font-weight: 600;
  margin: 12px 0 6px;
  color: var(--kb-text);
}
.kb-l1 h3 {
  font-size: 13.5px;
  font-weight: 600;
  margin: 10px 0 4px;
}
.kb-l1 ul,
.kb-l1 ol {
  padding-left: 20px;
  margin: 6px 0;
}
.kb-l1 li {
  margin: 3px 0;
}
.kb-l1 code {
  font-family: var(--kb-mono);
  font-size: 12px;
  background: var(--kb-bg);
  border-radius: 4px;
  padding: 1px 5px;
}
.kb-l1 strong {
  font-weight: 600;
}
.kb-l1 p {
  margin: 6px 0;
}

.kb-ledger-name {
  font-weight: 500;
}
.kb-ledger-sub {
  font-size: 11px;
  word-break: break-all;
}
.kb-ledger-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}
</style>
