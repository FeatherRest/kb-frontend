<template>
  <div>
    <div class="kb-page-title">计划表</div>

    <n-space class="kb-toolbar" align="center" :size="10" style="margin-bottom: 14px" wrap>
      <n-input v-model:value="filters.q" placeholder="按标题/描述搜索" style="width: 240px" clearable @keyup.enter="load" />
      <n-select v-model:value="filters.status" :options="statusOptions" style="width: 130px" @update:value="load" />
      <n-select v-model:value="filters.phase" :options="phaseOptions" style="width: 130px" @update:value="load" />
      <n-select v-model:value="filters.category" :options="categoryOptions" style="width: 150px" filterable tag @update:value="load" />
      <n-button size="small" @click="load">刷新</n-button>
      <n-button size="small" type="primary" @click="openCreate">新建</n-button>
      <span class="kb-dim">共 {{ items.length }} 项</span>
    </n-space>

    <n-spin :show="loading">
      <!-- 手机端：卡片列表（7 列表格在窄屏不可用） -->
      <n-space v-if="isMobile" vertical :size="10">
        <n-card v-for="r in items" :key="r.id" size="small">
          <div class="kb-card-title">
            <n-tag size="tiny" :bordered="false">{{ r.id }}</n-tag>
            <span :title="r.title">{{ r.title || '(无标题)' }}</span>
          </div>
          <n-space :size="6" style="margin-top: 8px" wrap align="center">
            <n-tag
              size="small"
              round
              :type="STATUS_TYPE[r.status] || 'default'"
              style="cursor: pointer"
              @click="cycle(r, 'status', STATUS)"
            >
              {{ r.status }}
            </n-tag>
            <n-tag size="small" round :bordered="false" style="cursor: pointer" @click="cycle(r, 'phase', PHASES)">
              {{ r.phase || 'init' }}
            </n-tag>
            <n-tag v-if="r.category" size="tiny" :bordered="false">{{ r.category }}</n-tag>
          </n-space>
          <div class="kb-dim" style="margin-top: 6px">更新 {{ r.updated_at || '-' }}</div>
          <n-space :size="8" class="kb-actions" style="margin-top: 10px">
            <n-button size="small" tertiary @click="openEdit(r)">编辑</n-button>
            <n-button
              size="small"
              quaternary
              @click="
                () => {
                  current.value = r
                  commentShow.value = true
                }
              "
            >
              评论 {{ (r.comments || []).length }}
            </n-button>
            <n-popconfirm @positive-click="remove(r)">
              <template #trigger>
                <n-button size="small" quaternary type="warning">删除</n-button>
              </template>
              确认删除 {{ r.id }}？
            </n-popconfirm>
          </n-space>
        </n-card>
      </n-space>

      <n-data-table
        v-else
        :columns="columns"
        :data="items"
        :bordered="true"
        size="small"
        :row-key="(r) => r.id"
        :max-height="600"
      />
      <n-empty v-if="!loading && !items.length" description="暂无计划项" style="margin-top: 40px" />
    </n-spin>

    <!-- ── 新建 / 编辑 ── -->
    <n-modal v-model:show="editShow" preset="card" :title="form.id ? `编辑 ${form.id}` : '新建计划项'" style="width: 720px">
      <n-form :model="form" label-placement="left" label-width="80">
        <n-form-item label="标题">
          <n-input v-model:value="form.title" placeholder="一句话说明要做什么" />
        </n-form-item>
        <n-form-item label="分类">
          <n-select v-model:value="form.category" :options="categoryOptions" filterable tag />
        </n-form-item>
        <n-form-item label="状态">
          <n-select v-model:value="form.status" :options="statusOptions.filter((o) => o.value)" />
        </n-form-item>
        <n-form-item label="阶段">
          <n-select v-model:value="form.phase" :options="phaseOptions.filter((o) => o.value)" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input v-model:value="form.description" type="textarea" :rows="2" />
        </n-form-item>
        <n-form-item label="细节">
          <n-input v-model:value="form.details" type="textarea" :rows="4" />
        </n-form-item>
        <n-form-item label="草稿">
          <n-input v-model:value="form.scratchpad" type="textarea" :rows="3" />
        </n-form-item>
        <n-form-item label="经验">
          <n-input v-model:value="form.experience" type="textarea" :rows="3" />
        </n-form-item>
        <n-form-item label="待办清单">
          <n-input
            v-model:value="form.todo_list_text"
            type="textarea"
            :rows="3"
            placeholder="每行一项（写入 todo_list 字段）"
          />
        </n-form-item>
        <n-form-item label="用到的技能">
          <n-input
            v-model:value="form.skills_used_text"
            type="textarea"
            :rows="2"
            placeholder="每行一个技能名（写入 skills_used 字段）"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="editShow = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- ── 评论 ── -->
    <n-drawer v-model:show="commentShow" :width="520" placement="right">
      <n-drawer-content :title="`评论 · ${current?.title || ''}`" closable>
        <n-space vertical :size="10">
          <div v-for="c in current?.comments || []" :key="c.id" class="kb-comment">
            <div class="kb-dim">{{ c.author || 'agent' }} · {{ c.created_at }}</div>
            <div>{{ c.content }}</div>
            <n-button size="tiny" quaternary type="error" @click="removeComment(c)">删除</n-button>
          </div>
          <n-empty v-if="!(current?.comments || []).length" description="暂无评论" />
          <n-input v-model:value="commentText" type="textarea" :rows="3" placeholder="追加评论…" />
          <n-button size="small" type="primary" :disabled="!commentText.trim()" @click="postComment">提交</n-button>
        </n-space>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup>
import { h, onMounted, reactive, ref } from 'vue'
import { NButton, NPopconfirm, NTag, useMessage } from 'naive-ui'
import { useIsMobile } from '../composables/useIsMobile.js'
import {
  addPlanComment,
  createPlan,
  deletePlan,
  deletePlanComment,
  listPlans,
  updatePlan,
} from '../api/kbApi.js'

const message = useMessage()

const STATUS = ['pending', 'in_progress', 'done', 'blocked']
const PHASES = ['init', 'executing', 'archived']

/** 手机端切换为卡片列表 */
const { isMobile } = useIsMobile()
const CATEGORIES = ['知识库', 'TTS', '工具', '基础设施', 'Bug修复', '模型', '项目管理']

const STATUS_TYPE = {
  pending: 'default',
  in_progress: 'info',
  done: 'success',
  blocked: 'error',
}

const items = ref([])
const loading = ref(false)
const saving = ref(false)
const filters = reactive({ q: '', status: '', phase: '', category: '' })

const editShow = ref(false)
const form = reactive({})
const commentShow = ref(false)
const current = ref(null)
const commentText = ref('')

const statusOptions = [{ label: '全部状态', value: '' }, ...STATUS.map((s) => ({ label: s, value: s }))]
const phaseOptions = [{ label: '全部阶段', value: '' }, ...PHASES.map((p) => ({ label: p, value: p }))]
const categoryOptions = CATEGORIES.map((c) => ({ label: c, value: c }))

const columns = [
  { title: 'ID', key: 'id', width: 70 },
  { title: '标题', key: 'title', minWidth: 240, ellipsis: { tooltip: true } },
  {
    title: '状态',
    key: 'status',
    width: 118,
    render: (row) =>
      h(
        NTag,
        {
          size: 'small',
          type: STATUS_TYPE[row.status] || 'default',
          round: true,
          style: 'cursor:pointer',
          onClick: () => cycle(row, 'status', STATUS),
        },
        { default: () => row.status },
      ),
  },
  {
    title: '阶段',
    key: 'phase',
    width: 110,
    render: (row) =>
      h(
        NTag,
        {
          size: 'small',
          bordered: false,
          round: true,
          style: 'cursor:pointer',
          onClick: () => cycle(row, 'phase', PHASES),
        },
        { default: () => row.phase || 'init' },
      ),
  },
  { title: '分类', key: 'category', width: 110 },
  { title: '更新', key: 'updated_at', width: 170, ellipsis: { tooltip: true } },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render: (row) =>
      h('div', { style: 'display:flex;gap:4px' }, [
        h(NButton, { size: 'tiny', tertiary: true, onClick: () => openEdit(row) }, { default: () => '编辑' }),
        h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            onClick: () => {
              current.value = row
              commentShow.value = true
            },
          },
          { default: () => `评论 ${(row.comments || []).length}` },
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => remove(row) },
          {
            trigger: () =>
              h(NButton, { size: 'tiny', quaternary: true, type: 'error' }, { default: () => '删除' }),
            default: () => '确认删除该计划项？',
          },
        ),
      ]),
  },
]

async function load() {
  loading.value = true
  try {
    const data = await listPlans({
      status: filters.status,
      phase: filters.phase,
      category: filters.category,
      q: filters.q,
    })
    items.value = data.items || []
  } catch (e) {
    message.error(`加载失败：${e.message}`)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, {
    id: '',
    title: '',
    category: '',
    status: 'pending',
    phase: 'init',
    description: '',
    details: '',
    scratchpad: '',
    experience: '',
    todo_list_text: '',
    skills_used_text: '',
  })
  editShow.value = true
}

function openEdit(row) {
  Object.assign(form, {
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status,
    phase: row.phase || 'init',
    description: row.description || '',
    details: row.details || '',
    scratchpad: row.scratchpad || '',
    experience: row.experience || '',
    todo_list_text: (row.todo_list || []).join('\n'),
    skills_used_text: (row.skills_used || []).join('\n'),
  })
  editShow.value = true
}

const splitLines = (text) =>
  String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

async function save() {
  if (!form.title.trim()) {
    message.warning('标题不能为空')
    return
  }
  saving.value = true
  try {
    const payload = { ...form }
    delete payload.id
    // 文本域 ↔ 数组字段（后端 plan_api 直接存 todo_list / skills_used）
    payload.todo_list = splitLines(form.todo_list_text)
    payload.skills_used = splitLines(form.skills_used_text)
    delete payload.todo_list_text
    delete payload.skills_used_text
    if (form.id) await updatePlan(form.id, payload)
    else await createPlan(payload)
    message.success('已保存')
    editShow.value = false
    await load()
  } catch (e) {
    message.error(e.message)
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  try {
    await deletePlan(row.id)
    message.success('已删除')
    await load()
  } catch (e) {
    message.error(e.message)
  }
}

/** 点击标签快速流转状态/阶段 */
async function cycle(row, field, options) {
  const idx = options.indexOf(row[field])
  const next = options[(idx + 1) % options.length]
  try {
    await updatePlan(row.id, { [field]: next })
    row[field] = next
  } catch (e) {
    message.error(e.message)
  }
}

async function postComment() {
  if (!current.value || !commentText.value.trim()) return
  try {
    await addPlanComment(current.value.id, commentText.value.trim())
    commentText.value = ''
    await load()
    current.value = items.value.find((i) => i.id === current.value.id) || current.value
    message.success('评论已提交')
  } catch (e) {
    message.error(e.message)
  }
}

async function removeComment(c) {
  if (!current.value) return
  try {
    await deletePlanComment(current.value.id, c.id)
    await load()
    current.value = items.value.find((i) => i.id === current.value.id) || current.value
  } catch (e) {
    message.error(e.message)
  }
}

onMounted(load)
</script>

<style scoped>
.kb-comment {
  background: #ffffff;
  border-radius: 6px;
  padding: 8px 10px;
  color: #3a3a3c;
  font-size: 13px;
}
</style>
