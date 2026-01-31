import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

import { buildCspConfig } from './scripts/csp-headers.mjs'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- import.meta is supported in the Vite Node runtime
const srcDir = fileURLToPath(new URL('./src', import.meta.url))
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- import.meta is supported in the Vite Node runtime
const fluentStub = fileURLToPath(new URL('./src/stubs/fluentui-react.tsx', import.meta.url))
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- import.meta is supported in the Vite Node runtime
const emptyShim = fileURLToPath(new URL('./src/shims/empty.ts', import.meta.url))

export default defineConfig(({ mode }) => {
  // Load environment variables (.env.test.local will override .env.local in test mode)
  const env = loadEnv(mode, process.cwd(), '');
  
  const normalizeBase = (value: string | undefined) => (value ? value.replace(/\/?$/, '') : undefined);
  const siteUrl =
    normalizeBase(env.VITE_SP_SITE_URL) ??
    normalizeBase(env.VITE_SP_BASE_URL) ??
    (env.VITE_SP_RESOURCE && env.VITE_SP_SITE_RELATIVE
      ? `${env.VITE_SP_RESOURCE.replace(/\/?$/, '')}${env.VITE_SP_SITE_RELATIVE}`.replace(/\/?$/, '')
      : undefined) ??
    'https://isogokatudouhome.sharepoint.com/sites/welfare';

  const { headerName: cspHeaderName, headerValue: cspHeaderValue, reportToValue } = buildCspConfig({
    siteUrl,
    spResource: env.VITE_SP_RESOURCE,
    spBaseUrl: env.VITE_SP_BASE_URL,
    collectorOrigin: process.env.CSP_COLLECTOR_ORIGIN,
    collectorPrefix: process.env.CSP_PREFIX,
    collectorPort: process.env.CSP_PORT,
    enforce: process.env.CSP_ENFORCE === '1',
    disabled: process.env.CSP_DISABLE === '1',
  });

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': srcDir,
        '@/adapters': resolve(srcDir, 'adapters'),
        '@/sharepoint': resolve(srcDir, 'sharepoint'),
        '@fluentui/react': fluentStub,
        'node:fs': emptyShim,
        crypto: emptyShim,
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }
            const normalized = id.replace(/\\/g, '/');
            if (normalized.includes('/dayjs/')) {
              return 'schedule-core';
            }
            if (
              normalized.includes('/@babel/runtime/')
            ) {
              return 'babel-helpers'
            }
            if (
              normalized.includes('/node_modules/react/') ||
              normalized.includes('/node_modules/react-dom/') ||
              normalized.includes('/node_modules/scheduler/') ||
              normalized.includes('/@emotion/') ||
              normalized.includes('/@mui/icons-material/')
            ) {
              return 'react';
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
              return 'react';
            }
            if (normalized.includes('recharts')) {
              // Keep Recharts with the React bundle to avoid rollup helper cycles that
              // can break React imports (forwardRef undefined when split).
              return 'react';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      hmr: {
        host: '127.0.0.1',
        protocol: 'ws',
        clientPort: 5173,
      },
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
      middlewareMode: false,
      proxy: {
        '/sharepoint-api': {
          target: siteUrl,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/sharepoint-api/, ''),
        },
      },
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
        ...(cspHeaderName && cspHeaderValue
          ? {
              [cspHeaderName]: cspHeaderValue,
              'Report-To': reportToValue,
            }
          : {}),
      },
    },
  };
});
