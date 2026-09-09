import axios from 'axios'

const API = import.meta.env.VITE_KB_API || 'http://localhost:9999'

const api = axios.create({ baseURL: API, timeout: 15000 })

export function searchKB(q, top_k = 5, scope = 'open') {
  return api.post('/v1/search', { q, top_k, scope }).then(r => r.data)
}

export function ingestDoc(meta_path) {
  return api.post('/v1/ingest', { meta_path }).then(r => r.data)
}

export function getDocuments(scope = 'open', limit = 50) {
  return api.get('/v1/documents', { params: { scope, limit } }).then(r => r.data)
}

export function getStats() {
  return api.get('/v1/stats').then(r => r.data)
}

export function healthCheck() {
  return api.get('/v1/health').then(r => r.data)
}
