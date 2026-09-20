import { defineStore } from 'pinia'
import { getHealth, getStats, searchKB, listKbs } from '../api/kbApi.js'

const HISTORY_KEY = 'kbSearchHistory'
const KB_ID_KEY = 'kbCurrentKbId'
const MAX_HISTORY = 20

export const useKbStore = defineStore('kb', {
  state: () => ({
    /** 原始排序结果（未重排） */
    rawResults: [],
    /** CrossEncoder 重排后的结果 */
    rerankedResults: [],
    /** 当前展示哪一份：raw | reranked */
    viewMode: 'raw',
    searchQuery: '',
    searchMode: 'hybrid',
    rerankRequested: false,
    timing: null,
    reranked: false,
    searchHistory: readHistory(),
    stats: null,
    health: null,
    loading: false,
    rerankLoading: false,
    error: '',
    /** 当前选中的知识库 ID（默认 'default'） */
    currentKbId: localStorage.getItem(KB_ID_KEY) || 'default',
    /** 知识库列表（缓存，用于选择器） */
    kbList: [],
  }),
  getters: {
    /** 当前视图的结果（搜索页直接用这个） */
    searchResults: (s) => (s.viewMode === 'reranked' ? s.rerankedResults : s.rawResults),
    hasResults: (s) =>
      (s.viewMode === 'reranked' ? s.rerankedResults : s.rawResults).length > 0,
    /** 是否存在可对比的双视图 */
    canCompare: (s) => s.rerankedResults.length > 0 && s.rawResults.length > 0,
  },
  actions: {
    async search({ q, mode = null, top_k = 8, rerank = null, kb_id = '', silent = false }) {
      const query = (q ?? this.searchQuery).trim()
      if (!query) return
      this.searchQuery = query
      if (mode) this.searchMode = mode
      if (!silent) {
        this.loading = true
        this.rerankLoading = Boolean(rerank)
        this.error = ''
      }
      try {
        const data = await searchKB({
          q: query,
          top_k,
          mode: this.searchMode,
          rerank,
          kb_id,
        })
        const results = Array.isArray(data) ? data : data.results || []
        if (rerank === true) {
          // 保留重排前的排序，供「原始 / 重排后」对比
          if (!this.rawResults.length) this.rawResults = [...this.searchResults]
          this.rerankedResults = results
          this.viewMode = 'reranked'
          this.rerankRequested = true
        } else {
          this.rawResults = results
          this.rerankedResults = []
          this.viewMode = 'raw'
          this.rerankRequested = Boolean(data.reranked)
        }
        this.timing = data.timing || null
        this.reranked = Boolean(data.reranked)
        pushHistory(this, query)
      } catch (e) {
        this.error = e.message
        if (!silent) {
          this.rawResults = []
          this.rerankedResults = []
        }
      } finally {
        this.loading = false
        this.rerankLoading = false
      }
    },
    setView(mode) {
      this.viewMode = mode === 'reranked' ? 'reranked' : 'raw'
    },
    /** 用 CrossEncoder 对当前查询重排（服务端 rerank=true 重新检索） */
    async rerank() {
      if (!this.searchQuery) return
      await this.search({ q: this.searchQuery, rerank: true })
    },
    clearHistory() {
      this.searchHistory = []
      localStorage.removeItem(HISTORY_KEY)
    },
    async loadStats() {
      try {
        this.stats = await getStats()
      } catch {
        this.stats = null
      }
    },
    async loadKbList() {
      try {
        const data = await listKbs()
        this.kbList = data.kbs || []
      } catch {
        this.kbList = []
      }
    },
    setCurrentKb(kbId) {
      this.currentKbId = kbId || 'default'
      localStorage.setItem(KB_ID_KEY, this.currentKbId)
    },
    async checkHealth() {
      try {
        this.health = await getHealth()
      } catch {
        this.health = { status: 'unreachable' }
      }
    },
  },
})

function readHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function pushHistory(store, q) {
  const list = store.searchHistory.filter((x) => x !== q)
  list.unshift(q)
  store.searchHistory = list.slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(store.searchHistory))
}
