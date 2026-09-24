/**
 * kb-api 全量接口封装（唯一真相源：hub/knowledge/api.py 的 _KbHandler）。
 *
 * 所有路径均以 `/kb/api` 为基地址，写成「前缀之后」的形态：
 *   baseURL `/kb/api` + `/v1/search`         → /kb/api/v1/search
 *   baseURL `/kb/api` + `/api/knowledge/...` → /kb/api/api/knowledge/...
 * 生产链路 nginx 剥掉 /kb/api 后由 kb-api 命中；开发链路 kb-api 自行归一化前缀。
 */
import axios from 'axios'
import { resolveKbApiBase } from './apiBase.js'

export const KB_API_BASE = resolveKbApiBase(import.meta.env.VITE_KB_API)

const http = axios.create({
  baseURL: KB_API_BASE,
  timeout: 180000,
})

function unwrap(promise) {
  return promise
    .then((r) => r.data)
    .catch((err) => {
      const status = err?.response?.status
      const data = err?.response?.data
      const detail =
        (data && (data.error || data.detail || data.message)) ||
        err.message ||
        '请求失败'
      const wrapped = new Error(String(detail))
      wrapped.status = status
      wrapped.cause = err
      throw wrapped
    })
}

/* ── 健康 / 统计 ── */
export const getHealth = () => unwrap(http.get('/health'))
export const getStats = () => unwrap(http.get('/v1/stats'))
export const getJobs = ({ state = '', limit = 50 } = {}) =>
  unwrap(http.get('/v1/jobs', { params: { state, limit } }))

/* ── 搜索 ── */
export function searchKB({
  q,
  // 🔴 检索目标域**必须显式**（kb | pages | both）—— 后端缺省即 400，
  // 用户 2026-09-23 定：禁止「默认全查」。
  target = 'kb',
  top_k = 8,
  mode = 'hybrid',
  scope = '',
  category = '',
  chunk_type = '',
  rerank = null,
  kb_id = '',
} = {}) {
  const body = { q, target, top_k, mode }
  if (scope) body.scope = scope
  if (category) body.category = category
  if (chunk_type) body.chunk_type = chunk_type
  if (rerank !== null && rerank !== undefined) body.rerank = rerank
  if (target === 'pages') {
    // 概念页与知识库是两个域，不传 kb_id
  } else {
    body.kb_id = kb_id || 'all'  // 线上协议："全库"必须显式写成 all（缺省不再等于全查）
  }
  return unwrap(http.post('/v1/search', body))
}

/* ── 文档 ── */
export function listDocuments({
  scope = '',
  category = '',
  q = '',
  learned = '',
  page = 1,
  per_page = 20,
  order_by = 'ingested_at_desc',
} = {}) {
  const params = { page, per_page, order_by }
  if (scope) params.scope = scope
  if (category) params.category = category
  if (q) params.q = q
  if (learned !== '' && learned !== null && learned !== undefined) params.learned = learned
  return unwrap(http.get('/v1/documents', { params }))
}

const docPath = (docId, suffix = '') =>
  `/v1/documents/${encodeURIComponent(docId)}${suffix}`

export const getDocument = (docId) => unwrap(http.get(docPath(docId)))
export const getDocumentChunks = (docId) => unwrap(http.get(docPath(docId, '/chunks')))
export const getDocumentContent = (docId) => unwrap(http.get(docPath(docId, '/content')))
export const getDocumentExplain = (docId) => unwrap(http.get(docPath(docId, '/explain')))
export const generateExplain = (docId, { force = false, custom_prompt = '' } = {}) =>
  unwrap(http.post(docPath(docId, '/explain'), { force, custom_prompt }))
export const generateTts = (docId, { force = false } = {}) =>
  unwrap(http.post(docPath(docId, '/tts'), { force }))

export const setLearned = (docId, learned = true) =>
  unwrap(http.post('/v1/document/learn', { doc_id: docId, learned }))
export const deleteDocument = (docId, hard = false) =>
  unwrap(http.post('/v1/document/delete', { doc_id: docId, hard }))

export const listVersions = (sourceId) =>
  unwrap(http.get('/v1/versions', { params: { source_id: sourceId } }))
export const listAssets = ({ doc_id = '', asset_type = '', limit = 100, offset = 0 } = {}) =>
  unwrap(http.get('/v1/assets', { params: { doc_id, asset_type, limit, offset } }))
export const deleteAsset = (assetId) =>
  unwrap(http.post('/v1/asset/delete', { asset_id: assetId }))

export const reportHtmlUrl = (relPath) =>
  `${KB_API_BASE}/v1/report-html?path=${encodeURIComponent(relPath)}`

/* ── 摄取 / 上传 ── */
/**
 * 上传文件并提交摄取。
 * @param file      浏览器 File 对象
 * @param kbId      目标知识库
 * @param chunkStrategy 分段方式（'' / 'auto' = 交给解析器判断）
 * @param chunkSize     分段长度（字符，128-8192）
 * @param chunkOverlap  段间重叠（字符，需 < chunkSize）
 * 传了分段参数 → 服务端写进 sidecar，解析/入库时优先使用（预览与入库同口径）。
 */
export function ingestFile(
  file,
  kbId = 'default',
  { chunkStrategy = '', chunkDelimiter = '', chunkSize = null, chunkOverlap = null, force = false } = {},
) {
  const body = new FormData()
  body.append('file', file)
  // 目标知识库（缺省 default → 服务端按注册表解析投递目录）
  if (kbId) body.append('kb_id', kbId)
  if (force) body.append('force', '1')
  if (chunkStrategy && chunkStrategy !== 'auto') body.append('chunk_strategy', chunkStrategy)
  if (chunkDelimiter) body.append('chunk_delimiter', chunkDelimiter)
  if (chunkSize) body.append('chunk_size', String(chunkSize))
  if (chunkOverlap !== null && chunkOverlap !== undefined && chunkOverlap !== '') {
    body.append('chunk_overlap', String(chunkOverlap))
  }
  return unwrap(
    http.post('/v1/ingest/file', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    }),
  )
}

/* ── 导入向导：分段预览（与入库同一套分段逻辑，不落库）── */
export function previewChunks({
  filename,
  content,
  kbId = '',
  chunkStrategy = '',
  chunkDelimiter = '',
  chunkSize = null,
  chunkOverlap = null,
}) {
  const body = { filename, content }
  // kb_id 必传：后端用它取"知识库配置"里的分段默认值，决定没显式填参数时按什么切
  if (kbId) body.kb_id = kbId
  if (chunkStrategy && chunkStrategy !== 'auto') body.chunk_strategy = chunkStrategy
  // ⚠️ 分隔符必须一起传：后端在 strategy=delimiter 且缺分隔符时会直接 400
  if (chunkDelimiter) body.chunk_delimiter = chunkDelimiter
  if (chunkSize) body.chunk_size = chunkSize
  if (chunkOverlap !== null && chunkOverlap !== undefined && chunkOverlap !== '') {
    body.chunk_overlap = chunkOverlap
  }
  return unwrap(http.post('/v1/ingest/preview-chunks', body, { timeout: 300000 }))
}

/* ── 逆向：删除知识库里的文件（含索引 + 原件 + 解析产物）── */
export const deleteKbFile = (kbId, path, { mode = 'trash', dryRun = false } = {}) =>
  unwrap(
    http.post(`/kbs/${encodeURIComponent(kbId)}/file-delete`, {
      path,
      mode,
      dry_run: dryRun,
    }),
  )

/** 按 doc_id 删除（「已入库文档」列表入口） */
export const deleteKbFileDocId = (kbId, docId, { mode = 'trash', dryRun = false } = {}) =>
  unwrap(
    http.post(`/kbs/${encodeURIComponent(kbId)}/file-delete`, {
      doc_id: docId,
      mode,
      dry_run: dryRun,
    }),
  )

/** 按知识库列文档（知识库详情页的「已入库文档」列表） */
export const listKbDocuments = (kbId, { page = 1, per_page = 50, q = '', includeDeleted = false } = {}) =>
  unwrap(
    http.get('/v1/documents', {
      params: { kb_id: kbId, page, per_page, q, include_deleted: includeDeleted ? 1 : 0 },
    }),
  )


/** 上传到「待学习」：base64 JSON，服务端解析 → 四件套入库 → 触发摄取 */
export const uploadToLearn = ({ filename, content }) =>
  unwrap(http.post('/api/knowledge/upload', { filename, content }, { timeout: 300000 }))

export const submitJob = ({ file_path = '', meta_path = '', source = 'web' } = {}) =>
  unwrap(http.post('/v1/jobs/submit', { file_path, meta_path, source }))

/* ── 解析器 / 预览 ── */
export const getParsers = () => unwrap(http.get('/api/knowledge/parsers'))
export const toggleParser = (parser, enabled) =>
  unwrap(http.post('/api/knowledge/parsers/toggle', { parser, enabled }))
export const previewParse = ({ filename, content }) =>
  unwrap(http.post('/preview-parse', { filename, content }, { timeout: 300000 }))

/* ── 待处理文件 ── */
export const getPendingFiles = ({ page = 1, per_page = 50, q = '' } = {}) =>
  unwrap(http.get('/api/knowledge/pending-files', { params: { page, per_page, q } }))

/* ── 错误报告 ── */
export const listErrorReports = () => unwrap(http.get('/errors'))
export const getErrorReport = (id) => unwrap(http.get(`/errors/${encodeURIComponent(id)}`))
export const setErrorRead = (id, read = true) =>
  unwrap(http.post(`/errors/${encodeURIComponent(id)}/read`, { read }))
export const setErrorFlag = (id, flagged = true) =>
  unwrap(http.post(`/errors/${encodeURIComponent(id)}/flag`, { flagged }))
export const addErrorComment = (id, comment) =>
  unwrap(http.post(`/errors/${encodeURIComponent(id)}/comments`, { comment }))

/* ── 计划表 ── */
export const listPlans = ({ status = '', category = '', phase = '', q = '' } = {}) =>
  unwrap(http.get('/plan', { params: { status, category, phase, q } }))
export const createPlan = (payload) => unwrap(http.post('/plan', payload))
export const updatePlan = (planId, payload) =>
  unwrap(http.put(`/plan/${encodeURIComponent(planId)}`, payload))
export const deletePlan = (planId) =>
  unwrap(http.delete(`/plan/${encodeURIComponent(planId)}`))
export const addPlanComment = (planId, content, author = 'user') =>
  unwrap(http.post(`/plan/${encodeURIComponent(planId)}/comments`, { content, author }))
export const deletePlanComment = (planId, commentId) =>
  unwrap(http.delete(`/plan/${encodeURIComponent(planId)}/comments/${encodeURIComponent(commentId)}`))

/* ── 知识库注册表（多知识库治理，阶段 2） ── */
export const listKbs = () => unwrap(http.get('/kbs'))
export const getKb = (kbId) => unwrap(http.get(`/kbs/${encodeURIComponent(kbId)}`))
export const createKb = (payload) => unwrap(http.post('/kbs', payload))
export const updateKb = (kbId, payload) =>
  unwrap(http.put(`/kbs/${encodeURIComponent(kbId)}`, payload))
export const deleteKb = (kbId, { purge = false } = {}) =>
  unwrap(http.delete(`/kbs/${encodeURIComponent(kbId)}`, { params: { purge } }))
export const getKbConfig = (kbId) => unwrap(http.get(`/kbs/${encodeURIComponent(kbId)}/config`))
export const updateKbConfig = (kbId, payload) =>
  unwrap(http.put(`/kbs/${encodeURIComponent(kbId)}/config`, payload))
export const initKbGit = (kbId) => unwrap(http.post(`/kbs/${encodeURIComponent(kbId)}/git-init`, {}))
export const getKbGitStatus = (kbId) =>
  unwrap(http.get(`/kbs/${encodeURIComponent(kbId)}/git-status`))

/* ── 知识库内容浏览（只读）── */
export const listKbTree = (kbId, { path = '', showAll = false } = {}) =>
  unwrap(http.get(`/kbs/${encodeURIComponent(kbId)}/tree`, { params: { path, show_all: showAll ? 1 : 0 } }))

export const previewKbFile = (kbId, path) =>
  unwrap(http.get(`/kbs/${encodeURIComponent(kbId)}/file`, { params: { path } }))

/* ── 文件台账（P28-B：投递文件 + 状态 + 解析信息 + 搜索/排序/过滤/分页）── */
export const getKbFiles = (kbId, { q = '', status = '', sort = 'updated', order = 'desc',
  page = 1, perPage = 50, includeDeleted = false } = {}) =>
  unwrap(http.get(`/kbs/${encodeURIComponent(kbId)}/files`, {
    params: { q, status, sort, order, page, per_page: perPage, include_deleted: includeDeleted ? 1 : 0 },
  }))

/* ── 回收站（P28-A：统计 + 按保留天数清理）── */
export const getKbTrash = (kbId) =>
  unwrap(http.get(`/kbs/${encodeURIComponent(kbId)}/trash`))

export const purgeKbTrash = (kbId, { days = null, confirm = false } = {}) => {
  const body = { confirm }
  if (days !== null && days !== undefined) body.days = days
  return unwrap(http.post(`/kbs/${encodeURIComponent(kbId)}/trash-purge`, body, { timeout: 300000 }))
}

/** 删除**单个**回收站条目（默认 dry-run，confirm=true 才真删） */
export const deleteKbTrashEntry = (kbId, name, { confirm = false } = {}) =>
  unwrap(http.post(`/kbs/${encodeURIComponent(kbId)}/trash-delete`, { name, confirm },
    { timeout: 300000 }))

/** 按删除清单把某个回收站条目**还原回原相对路径**（默认 dry-run 只预演） */
export const restoreKbTrashEntry = (kbId, name, { dryRun = true, overwrite = false } = {}) =>
  unwrap(http.post(`/kbs/${encodeURIComponent(kbId)}/trash-restore`,
    { name, dry_run: dryRun, overwrite }, { timeout: 300000 }))

export const getKbOverview = (kbId, path = '', showAll = false) =>
  unwrap(http.get(`/kbs/${encodeURIComponent(kbId)}/overview`, { params: { path, show_all: showAll ? 1 : 0 } }))

/** 生成 OV 风格目录摘要（L0+L1），本地模型较慢，给足超时 */
export const generateKbOverview = (kbId, { path = '', force = true, showAll = false } = {}) =>
  unwrap(
    http.post(
      `/kbs/${encodeURIComponent(kbId)}/overview`,
      { path, force, show_all: showAll },
      { timeout: 900000 },
    ),
  )

/** 原始文件 URL（图片 / PDF 直出用，只读） */
export const kbRawUrl = (kbId, path) =>
  `${KB_API_BASE}/kbs/${encodeURIComponent(kbId)}/raw?path=${encodeURIComponent(path)}`
