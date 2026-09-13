<template>
  <div>
    <div class="kb-page-title">
      配置 · {{ kb?.name || kbId }}
      <n-button size="tiny" quaternary style="margin-left: 10px" @click="$router.push('/kbs')">返回列表</n-button>
    </div>

    <n-spin :show="loading">
      <n-grid :cols="2" :x-gap="16" :y-gap="16">
        <!-- ── 基本信息 ── -->
        <n-grid-item>
          <n-card size="small" title="基本信息" class="kb-card">
            <n-form label-placement="left" label-width="96">
              <n-form-item label="名称">
                <n-input v-model:value="info.name" />
              </n-form-item>
              <n-form-item label="标识 kb_id">
                <n-input :value="kbId" disabled />
              </n-form-item>
              <n-form-item label="描述">
                <n-input v-model:value="info.description" type="textarea" :rows="3" />
              </n-form-item>
            </n-form>
            <n-space justify="end">
              <n-button size="small" type="primary" :loading="savingInfo" @click="saveInfo">保存</n-button>
            </n-space>
          </n-card>

          <!-- ── 文件夹 ── -->
          <n-card size="small" title="文件夹" class="kb-card" style="margin-top: 14px">
            <n-form label-placement="left" label-width="96">
              <n-form-item label="路径">
                <n-input v-model:value="folder.path" :disabled="isDefault" />
              </n-form-item>
            </n-form>
            <n-space :size="8" align="center" wrap>
              <n-tag size="tiny" round :type="folderInfo.exists ? 'success' : 'error'">
                {{ folderInfo.exists ? '已存在' : '不存在' }}
              </n-tag>
              <n-tag v-if="folderInfo.exists" size="tiny" round :bordered="false">
                {{ folderInfo.entries }} 项
              </n-tag>
              <n-button size="tiny" quaternary @click="copy(folder.path)">复制路径</n-button>
              <n-button size="small" tertiary :disabled="isDefault || folder.path === kb?.root_path" :loading="savingFolder" @click="saveFolder">
                迁移路径
              </n-button>
            </n-space>
            <div class="kb-dim" style="margin-top: 8px">
              仅允许在文件夹为空时改路径（避免文件丢失）；非空文件夹请新建知识库指向新目录。
            </div>
            <div class="kb-dim" style="margin-top: 6px">骨架目录：{{ (folderInfo.subdirs || []).join(' / ') || '-' }}</div>
          </n-card>
        </n-grid-item>

        <!-- ── Git ── -->
        <n-grid-item>
          <n-card size="small" title="Git 仓库" class="kb-card">
            <n-space :size="8" align="center" style="margin-bottom: 10px" wrap>
              <n-tag size="tiny" round :type="git?.is_repo ? 'success' : 'default'">
                {{ git?.is_repo ? `仓库就绪 · ${git.branch}` : '尚未初始化' }}
              </n-tag>
              <n-tag v-if="git?.is_repo" size="tiny" round :bordered="false">{{ git.commits }} 次提交</n-tag>
              <n-tag v-if="git?.is_repo" size="tiny" round :type="git.dirty ? 'warning' : 'success'">
                {{ git.dirty ? `${git.dirty_count} 个未提交变更` : '工作区干净' }}
              </n-tag>
              <n-button size="tiny" quaternary :loading="loadingGit" @click="loadGit">刷新</n-button>
            </n-space>

            <div v-if="git?.is_repo" class="kb-dim" style="margin-bottom: 10px">
              最近提交：{{ git.last_commit?.hash }} · {{ git.last_commit?.date }} · {{ git.last_commit?.subject }}
            </div>

            <n-form label-placement="left" label-width="96">
              <n-form-item label="启用 Git">
                <n-switch v-model:value="gitForm.git_enabled" size="small" />
              </n-form-item>
              <n-form-item label="分支">
                <n-input v-model:value="gitForm.git_branch" style="width: 180px" />
              </n-form-item>
              <n-form-item label="远端 origin">
                <n-input v-model:value="gitForm.git_remote" placeholder="git@github.com:user/repo.git（可留空）" />
              </n-form-item>
            </n-form>

            <n-space :size="8" justify="end">
              <n-button size="small" tertiary :loading="initGit" @click="doGitInit">
                {{ git?.is_repo ? '确保仓库/提交' : '初始化 Git 仓库' }}
              </n-button>
              <n-button size="small" type="primary" :loading="savingGit" @click="saveGit">保存 Git 配置</n-button>
            </n-space>
          </n-card>

          <!-- ── 运行配置 ── -->
          <n-card size="small" title="运行配置" class="kb-card" style="margin-top: 14px">
            <n-form label-placement="left" label-width="130">
              <n-form-item label="分段策略">
                <n-select v-model:value="cfg.chunk_strategy" :options="STRATEGY_OPTIONS" style="width: 200px" />
              </n-form-item>
              <n-form-item label="分块大小">
                <n-input-number v-model:value="cfg.chunk_size" :min="64" :max="4096" :step="64" style="width: 160px" />
              </n-form-item>
              <n-form-item label="分块重叠">
                <n-input-number v-model:value="cfg.chunk_overlap" :min="0" :max="1024" :step="16" style="width: 160px" />
              </n-form-item>
              <n-form-item label="嵌入模型">
                <n-input v-model:value="cfg.embedding_model" style="width: 220px" />
              </n-form-item>
              <n-form-item label="召回条数 top_k">
                <n-input-number v-model:value="cfg.top_k" :min="1" :max="50" style="width: 140px" />
              </n-form-item>
              <n-form-item label="CrossEncoder 重排">
                <n-switch v-model:value="cfg.reranker_enabled" size="small" />
              </n-form-item>
              <n-form-item label="投递即摄取">
                <n-switch v-model:value="cfg.auto_ingest" size="small" />
              </n-form-item>
              <n-form-item label="监听文件夹">
                <n-switch v-model:value="cfg.watch_folder" size="small" />
              </n-form-item>
              <n-form-item label="Git 自动提交">
                <n-switch v-model:value="cfg.git_auto_commit" size="small" />
              </n-form-item>
            </n-form>
            <n-space justify="end">
              <n-button size="small" quaternary @click="resetConfig">恢复默认</n-button>
              <n-button size="small" type="primary" :loading="savingCfg" @click="saveConfig">保存配置</n-button>
            </n-space>
          </n-card>

          <!-- ── 内容浏览 ── -->
          <n-card size="small" title="内容浏览" class="kb-card" style="margin-top: 14px">
            <n-alert type="info" :show-icon="true" style="margin-bottom: 12px">
              浏览页（知识库管理 →「浏览内容」）默认隐藏下面这些目录/文件。每行一条，支持 <code>*</code> 通配
              （例如 <code>*.lock</code>）。运行时大目录（pending / qdrant-server 等）默认已列出，建议保留。
            </n-alert>
            <n-input
              v-model:value="cfg.browse_ignore_text"
              type="textarea"
              :rows="10"
              placeholder="每行一个忽略项"
              style="font-family: var(--kb-mono)"
            />
            <n-space justify="end" style="margin-top: 10px">
              <n-button size="small" quaternary @click="resetBrowseIgnore">恢复默认名单</n-button>
              <n-button size="small" type="primary" :loading="savingCfg" @click="saveBrowseIgnore">保存忽略名单</n-button>
            </n-space>
          </n-card>

          <!-- ── 危险操作 ── -->
          <n-card v-if="!isDefault" size="small" title="危险操作" class="kb-card" style="margin-top: 14px">
            <n-space align="center" :size="10" wrap>
              <n-checkbox v-model:checked="purge">同时删除文件夹（不可恢复）</n-checkbox>
              <n-popconfirm @positive-click="doDelete">
                <template #trigger>
                  <n-button size="small" type="error" tertiary>删除知识库</n-button>
                </template>
                {{ purge ? '将删除登记并永久删除文件夹，确认？' : '仅删除登记（文件夹保留），确认？' }}
              </n-popconfirm>
            </n-space>
          </n-card>
        </n-grid-item>
      </n-grid>
    </n-spin>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import {
  deleteKb,
  getKb,
  initKbGit,
  updateKb,
  updateKbConfig,
} from '../api/kbApi.js'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const kbId = computed(() => String(route.params.id || ''))
const isDefault = computed(() => kbId.value === 'default')

const loading = ref(false)
const kb = ref(null)
const git = ref(null)
const loadingGit = ref(false)

const info = reactive({ name: '', description: '' })
const folder = reactive({ path: '' })
const gitForm = reactive({ git_enabled: true, git_branch: 'main', git_remote: '' })
const cfg = reactive({})
const defaults = ref({})
const purge = ref(false)

const savingInfo = ref(false)
const savingFolder = ref(false)
const savingGit = ref(false)
const savingCfg = ref(false)
const initGit = ref(false)

const STRATEGY_OPTIONS = [
  { label: 'hybrid（结构感知）', value: 'hybrid' },
  { label: 'fixed（定长）', value: 'fixed' },
  { label: 'semantic（语义）', value: 'semantic' },
  { label: 'sentence（句子）', value: 'sentence' },
]

/** 与后端 DEFAULT_CONFIG.browse_ignore 保持一致的默认忽略名单（「恢复默认名单」用） */
const DEFAULT_BROWSE_IGNORE = [
  '.git', '.gitignore', '.processed', '.DS_Store', 'Thumbs.db',
  '__pycache__', 'node_modules', '.venv', 'venv', '*.pyc', '*.lock', '*.tmp',
  'pending', 'broadcast-audio', 'qdrant-server', 'testzone', 'backups',
  'manifests', 'indexes', 'staging', 'quarantine', 'rejected', 'web',
  'kb.db', 'meta.db', 'metadata.db', 'bm25_vocab.json', 'bm25_vocab.lock',
]

const folderInfo = ref({ exists: false, entries: 0, subdirs: [] })

async function load() {
  if (!kbId.value) return
  loading.value = true
  try {
    const data = await getKb(kbId.value)
    kb.value = data
    git.value = data.git_status || null
    info.name = data.name || ''
    info.description = data.description || ''
    folder.path = data.root_path || ''
    gitForm.git_enabled = Boolean(data.git_enabled)
    gitForm.git_branch = data.git_branch || 'main'
    gitForm.git_remote = data.git_remote || ''
    Object.assign(cfg, data.config || {})
    cfg.browse_ignore_text = (data.config?.browse_ignore || []).join('\n')
    defaults.value = data.config || {}
    folderInfo.value = data.folder_info || { exists: false, entries: 0, subdirs: [] }
  } catch (e) {
    message.error(`加载失败：${e.message}`)
  } finally {
    loading.value = false
  }
}

async function saveInfo() {
  savingInfo.value = true
  try {
    await updateKb(kbId.value, { name: info.name, description: info.description })
    message.success('已保存')
  } catch (e) {
    message.error(e.message)
  } finally {
    savingInfo.value = false
  }
}

async function saveFolder() {
  savingFolder.value = true
  try {
    const r = await updateKb(kbId.value, { root_path: folder.path })
    message.success('路径已更新')
    kb.value = r.kb
    folder.path = r.kb.root_path
    await loadGit()
  } catch (e) {
    message.error(e.message)
  } finally {
    savingFolder.value = false
  }
}

async function saveGit() {
  savingGit.value = true
  try {
    const r = await updateKb(kbId.value, {
      git_enabled: gitForm.git_enabled,
      git_branch: gitForm.git_branch,
      git_remote: gitForm.git_remote,
    })
    kb.value = r.kb
    message.success('Git 配置已保存')
  } catch (e) {
    message.error(e.message)
  } finally {
    savingGit.value = false
  }
}

async function doGitInit() {
  initGit.value = true
  try {
    const r = await initKbGit(kbId.value)
    git.value = r.status || null
    message.success(`Git 仓库就绪（${(r.steps || []).join(' → ')}）`)
  } catch (e) {
    message.error(e.message)
  } finally {
    initGit.value = false
  }
}

async function loadGit() {
  loadingGit.value = true
  try {
    const data = await getKb(kbId.value)
    git.value = data.git_status || null
    folderInfo.value = data.folder_info || folderInfo.value
  } catch (e) {
    message.error(e.message)
  } finally {
    loadingGit.value = false
  }
}

async function saveConfig() {
  savingCfg.value = true
  try {
    const payload = { ...cfg }
    delete payload.browse_ignore_text
    delete payload.browse_ignore
    const r = await updateKbConfig(kbId.value, { config: payload })
    Object.assign(cfg, r.config || {})
    cfg.browse_ignore_text = (r.config?.browse_ignore || []).join('\n')
    message.success('运行配置已保存')
  } catch (e) {
    message.error(e.message)
  } finally {
    savingCfg.value = false
  }
}

/** 保存「内容浏览」忽略名单（textarea 每行一条 → 数组） */
async function saveBrowseIgnore() {
  savingCfg.value = true
  try {
    const list = String(cfg.browse_ignore_text || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const r = await updateKbConfig(kbId.value, { config: { browse_ignore: list } })
    cfg.browse_ignore_text = (r.config?.browse_ignore || []).join('\n')
    message.success(`忽略名单已保存（${list.length} 项）`)
  } catch (e) {
    message.error(e.message)
  } finally {
    savingCfg.value = false
  }
}

function resetBrowseIgnore() {
  cfg.browse_ignore_text = DEFAULT_BROWSE_IGNORE.join('\n')
}

function resetConfig() {
  Object.assign(cfg, {
    chunk_strategy: 'hybrid',
    chunk_size: 512,
    chunk_overlap: 64,
    embedding_model: 'qwen3-embedding',
    reranker_enabled: true,
    top_k: 5,
    auto_ingest: true,
    watch_folder: true,
    git_auto_commit: false,
  })
}

async function doDelete() {
  try {
    await deleteKb(kbId.value, { purge: purge.value })
    message.success(purge.value ? '知识库与文件夹已删除' : '登记已移除')
    router.push('/kbs')
  } catch (e) {
    message.error(e.message)
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text || '')
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

watch(kbId, load)
onMounted(load)
</script>

<style scoped>
.kb-card {
  background: #ffffff;
  border: 1px solid #e8e8ed;
}
</style>
