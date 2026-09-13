import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 路由与 Dashboard KnowledgePage 的 tab 一一对应：
 *   search  搜索   zones 专区   pending 待处理   preview 文档解析
 *   parsers 解析器  plan 计划表   kbs 知识库管理   kbs/:id/config 配置
 */
const routes = [
  { path: '/', redirect: '/search' },
  { path: '/search', name: 'Search', component: () => import('../views/SearchView.vue'), meta: { title: '搜索' } },
  { path: '/zones', name: 'Zones', component: () => import('../views/ZonesView.vue'), meta: { title: '专区' } },
  { path: '/pending', name: 'Pending', component: () => import('../views/PendingView.vue'), meta: { title: '待处理' } },
  { path: '/preview', name: 'Preview', component: () => import('../views/PreviewView.vue'), meta: { title: '文档解析' } },
  { path: '/parsers', name: 'Parsers', component: () => import('../views/ParsersView.vue'), meta: { title: '解析器' } },
  { path: '/plan', name: 'Plan', component: () => import('../views/PlanView.vue'), meta: { title: '计划表' } },
  { path: '/kbs', name: 'Kbs', component: () => import('../views/KbManageView.vue'), meta: { title: '知识库管理' } },
  {
    path: '/kbs/:id',
    name: 'KbDetail',
    component: () => import('../views/KbDetailView.vue'),
    meta: { title: '知识库' },
  },
  {
    path: '/kbs/:id/config',
    name: 'KbConfig',
    component: () => import('../views/KbConfigView.vue'),
    meta: { title: '知识库配置' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/search' },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
