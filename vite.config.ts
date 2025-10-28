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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          const normalized = id.replace(/\\/g, '/');
          if (
            normalized.includes('/@babel/runtime/')
          ) {
            return 'babel-helpers'
          }
          if (
            normalized.includes('/node_modules/react/') ||
            normalized.includes('/node_modules/react-dom/') ||
            normalized.includes('/node_modules/scheduler/') ||
            normalized.includes('/@emotion/')
          ) {
            return 'react';
          }
          if (normalized.includes('/@mui/icons-material/')) {
            return 'mui-icons';
          }
          if (normalized.includes('/@mui/material/')) {
            return undefined;
          }
          if (
            normalized.includes('/@mui/system/') ||
            normalized.includes('/@mui/base/') ||
            normalized.includes('/@mui/styled-engine/') ||
            normalized.includes('/@mui/utils/') ||
            normalized.includes('/@mui/private-')
          ) {
            return undefined;
          }
          if (normalized.includes('/@mui/x-data-grid')) {
            return 'datagrid';
          }
          if (
            normalized.includes('/react-markdown/') ||
            normalized.includes('/remark-') ||
            normalized.includes('/rehype-') ||
            normalized.includes('/micromark/')
          ) {
            return 'markdown';
          }
          if (normalized.includes('recharts')) {
            return 'charting';
          }
          return undefined;
        },
      },
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
