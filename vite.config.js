import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 构建/部署约定
 * ─────────────────────────────────────────────────────────────
 * 线上路径：nginx `location /knowledge/` → alias /home/sage/kb-frontend/dist/
 * 因此 base 必须与部署路径一致，默认 /knowledge/（可用 VITE_BASE 覆盖）。
 *
 * API 前缀：前端统一请求 `/kb/api/*`。
 *  - 生产（nginx）剥掉 /kb/api 前缀后转发到 kb-api:9999
 *  - 开发（vite proxy）不剥前缀，原样转发 → kb-api 自身会归一化 /kb/api/* 前缀
 * 两种链路下路径均落在 kb-api 的同一批端点上。
 */
const KB_API_TARGET = process.env.KB_API_TARGET || 'http://127.0.0.1:9999'

export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE || '/knowledge/',
  server: {
    port: 8081,
    host: '127.0.0.1',
    proxy: {
      '/kb/api': {
        target: KB_API_TARGET,
        changeOrigin: false,
        // 不重写路径：kb-api 自己识别并归一化 /kb/api/* 前缀
      },
    },
  },
  // 生产构建的本地校验：`npm run build && npx vite preview`
  preview: {
    port: 4173,
    host: '127.0.0.1',
    proxy: {
      '/kb/api': {
        target: KB_API_TARGET,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
})
