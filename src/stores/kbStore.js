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
    async search(q) {
      this.loading = true
      this.searchQuery = q
      try {
        this.searchResults = await searchKB(q)
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
      this.documents = await getDocuments()
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
