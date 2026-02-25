import { clearEnvCache, type EnvRecord, getRuntimeEnv, IS_DEV as isDev } from '@/lib/env';
import { guardProdMisconfig } from '@/lib/envGuards';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { installFatalHandlers } from './bootstrapFatal';
import { beginHydrationSpan, finalizeHydrationSpan } from './lib/hydrationHud';

// Install fatal error handlers BEFORE any other code executes
installFatalHandlers();



declare global {
  interface Window {
    __ENV__?: EnvRecord;
    __FLAGS__?: unknown;
    __MSAL_REDIRECT_DONE__?: boolean;
    __spFetch__?: unknown;
  }
}

// NOTE: Do NOT call guardProdMisconfig() here - it needs runtime env to be loaded first!
// Call it after ensureRuntimeEnv() completes below.

const RUNTIME_PATH_KEYS = new Set(['RUNTIME_ENV_PATH', 'VITE_RUNTIME_ENV_PATH']);



const getRuntimeEnvPath = (runtimeEnv: EnvRecord): string => {
  if (typeof window === 'undefined') return '';
  const fromWindow = window.__ENV__?.RUNTIME_ENV_PATH ?? window.__ENV__?.VITE_RUNTIME_ENV_PATH;
  const anyEnv = runtimeEnv as Record<string, unknown>;
  const fromRuntime = typeof anyEnv.RUNTIME_ENV_PATH === 'string' ? anyEnv.RUNTIME_ENV_PATH : (typeof anyEnv.VITE_RUNTIME_ENV_PATH === 'string' ? anyEnv.VITE_RUNTIME_ENV_PATH : undefined);
  return String(fromWindow || fromRuntime || '/env.runtime.json');
};

// Ensure localStorage is fully functional in JSDOM (prevents shallow mock clobbering)
if (typeof window !== 'undefined') {
  class MockStorage implements Storage {
    private store: Record<string, string> = {};
    get length() { return Object.keys(this.store).length; }
    clear() { this.store = {}; }
    getItem(key: string) { return this.store[key] || null; }
    key(index: number) { return Object.keys(this.store)[index] || null; }
    removeItem(key: string) { delete this.store[key]; }
    setItem(key: string, value: string) { this.store[key] = String(value); }
  }

  if (!window.localStorage || typeof window.localStorage.clear !== 'function') {
    const mock = new MockStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mock,
      writable: true,
      configurable: true,
    });
    // For Vitest isolation
    if (typeof vi !== 'undefined' && vi.stubGlobal) {
      vi.stubGlobal('localStorage', mock);
    }
  }
}

const loadRuntimeEnvFile = async (runtimeEnv: EnvRecord): Promise<EnvRecord> => {
  if (typeof window === 'undefined') return {} as EnvRecord;
  const path = getRuntimeEnvPath(runtimeEnv);
  if (!path) return {} as EnvRecord;

  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.warn(`[env] runtime config fetch failed: ${response.status} ${response.statusText}`);
      }
      return {} as EnvRecord;
    }

    const data = (await response.json()) as EnvRecord;
    return data ?? {} as EnvRecord;
  } catch (error) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn('[env] runtime config fetch error', error);
    }
    return {} as EnvRecord;
  }
};

const ensureRuntimeEnv = async (): Promise<EnvRecord> => {
  const baseEnv = getRuntimeEnv();

  if (typeof window === 'undefined') {
    return baseEnv as EnvRecord;
  }

  const existing = window.__ENV__ ?? ({} as EnvRecord);
  const hasRuntimeOverrides = Object.keys(existing).some((key) => !RUNTIME_PATH_KEYS.has(key));
  const runtimeOverrides = hasRuntimeOverrides
    ? { ...existing }
    : await loadRuntimeEnvFile({ ...baseEnv, ...existing });

  const merged = { ...baseEnv, ...runtimeOverrides } as EnvRecord;
  window.__ENV__ = merged;
  clearEnvCache();

  if (isDev) {
    // 🎯 開発時ログを要点に絞って表示
    const keyEnvKeys = Object.keys(merged).filter(key =>
      key.startsWith('VITE_') || key === 'MODE' || key === 'NODE_ENV'
    );
    const keyEnv = Object.fromEntries(keyEnvKeys.map(key => [key, (merged as EnvRecord)[key]]));
    // eslint-disable-next-line no-console
    console.info('[env] runtime loaded:', keyEnv, `(+${Object.keys(merged).length - keyEnvKeys.length} more)`);
  }
  return merged;
};

/**
 * Loading fallback for Suspense boundary
 * Shows during lazy component loading (prevents white screen on slow networks)
 */
const SuspenseFallback = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#fafafa',
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #1976d2',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px',
        }}
      />
      <div style={{ fontSize: '14px', color: '#666' }}>読み込み中...</div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  </div>
);

const bootstrap = async () => {
  const beginTime = performance.now();
  const hydrationSpan = beginHydrationSpan('bootstrap', { group: 'hydration' });

  // 1. Runtime Env Loading (Essential for all subsequent steps)
  // We MUST wait for this before lazy loading other modules that depend on 'env'
  const envSnapshot = await ensureRuntimeEnv();

  // 2. Parallel Loading of core infrastructure & UI
  const modulesPromise = Promise.all([
    import('./app/ConfigErrorBoundary'),
    import('./lib/debugLogger'),
    import('./config/featureFlags')
  ]);
  const appPromise = import('./App');

  try {
    // 🔧 runtime env を最優先で適用してからモジュールを読み込み
    // (envPromise は既に await ensureRuntimeEnv() で完了済み)

    // ✅ NOW that runtime env is loaded, check for production misconfigurations
    guardProdMisconfig();

    const [modules, appModule] = await Promise.all([modulesPromise, appPromise]);
    const [{ ConfigErrorBoundary }, , featureFlagsModule] = modules;
    const { default: App } = appModule;
    const { FeatureFlagsProvider, resolveFeatureFlags } = featureFlagsModule;
    const flags = resolveFeatureFlags(envSnapshot as EnvRecord);

    const completeRender = beginHydrationSpan('bootstrap:render', { group: 'hydration', meta: { budget: 60 } });

    const rootElement = document.getElementById('root');
    if (!rootElement) throw new Error('Failed to find the root element');

    const root = ReactDOM.createRoot(rootElement);

    // Final Render Assembly
    root.render(
      <React.StrictMode>
        <ConfigErrorBoundary>
          <FeatureFlagsProvider value={flags}>
            <React.Suspense fallback={<SuspenseFallback />}>
              <App />
            </React.Suspense>
          </FeatureFlagsProvider>
        </ConfigErrorBoundary>
      </React.StrictMode>
    );

    completeRender();
    finalizeHydrationSpan(hydrationSpan);

    if (isDev) {
      const elapsed = (performance.now() - beginTime).toFixed(1);
      // eslint-disable-next-line no-console
      console.info(`[bootstrap] Ready in ${elapsed}ms`);
    }

  } catch (error) {
    finalizeHydrationSpan(hydrationSpan, { error: true });
    // eslint-disable-next-line no-console
    console.error('[bootstrap] Failed', error);

    // Fallback: render basic error UI if entry fails
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const root = ReactDOM.createRoot(rootElement);
      root.render(
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h1 style={{ color: '#d32f2f' }}>Fatal Initialization Error</h1>
          <p>アプリケーションの起動に失敗しました。管理者にお問い合わせください。</p>
          <pre style={{ fontSize: '10px', color: '#666', marginTop: '20px' }}>
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <button
            onClick={() => {
              clearEnvCache();
              window.location.reload();
            }}
            style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}
          >
            キャッシュをクリアして再試行
          </button>
        </div>
      );
    }
  }
};

// 起動
void bootstrap();
