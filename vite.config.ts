import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const asanaProxy = {
  '/asana': {
    target: 'https://app.asana.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/asana/, '/api/1.0'),
  },
}

export default defineConfig({
  plugins: [vue()],
  server: { port: 5199, proxy: asanaProxy },
  preview: { port: 5199, proxy: asanaProxy },
})
