import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/search' },
  { path: '/search', name: 'Search', component: () => import('../views/SearchView.vue') },
  { path: '/ingest', name: 'Ingest', component: () => import('../views/IngestView.vue') },
  { path: '/admin', name: 'Admin', component: () => import('../views/AdminView.vue') },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
