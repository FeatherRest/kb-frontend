<template>
  <div>
    <div class="kb-page-title">知识库管理</div>

    <n-space align="center" :size="10" style="margin-bottom: 14px" wrap>
      <n-button size="small" @click="load">刷新</n-button>
      <n-button size="small" type="primary" @click="openCreate">新建知识库</n-button>
      <span class="kb-dim">根目录：{{ rootPath }} · 共 {{ kbs.length }} 个知识库</span>
    </n-space>

    <n-card size="small" class="kb-kb-card" style="margin-bottom: 14px">
      <div class="kb-kb-head" style="margin-bottom: 4px">
        <span class="kb-kb-name">📥 投递文件</span>
        <n-tag size="tiny" round :bordered="false">自动解析 → 归属到所选知识库</n-tag>
      </div>
      <div class="kb-dim" style="margin-bottom: 10px">
        选择目标知识库后拖入文件：文件进入该库的 inbox，解析产物落到该库的 parsed/；不选则投递到 <b>default</b>。
      </div>
      <FileUploader v-model:kb-id="uploadKb" @uploaded="onUploaded" />
    </n-card>

    <n-spin :show="loading">
      <n-grid :cols="2" :x-gap="12" :y-gap="12">
        <n-grid-item v-for="kb in kbs" :key="kb.kb_id">
          <n-card size="small" class="kb-kb-card">
            <div class="kb-kb-head">
              <span class="kb-kb-name">{{ kb.name }}</span>
              <n-tag size="tiny" round :bordered="false">{{ kb.kb_id }}</n-tag>
              <n-tag v-if="kb.kb_id === 'default'" size="tiny" type="info" round>系统</n-tag>
            </div>

            <div class="kb-dim kb-path" :title="kb.root_path">📁 {{ kb.root_path }}</div>

            <n-space :size="6" style="margin: 8px 0" wrap>
              <n-tag size="tiny" round :bordered="false">
                {{ kb.stats?.documents ?? 0 }} 文档
              </n-tag>
              <n-tag size="tiny" round :bordered="false">
                {{ kb.stats?.chunks ?? 0 }} 分块
              </n-tag>
              <n-tag size="tiny" round :type="kb.git_enabled ? 'success' : 'default'">
                {{ kb.git_enabled ? 'Git 已启用' : '无 Git' }}
              </n-tag>
              <n-tag v-if="kb.git_status?.is_repo" size="tiny" round :bordered="false">
                {{ kb.git_status.commits }} 次提交
              </n-tag>
              <n-tag v-if="kb.git_status?.is_repo && kb.git_status.dirty_count" size="tiny" round type="warning">
                {{ kb.git_status.dirty_count }} 个改动未提交
              </n-tag>
              <n-tag v-if="kb.git_remote" size="tiny" round :bordered="false">远端已配</n-tag>
            </n-space>

            <div v-if="kb.description" class="kb-dim" style="margin-bottom: 8px">{{ kb.description }}</div>

            <n-space :size="8">
              <n-button size="tiny" type="primary" ghost @click="useAsUploadTarget(kb)">投递到此库</n-button>
              <n-button size="tiny" tertiary @click="goConfig(kb.kb_id)">配置</n-button>
              <n-button size="tiny" quaternary @click="copy(kb.root_path)">复制路径</n-button>
              <n-popconfirm v-if="kb.kb_id !== 'default'" @positive-click="remove(kb, false)">
                <template #trigger>
                  <n-button size="tiny" quaternary type="warning">移除登记</n-button>
                </template>
                仅移除登记（文件夹与文件保留），确认？
              </n-popconfirm>
            </n-space>
          </n-card>
        </n-grid-item>
      </n-grid>
      <n-empty v-if="!loading && !kbs.length" description="暂无知识库" style="margin-top: 40px" />
    </n-spin>

    <!-- ── 新建知识库 ── -->
    <n-modal v-model:show="createShow" preset="card" title="新建知识库" style="width: 680px">
      <n-alert type="info" :show-icon="true" style="margin-bottom: 14px">
        创建后将自动生成文件夹骨架（docs / inbox / parsed / raw / derived），
        并在该文件夹执行 <b>git init</b> 与首个提交。
      </n-alert>
      <n-form :model="form" label-placement="left" label-width="96">
        <n-form-item label="名称">
          <n-input v-model:value="form.name" placeholder="例如：产品资料库" @update:value="onNameChange" />
        </n-form-item>
        <n-form-item label="标识 kb_id">
          <n-input v-model:value="form.kb_id" placeholder="小写字母/数字/-/_，留空按名称生成" @update:value="kbIdTouched = true" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input v-model:value="form.description" type="textarea" :rows="2" />
        </n-form-item>
        <n-form-item label="文件夹">
          <n-input v-model:value="form.root_path" placeholder="留空使用默认根目录" @update:value="rootTouched = true" />
        </n-form-item>
        <n-form-item label=" " :show-label="false">
          <n-space align="center" :size="8">
            <n-button size="tiny" quaternary @click="useDefaultPath">用默认路径</n-button>
            <span class="kb-dim">默认：{{ rootPath }}/&lt;kb_id&gt;</span>
          </n-space>
        </n-form-item>
        <n-form-item label="Git 仓库">
          <n-space align="center" :size="10">
            <n-switch v-model:value="form.git_enabled" size="small" />
            <span class="kb-dim">创建时 git init + 首个提交</span>
          </n-space>
        </n-form-item>
        <n-form-item label="分支">
          <n-input v-model:value="form.git_branch" style="width: 180px" />
        </n-form-item>
        <n-form-item label="Git 远端">
          <n-input v-model:value="form.git_remote" placeholder="可留空，之后在配置页填（如 git@github.com:me/kb-x.git）" />
        </n-form-item>
      </n-form>

      <n-alert v-if="createError" type="error" style="margin-top: 10px">{{ createError }}</n-alert>

      <template #footer>
        <n-space justify="end">
          <n-button @click="createShow = false">取消</n-button>
          <n-button type="primary" :loading="creating" @click="submitCreate">创建</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { useRouter } from 'vue-router'
import { createKb, deleteKb, listKbs } from '../api/kbApi.js'
import FileUploader from '../components/FileUploader.vue'

const message = useMessage()
const router = useRouter()

const kbs = ref([])
const rootPath = ref('/srv/sage-data/knowledge/kbs')
const loading = ref(false)
/** 上传目标知识库（缺省 default） */
const uploadKb = ref('default')
const createShow = ref(false)
const creating = ref(false)
const createError = ref('')
const kbIdTouched = ref(false)
const rootTouched = ref(false)

const form = reactive({
  kb_id: '',
  name: '',
  description: '',
  root_path: '',
  git_enabled: true,
  git_branch: 'main',
  git_remote: '',
})

async function load() {
  loading.value = true
  try {
    const data = await listKbs()
    kbs.value = data.kbs || []
    if (data.root) rootPath.value = data.root
  } catch (e) {
    message.error(`加载失败：${e.message}`)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, {
    kb_id: '',
    name: '',
    description: '',
    root_path: '',
    git_enabled: true,
    git_branch: 'main',
    git_remote: '',
  })
  createError.value = ''
  kbIdTouched.value = false
  rootTouched.value = false
  createShow.value = true
}

function onNameChange(v) {
  // 用户未手动改过 kb_id/路径时，跟着名称自动生成，保持 kb_id 与文件夹名一致
  if (!kbIdTouched.value) form.kb_id = v ? slugify(v) : ''
  if (!rootTouched.value) form.root_path = v ? `${rootPath.value}/${slugify(v)}` : ''
}

function slugify(name) {
  const t = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return t || 'kb-id'
}

function useDefaultPath() {
  rootTouched.value = false
  form.root_path = `${rootPath.value}/${form.kb_id || 'kb-id'}`
}

async function submitCreate() {
  createError.value = ''
  if (!form.name.trim()) {
    createError.value = '名称不能为空'
    return
  }
  creating.value = true
  try {
    const payload = { ...form }
    if (!payload.root_path) delete payload.root_path
    if (!payload.kb_id) delete payload.kb_id
    const r = await createKb(payload)
    message.success(`已创建 ${r.kb?.kb_id}（${(r.git?.steps || []).join(' → ') || '未启用 Git'}）`)
    createShow.value = false
    await load()
  } catch (e) {
    createError.value = e.message
  } finally {
    creating.value = false
  }
}

async function remove(kb, purge) {
  try {
    await deleteKb(kb.kb_id, { purge })
    message.success('已移除登记')
    await load()
  } catch (e) {
    message.error(e.message)
  }
}

function goConfig(kbId) {
  router.push(`/kbs/${kbId}/config`)
}

/** 把该 KB 设为上传目标，并回到页面顶部的投递区 */
function useAsUploadTarget(kb) {
  uploadKb.value = kb.kb_id
  message.info(`投递目标已切换为「${kb.name}」，请在上方拖入文件`)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/** 投递成功：刷新列表让文档数/提交数即时更新 */
function onUploaded() {
  load()
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text || '')
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

onMounted(load)
</script>

<style scoped>
.kb-kb-card {
  background: #20203a;
  border: 1px solid #2a2a3e;
}
.kb-kb-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.kb-kb-name {
  font-weight: 600;
  color: #e6e6f5;
  font-size: 15px;
}
.kb-path {
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
