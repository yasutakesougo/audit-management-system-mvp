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
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- import.meta is supported in the Vite Node runtime
const emptyShim = fileURLToPath(new URL('./src/shims/empty.ts', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': srcDir,
      '@/adapters': resolve(srcDir, 'adapters'),
      '@fluentui/react': fluentStub,
      'node:fs': emptyShim,
      crypto: emptyShim,
    },
  },
  server: {
    host: 'localhost',
    port: 3000,
    strictPort: true,
    https: false,
    proxy: {
      '/sharepoint-api': {
        target: 'https://isogokatudouhome.sharepoint.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sharepoint-api/, ''),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
})
