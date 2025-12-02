import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { cloudflare } from '@cloudflare/vite-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), cloudflare()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~components': path.resolve(__dirname, './src/components'),
      '~composables': path.resolve(__dirname, './src/composables'),
      '~locales': path.resolve(__dirname, './src/locales'),
      '~services': path.resolve(__dirname, './src/services'),
      '~repository': path.resolve(__dirname, './src/services/repository'),
    },
  },
})
