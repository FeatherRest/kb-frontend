import { defineStore } from 'pinia'
import { getHealth, getStats, searchKB } from '../api/kbApi.js'

const HISTORY_KEY = 'kbSearchHistory'
const MAX_HISTORY = 20

export const useKbStore = defineStore('kb', {
  state: () => ({
    searchResults: [],
    searchQuery: '',
    searchMode: 'hybrid',
    /** rerankActive=true 表示当前结果已包含 CrossEncoder 重排排序 */
    rerankRequested: false,
    rawResults: [],
    timing: null,
    reranked: false,
    searchHistory: readHistory(),
    stats: null,
    health: null,
    loading: false,
    rerankLoading: false,
    error: '',
  }),
  getters: {
    hasResults: (s) => s.searchResults.length > 0,
  },
  actions: {
    async search({ q, mode = null, top_k = 8, rerank = null, silent = false }) {
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
        })
        const results = Array.isArray(data) ? data : data.results || []
        if (rerank === true) {
          this.rerankRequested = true
        } else if (rerank === null || rerank === undefined) {
          this.rerankRequested = Boolean(data.reranked)
        }
        this.searchResults = results
        this.timing = data.timing || null
        this.reranked = Boolean(data.reranked)
        pushHistory(this, query)
      } catch (e) {
        this.error = e.message
        if (!silent) this.searchResults = []
      } finally {
        this.loading = false
        this.rerankLoading = false
      }
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
