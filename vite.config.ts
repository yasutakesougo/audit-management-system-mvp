import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@fluentui/react': fileURLToPath(new URL('./src/stubs/fluentui-react.tsx', import.meta.url)),
    },
  },
  server: {
    host: 'localhost',
    port: 3000,
    strictPort: true,
    https: false,
  },
})
