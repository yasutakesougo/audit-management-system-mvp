import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path, { resolve } from 'node:path'
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

  // HTTPS setup (mkcert certificates) - Issue #344
  const certsDir = path.resolve(process.cwd(), '.certs');
  const certPath = path.join(certsDir, 'localhost.pem');
  const keyPath = path.join(certsDir, 'localhost-key.pem');

  const httpsConfig =
    fs.existsSync(certPath) && fs.existsSync(keyPath)
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : undefined;

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
    define: {
      'process.env': {},
    },
    plugins: [
      react(),
      {
        name: 'boot-beacon',
        transformIndexHtml(html) {
          const beacon = `
<script>
  (function () {
    // Only show beacon if ?b=1 parameter is present
    var params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    var shouldShow = params.get('b') === '1';
    if (!shouldShow) return;

    var el = document.createElement('div');
    el.id = '__boot_beacon__';
    // pointer-events: none prevents click interception
    // z-index: 1100 is above app content but below MUI modals (1200+)
    el.style.cssText = 'position:fixed;z-index:1100;right:10px;bottom:10px;padding:8px 12px;background:rgba(0,0,0,0.85);color:#0f0;font:12px/1.35 monospace;border-radius:6px;pointer-events:none;max-width:320px';
    el.textContent = 'boot:html-ok';

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'position:absolute;top:2px;right:6px;background:transparent;border:none;color:#0f0;font-size:16px;cursor:pointer;padding:0 4px;pointer-events:auto';
    closeBtn.addEventListener('click', function () { el.remove(); });

    document.addEventListener('DOMContentLoaded', function () {
      el.textContent = 'boot:dom-ok';
    });
    window.addEventListener('error', function (e) {
      var msg = (e && e.error) ? (e.error.stack || e.error.message) : (e && e.message ? e.message : 'unknown');
      el.textContent = 'boot:error ' + String(msg).substring(0, 120);
    });
    window.addEventListener('unhandledrejection', function (evt) {
      var reason = (evt && evt.reason) ? String(evt.reason) : 'unknown';
      el.textContent = 'boot:rejection ' + reason.substring(0, 120);
    });

    el.appendChild(closeBtn);
    document.documentElement.appendChild(el);
  })();
</script>`;
          return html.replace('</head>', beacon + '\n</head>');
        },
      },
      legacy({
        targets: ['safari >= 12', 'ios >= 12'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        polyfills: true,
        modernPolyfills: true,
      }),
    ],
    server: {
      https: httpsConfig, // undefined if certs don't exist (fallback to HTTP)
      host: 'localhost',
      port: 5173,
      strictPort: true,
      hmr: {
        host: 'localhost',
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
      target: ['es2019', 'safari13'],
      modulePreload: {
        polyfill: true,
      },
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
              normalized.includes('/@mui/') ||
              normalized.includes('/@emotion/')
            ) {
              return 'mui';
            }
            if (normalized.includes('/@azure/')) {
              return 'azure';
            }
            if (normalized.includes('/firebase/')) {
              return 'firebase';
            }
            if (normalized.includes('/@pnp/')) {
              return 'pnp';
            }
            if (normalized.includes('/@fullcalendar/')) {
              return 'fullcalendar';
            }
            if (normalized.includes('date-fns')) {
              return 'date-fns';
            }
            if (normalized.includes('/@mui/x-data-grid')) {
              return 'datagrid';
            }
            if (
              normalized.includes('/node_modules/react/') ||
              normalized.includes('/node_modules/react-dom/') ||
              normalized.includes('/node_modules/scheduler/') ||
              normalized.includes('/react-markdown/') ||
              normalized.includes('/react-router') ||
              normalized.includes('/react-hot-toast/') ||
              normalized.includes('/react-is/') ||
              normalized.includes('/remark-') ||
              normalized.includes('/rehype-') ||
              normalized.includes('/micromark/') ||
              normalized.includes('recharts')
            ) {
              return 'react';
            }
            // ── Heavy report libs: lazy-loaded on export ──
            if (
              normalized.includes('/xlsx/') ||
              normalized.includes('/@react-pdf/') ||
              normalized.includes('/react-pdf/')
            ) {
              return 'vendor-reports';
            }
            // ── Data / validation libs ──
            if (normalized.includes('/zod/')) {
              return 'zod';
            }
            if (normalized.includes('/@tanstack/')) {
              return 'tanstack';
            }
            // ── Catch-all: let Rollup tree-shake into importing chunks ──
            return undefined;
          },
        },
      },
    },
    preview: {
      host: 'localhost',
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
