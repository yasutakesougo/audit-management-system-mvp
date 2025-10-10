import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- import.meta is supported in the Vite Node runtime
const srcDir = fileURLToPath(new URL('./src', import.meta.url))
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- import.meta is supported in the Vite Node runtime
const fluentStub = fileURLToPath(new URL('./src/stubs/fluentui-react.tsx', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': srcDir,
      '@/adapters': resolve(srcDir, 'adapters'),
      '@fluentui/react': fluentStub,
    },
  },
  server: {
    host: 'localhost',
    port: 3000,
    strictPort: true,
    https: false,
  },
})
