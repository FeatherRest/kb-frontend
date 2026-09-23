<template>
  <div class="lc-page">
    <!-- ── 工具条 ── -->
    <div class="lc-toolbar">
      <n-input
        v-model:value="query"
        placeholder="检索概念图（向量 + 全文混合，与 Agent 的 MCP 检索同一条路径）"
        clearable
        @keyup.enter="doSearch"
      />
      <n-button type="primary" :loading="searching" @click="doSearch">检索</n-button>
      <n-button quaternary :loading="loading" @click="refreshAll">刷新</n-button>
    </div>

    <n-alert v-if="error" type="error" closable class="lc-alert" @close="error = ''">{{ error }}</n-alert>

    <!-- ── 概览 ── -->
    <div class="lc-stats">
      <div v-for="c in statCards" :key="c.label" class="lc-stat">
        <div class="lc-stat-value">{{ c.value }}</div>
        <div class="lc-stat-label">{{ c.label }}</div>
      </div>
    </div>

    <!-- ── 主体：页树 / 正文 / 图+来源 ── -->
    <div class="lc-main">
      <!-- 左：概念页（按 cluster 折叠） -->
      <n-card size="small" class="lc-card" :title="`概念页 (${pages.length})`">
        <n-input v-model:value="filter" size="small" placeholder="过滤" clearable class="lc-filter" />
        <n-collapse v-model:expanded-names="expandedNames">
          <n-collapse-item
            v-for="g in grouped"
            :key="g.cluster"
            :name="g.cluster"
            :title="`${g.cluster} (${g.pages.length})`"
          >
            <div
              v-for="p in g.pages"
              :key="p.slug"
              class="lc-page-item"
              :class="{ 'is-active': p.slug === currentSlug }"
              @click="openPage(p.slug)"
            >
              <div class="lc-page-title">{{ p.title || p.slug }}</div>
              <div class="lc-page-meta">
                入链 {{ p.links_in }} · 出链 {{ p.links_out }} · {{ p.words }} 字
                <n-tag v-if="p.synthesised_into" size="tiny" type="warning" :bordered="false">合成页</n-tag>
              </div>
            </div>
          </n-collapse-item>
        </n-collapse>
      </n-card>

      <!-- 中：正文 -->
      <n-card size="small" class="lc-card lc-reader">
        <template #header>
          <span>{{ current?.title || '选择左侧任一页面' }}</span>
        </template>
        <template #header-extra>
          <n-tag v-if="current" size="tiny" :bordered="false">{{ current.cluster }}</n-tag>
        </template>
        <n-spin :show="loadingPage">
          <div v-if="current" class="lc-body">
            <div class="lc-tags">
              <n-tag v-for="t in current.tags" :key="t" size="tiny" round :bordered="false">{{ t }}</n-tag>
            </div>
            <!-- 正文由 markdown-it(html:false) 渲染 → 原始 HTML 被转义，不执行脚本 -->
            <div class="lc-md" @click="onBodyClick" v-html="renderedBody" />
            <n-divider />
            <div class="lc-links">
              <div class="lc-links-block">
                <div class="lc-links-title">出链（{{ current.links_out.length }}）</div>
                <n-tag
                  v-for="l in current.links_out"
                  :key="`o-${l.target}`"
                  size="small"
                  class="lc-link-tag"
                  :type="l.resolved ? 'info' : 'error'"
                  :bordered="false"
                  @click="l.resolved && openPage(l.target)"
                >
                  {{ l.target }}{{ l.resolved ? '' : ' (缺失)' }}
                </n-tag>
              </div>
              <div class="lc-links-block">
                <div class="lc-links-title">入链（{{ current.links_in.length }}）</div>
                <n-tag
                  v-for="l in current.links_in"
                  :key="`i-${l.source}`"
                  size="small"
                  class="lc-link-tag"
                  :bordered="false"
                  @click="openPage(l.source)"
                >
                  {{ l.source }}
                </n-tag>
              </div>
            </div>
          </div>
          <n-empty v-else description="点左侧或关系图里的任一项查看正文" />
        </n-spin>
      </n-card>

      <!-- 右：关系图 + 来源 -->
      <div class="lc-side">
        <n-card size="small" class="lc-card lc-card-graph" :title="`关系图 (${graph.nodes.length} 页 / ${graph.edges.length} 链接)`">
          <LacunaGraph
            :nodes="graph.nodes"
            :edges="graph.edges"
            :active="currentSlug"
            @select="openPage"
          />
          <div class="lc-legend">圆点大小 = 入链数 · 虚线 = 指向不存在的页</div>
        </n-card>
        <n-card size="small" class="lc-card" :title="`来源 (${sources.length})`">
          <n-data-table
            :columns="sourceColumns"
            :data="sources"
            :bordered="false"
            :single-line="false"
            size="small"
            :max-height="260"
            :row-key="(r) => r.slug"
          />
        </n-card>
      </div>
    </div>

    <!-- ── 检索结果 ── -->
    <n-card v-if="hits.length" size="small" class="lc-card lc-hits" :title="`检索结果（${hits.length}）· 查询：${lastQuery}`">
      <div v-for="(h, i) in hits" :key="`h${i}`" class="lc-hit" @click="openPage(h.slug)">
        <div class="lc-hit-main">
          <span class="lc-hit-slug">{{ h.slug }}</span>
          <span class="lc-hit-section">› {{ h.section }}</span>
          <n-tag size="tiny" :bordered="false">{{ h.mechanism }}</n-tag>
          <n-tag v-if="h.source_type" size="tiny" type="info" :bordered="false">{{ h.source_type }}</n-tag>
        </div>
        <div class="lc-hit-text">{{ h.content }}</div>
      </div>
    </n-card>
  </div>
</template>

<script setup>
/**
 * lacuna 概念图只读面板。
 *
 * 数据源：kb-api 的 `/v1/lacuna/*` 只读代理 → lacuna daemon（DuckDB 单写库，前端不能直连）。
 * 本页**不做任何写操作**（同步/扫描/入库都不在这里）；要写就走 CLI 或让 Agent 执行。
 */
import { computed, onActivated, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import LacunaGraph from '../components/LacunaGraph.vue'
import {
  getLacunaGraph,
  getLacunaPage,
  getLacunaPages,
  getLacunaSources,
  getLacunaStatus,
  lacunaSearch,
} from '../api/kbApi.js'

const status = ref(null)
const pages = ref([])
const sources = ref([])
const graph = ref({ nodes: [], edges: [] })
const current = ref(null)
const hits = ref([])
const query = ref('')
const filter = ref('')
const lastQuery = ref('')
const loading = ref(false)
const loadingPage = ref(false)
const searching = ref(false)
const error = ref('')

const currentSlug = computed(() => current.value?.slug || '')

/* ── markdown 渲染（html:false → 内容里的原始 HTML 会被转义，不会执行） ── */
const md = new MarkdownIt({ html: false, linkify: true, breaks: false })

const stripFrontmatter = (text) => String(text || '').replace(/^---\n[\s\S]*?\n---\n?/, '')

/** `[[slug]]` / `[[slug|文字]]` 在渲染后的 HTML 里变成可点链接（slug 走白名单过滤） */
function linkifyWiki(html) {
  return html.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_m, target, label) => {
    const slug = String(target).trim().replace(/\.(md|pdf|txt)$/i, '')
    const safe = slug.replace(/[^A-Za-z0-9._\u4e00-\u9fff-]/g, '')
    const text = (label || target).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
    return `<a class="lc-wikilink" data-slug="${safe}">${text}</a>`
  })
}

const renderedBody = computed(() =>
  current.value ? linkifyWiki(md.render(stripFrontmatter(current.value.body))) : '',
)

/* ── 概览卡片（字段名带空格，是 lacuna 自己的口径） ── */
const statCards = computed(() => {
  const t = status.value?.tables || {}
  const s = status.value?.sweep || {}
  return [
    { label: '概念页', value: t.pages ?? '—' },
    { label: '段落', value: t.sections ?? '—' },
    { label: '链接', value: t.links ?? '—' },
    { label: '来源', value: t.sources ?? '—' },
    { label: '源分块', value: t.source_chunks ?? '—' },
    { label: '论断', value: t.claims ?? '—' },
    { label: '研究缺口', value: s['research gaps'] ?? '—' },
    { label: '待扫描', value: s['sweep backlog'] ?? '—' },
    { label: '合成队列', value: s['synthesis queue'] ?? '—' },
    { label: '合成页', value: s['synthesised pages'] ?? '—' },
  ]
})

const grouped = computed(() => {
  const f = filter.value.trim().toLowerCase()
  const map = new Map()
  for (const p of pages.value) {
    if (f && !`${p.slug} ${p.title || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(f)) continue
    const key = p.cluster || '未分类'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(p)
  }
  return [...map.entries()]
    .map(([cluster, list]) => ({
      cluster,
      pages: [...list].sort((a, b) => (b.links_in ?? 0) - (a.links_in ?? 0) || a.slug.localeCompare(b.slug)),
    }))
    .sort((a, b) => b.pages.length - a.pages.length || a.cluster.localeCompare(b.cluster))
})
const expandedNames = ref([])

const sourceColumns = [
  { title: '源', key: 'slug', ellipsis: { tooltip: true } },
  { title: '类型', key: 'source_type', width: 74 },
  { title: '块', key: 'chunks', width: 54 },
  { title: '文件', key: 'path', ellipsis: { tooltip: true } },
]

/* ── 取数 ── */
async function refreshAll() {
  loading.value = true
  error.value = ''
  try {
    const [st, pg, sc, gr] = await Promise.all([
      getLacunaStatus(),
      getLacunaPages(),
      getLacunaSources(),
      getLacunaGraph(),
    ])
    status.value = st
    pages.value = pg.pages || []
    sources.value = sc.sources || []
    graph.value = { nodes: gr.nodes || [], edges: gr.edges || [] }
    // 折叠组默认全展开；只在首次拿到数据时设一次，之后尊重用户手动的收起/展开
    if (!expandedNames.value.length) {
      expandedNames.value = [...new Set(pages.value.map((p) => p.cluster || '未分类'))]
    }
  } catch (e) {
    error.value = `读取 lacuna 失败：${e.message}`
  } finally {
    loading.value = false
  }
}

async function openPage(slug) {
  if (!slug) return
  loadingPage.value = true
  error.value = ''
  try {
    current.value = await getLacunaPage(slug)
  } catch (e) {
    error.value = `打开「${slug}」失败：${e.message}`
  } finally {
    loadingPage.value = false
  }
}

async function doSearch() {
  const q = query.value.trim()
  if (!q) {
    hits.value = []
    return
  }
  searching.value = true
  error.value = ''
  try {
    const res = await lacunaSearch(q, { scope: 'all', n: 10 })
    hits.value = res.hits || []
    lastQuery.value = res.query || q
    if (!hits.value.length) error.value = `「${q}」在概念图和源里都没有命中`
  } catch (e) {
    error.value = `检索失败：${e.message}`
  } finally {
    searching.value = false
  }
}

/** 正文里的 wikilink 点击 → 打开对应页（data-slug 由 linkifyWiki 生成） */
function onBodyClick(event) {
  const slug = event.target?.dataset?.slug
  if (slug) openPage(slug)
}

// App.vue 用 <keep-alive>：用 onActivated 才能在「切走再回来」时重新拉数（首次挂载也会触发）。
// 只用 onMounted 的话，Agent 期间新入库的概念页在本页看不到（本 skill 铁律 14）。
onActivated(refreshAll)
</script>

<style scoped>
.lc-page {
  padding: 12px;
}
.lc-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.lc-alert {
  margin-bottom: 10px;
}
.lc-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.lc-stat {
  flex: 1 1 92px;
  min-width: 92px;
  padding: 8px 10px;
  border: 1px solid #efeff5;
  border-radius: 8px;
  background: #fafafc;
}
.lc-stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #2080f0;
  line-height: 1.2;
}
.lc-stat-label {
  font-size: 12px;
  color: #909399;
}
.lc-main {
  display: grid;
  grid-template-columns: minmax(200px, 240px) minmax(320px, 1fr) minmax(280px, 360px);
  gap: 12px;
  align-items: start;
}
.lc-card {
  min-width: 0;
}
.lc-filter {
  margin-bottom: 8px;
}
.lc-page-item {
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.lc-page-item:hover {
  background: #f5f7fa;
}
.lc-page-item.is-active {
  background: #eaf4ff;
}
.lc-page-title {
  font-size: 13px;
  line-height: 1.35;
  word-break: break-word;
}
.lc-page-meta {
  font-size: 11px;
  color: #909399;
}
.lc-body {
  max-height: 62vh;
  overflow: auto;
}
.lc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.lc-md {
  font-size: 13px;
  line-height: 1.65;
  word-break: break-word;
}
.lc-md :deep(h1),
.lc-md :deep(h2),
.lc-md :deep(h3) {
  font-size: 15px;
  margin: 10px 0 6px;
}
.lc-md :deep(table) {
  border-collapse: collapse;
  font-size: 12px;
  display: block;
  overflow-x: auto;
}
.lc-md :deep(th),
.lc-md :deep(td) {
  border: 1px solid #ebedf0;
  padding: 2px 6px;
}
.lc-md :deep(blockquote) {
  margin: 6px 0;
  padding-left: 8px;
  border-left: 3px solid #e0e0e6;
  color: #666;
}
.lc-md :deep(.lc-wikilink) {
  color: #2080f0;
  cursor: pointer;
  text-decoration: underline dotted;
}
.lc-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lc-links-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.lc-link-tag {
  margin: 0 4px 4px 0;
  cursor: pointer;
}
.lc-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.lc-legend {
  font-size: 11px;
  color: #909399;
  margin-top: 4px;
}
.lc-hits {
  margin-top: 12px;
}
.lc-hit {
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.lc-hit:hover {
  background: #f5f7fa;
}
.lc-hit-main {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.lc-hit-slug {
  font-weight: 600;
  font-size: 13px;
}
.lc-hit-section {
  font-size: 12px;
  color: #666;
}
.lc-hit-text {
  font-size: 12px;
  color: #555;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 窄屏：三列叠成一列（页树 → 正文 → 图/来源） */
@media (max-width: 900px) {
  .lc-main {
    grid-template-columns: 1fr;
  }
  .lc-body {
    max-height: none;
  }
}
</style>
