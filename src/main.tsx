

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getEnv, readString } from './lib/env';

// --- Runtime env loader: injects public/env.runtime.json into globalThis.__ENV before app start ---
async function injectRuntimeEnv() {
  try {
    const res = await fetch('/env.runtime.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      globalThis.__ENV = { ...(globalThis.__ENV || {}), ...data };
      // Optional: log loaded runtime env
      if (import.meta.env.DEV) {
        console.info('[env.runtime.json loaded]', data);
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('Failed to load env.runtime.json:', e);
    }
  }
}

// Wait for runtime env before rendering React
injectRuntimeEnv().then(() => {
  // --- 開発時の環境変数デバッグログ ---
  // アプリケーションの起動時に、Viteから渡された主要な環境変数をコンソールに出力します。
  // これにより、.env ファイルの読み込みやビルド時の値の注入が期待通りかを確認できます。
  if (import.meta.env.DEV) {
    const e = getEnv();
    console.info('[ENV]', {
      NODE_ENV: e.NODE_ENV,
      MODE: e.MODE,
      VITE_SP_RESOURCE: readString('VITE_SP_RESOURCE', ''),
      VITE_SP_SITE_RELATIVE: readString('VITE_SP_SITE_RELATIVE', ''),
      VITE_SP_SCOPE_DEFAULT: readString('VITE_SP_SCOPE_DEFAULT', ''),
    });
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});