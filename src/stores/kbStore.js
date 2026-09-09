import { defineStore } from 'pinia'
import { searchKB, getDocuments, getStats, healthCheck } from '../api/kbApi'

export const useKbStore = defineStore('kb', {
  state: () => ({
    searchResults: [],
    searchQuery: '',
    searchHistory: JSON.parse(localStorage.getItem('kbSearchHistory') || '[]'),
    documents: [],
    stats: null,
    health: null,
    loading: false,
  }),
  actions: {
    async search(q, mode = 'hybrid') {
      this.loading = true
      this.searchQuery = q
      try {
        const data = await searchKB(q, 8, mode)
        this.searchResults = Array.isArray(data) ? data : (data.results || [])
        if (q && !this.searchHistory.includes(q)) {
          this.searchHistory.unshift(q)
          if (this.searchHistory.length > 20) this.searchHistory.pop()
          localStorage.setItem('kbSearchHistory', JSON.stringify(this.searchHistory))
        }
      } finally {
        this.loading = false
      }
    },
    async loadDocuments() {
      const data = await getDocuments()
      this.documents = Array.isArray(data) ? data : (data.documents || [])
    },
    async loadStats() {
      this.stats = await getStats()
    },
    async checkHealth() {
      try {
        this.health = await healthCheck()
      } catch { this.health = { status: 'unreachable' } }
    },
  },
})
