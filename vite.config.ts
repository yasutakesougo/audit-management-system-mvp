import react from '@vitejs/plugin-react'
import { splitVendorChunkPlugin, defineConfig } from 'vite';
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- import.meta is supported in the Vite Node runtime
const srcDir = fileURLToPath(new URL('./src', import.meta.url))
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- import.meta is supported in the Vite Node runtime
const fluentStub = fileURLToPath(new URL('./src/stubs/fluentui-react.tsx', import.meta.url))

export default defineConfig({
  plugins: [react(), splitVendorChunkPlugin()],
  resolve: {
    alias: {
      '@': srcDir,
      '@/adapters': resolve(srcDir, 'adapters'),
      '@fluentui/react': fluentStub,
    },
  },
  build: {
    chunkSizeWarningLimit: 1200, // 一旦ゆるめる（後で下げ直す）
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@mui')) return 'mui';
            if (id.includes('dayjs') || id.includes('date-fns')) return 'dates';
            if (id.includes('@pnp')) return 'sharepoint';
            if (id.includes('xlsx') || id.includes('pdf') || id.includes('jspdf')) return 'exporters';
            if (id.includes('bpmn')) return 'bpmn';
            return 'vendor';
          }
          // 大きめの機能ページを塊に
          if (id.includes('IndividualSupportManagementPage')) return 'page-individual-support';
          if (id.includes('SupportPlanGuidePage')) return 'page-support-plan';
          if (id.includes('HealthRecordTabletMock')) return 'page-health-record';
        },
      },
    },
  },
  server: {
    host: true,
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
