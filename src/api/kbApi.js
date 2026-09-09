import axios from 'axios'
import { resolveKbApiBase } from './apiBase.js'

const API = resolveKbApiBase(import.meta.env.VITE_KB_API)

const api = axios.create({ baseURL: API, timeout: 15000 })

export function searchKB(q, top_k = 8, mode = 'hybrid') {
  return api.post('/v1/search', { q, top_k, mode }).then(r => r.data)
}

export function ingestFile(file) {
  const body = new FormData()
  body.append('file', file)
  return api.post('/v1/ingest/file', body).then(r => r.data)
}

export function getDocuments(limit = 50) {
  return api.get('/v1/documents', { params: { limit } }).then(r => r.data)
}

export function getStats() {
  return api.get('/v1/stats').then(r => r.data)
}

export function healthCheck() {
  return api.get('/v1/health').then(r => r.data)
}
