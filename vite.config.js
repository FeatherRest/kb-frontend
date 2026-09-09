import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/knowledge/',
  server: { port: 8081 },
  define: {
    'import.meta.env.VITE_KB_API': JSON.stringify(process.env.VITE_KB_API || '/kb/api')
  }
})
