import React from 'react';
import ReactDOM from 'react-dom/client';
import { installFatalHandlers } from './bootstrapFatal';
import { getRuntimeEnv, isDev, clearEnvCache } from '@/env';
import { guardProdMisconfig } from '@/lib/envGuards';
import { resolveHydrationEntry } from './hydration/routes';
import { beginHydrationSpan, finalizeHydrationSpan } from './lib/hydrationHud';

// Install fatal error handlers BEFORE any other code executes
installFatalHandlers();

type EnvRecord = Record<string, string | undefined>;

type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleCallback = (deadline: IdleDeadline) => void;

type IdleHandle = number;

declare global {
  interface Window {
    __ENV__?: EnvRecord;
    __FLAGS__?: unknown;
    __MSAL_REDIRECT_DONE__?: boolean;
  }
}

// NOTE: Do NOT call guardProdMisconfig() here - it needs runtime env to be loaded first!
// Call it after ensureRuntimeEnv() completes below.

const RUNTIME_PATH_KEYS = new Set(['RUNTIME_ENV_PATH', 'VITE_RUNTIME_ENV_PATH']);

/**
 * Error Boundary for catching unhandled React errors (especially on tablet)
 * Prevents white screen by showing error message + reload button
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] React error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px',
            backgroundColor: '#f5f5f5',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>エラーが発生しました</h1>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px', maxWidth: '500px' }}>
            予期しないエラーが発生しました。下のボタンをクリックしてリロードしてください。
          </p>
          {this.state.error && (
            <details style={{ marginBottom: '20px', maxWidth: '500px', width: '100%' }}>
              <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#999' }}>
                エラー詳細を表示
              </summary>
              <pre
                style={{
                  fontSize: '11px',
                  backgroundColor: '#fff',
                  padding: '12px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  marginTop: '8px',
                  border: '1px solid #ddd',
                }}
              >
                {this.state.error.toString()}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            リロード
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 🔧 DOM lib との型競合回避のため、assertion ベースに変更
const runOnIdle = (callback: () => void, timeout = 200): void => {
  if (typeof window === 'undefined') {
    callback();
    return;
  }
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: IdleCallback, options?: { timeout: number }) => IdleHandle;
    cancelIdleCallback?: (handle: IdleHandle) => void;
  };
  const requestIdle = idleWindow.requestIdleCallback;
  if (typeof requestIdle === 'function') {
    requestIdle(() => callback(), { timeout });
    return;
  }
  window.setTimeout(callback, timeout);
};

const getRuntimeEnvPath = (runtimeEnv: EnvRecord): string => {
  if (typeof window === 'undefined') return '';
  const fromWindow = window.__ENV__?.RUNTIME_ENV_PATH ?? window.__ENV__?.VITE_RUNTIME_ENV_PATH;
  const fromRuntime = runtimeEnv.RUNTIME_ENV_PATH ?? runtimeEnv.VITE_RUNTIME_ENV_PATH;
  return fromWindow || fromRuntime || '/env.runtime.json';
};

const loadRuntimeEnvFile = async (runtimeEnv: EnvRecord): Promise<EnvRecord> => {
  if (typeof window === 'undefined') return {};
  const path = getRuntimeEnvPath(runtimeEnv);
  if (!path) return {};

  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.warn(`[env] runtime config fetch failed: ${response.status} ${response.statusText}`);
      }
      return {};
    }

    const data = (await response.json()) as EnvRecord;
    return data ?? {};
  } catch (error) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn('[env] runtime config fetch error', error);
    }
    return {};
  }
};

const ensureRuntimeEnv = async (): Promise<EnvRecord> => {
  const baseEnv = getRuntimeEnv();

  if (typeof window === 'undefined') {
    return baseEnv;
  }

  const existing = window.__ENV__ ?? {};
  const hasRuntimeOverrides = Object.keys(existing).some((key) => !RUNTIME_PATH_KEYS.has(key));
  const runtimeOverrides = hasRuntimeOverrides
    ? { ...existing }
    : await loadRuntimeEnvFile({ ...baseEnv, ...existing });

  const merged = { ...baseEnv, ...runtimeOverrides } satisfies EnvRecord;
  window.__ENV__ = merged;
  clearEnvCache();

  if (isDev) {
    // 🎯 開発時ログを要点に絞って表示
    const keyEnvKeys = Object.keys(merged).filter(key =>
      key.startsWith('VITE_') || key === 'MODE' || key === 'NODE_ENV'
    );
    const keyEnv = Object.fromEntries(keyEnvKeys.map(key => [key, merged[key]]));
    // eslint-disable-next-line no-console
    console.info('[env] runtime loaded:', keyEnv, `(+${Object.keys(merged).length - keyEnvKeys.length} more)`);
  }

  return merged;
};

const run = async (): Promise<void> => {
  const hasWindow = typeof window !== 'undefined';
  if (hasWindow && window.location.hostname === '127.0.0.1') {
    const { protocol, port, pathname, search, hash } = window.location;
    const nextUrl = `${protocol}//localhost${port ? `:${port}` : ''}${pathname}${search}${hash}`;
    window.location.replace(nextUrl);
    return;
  }
  const initialPathname = hasWindow ? window.location.pathname : '';
  const initialSearch = hasWindow ? window.location.search ?? '' : '';
  const initialRouteEntry = hasWindow ? resolveHydrationEntry(initialPathname, initialSearch) : null;
  const completeInitialRoute = initialRouteEntry
    ? beginHydrationSpan(initialRouteEntry.id, {
        id: initialRouteEntry.id,
        label: initialRouteEntry.label,
        group: 'hydration:route',
        meta: {
          budget: initialRouteEntry.budget,
          path: initialPathname,
          search: initialSearch,
          status: 'bootstrap',
        },
      })
    : null;

  const completeBootstrap = beginHydrationSpan('route:bootstrap', { group: 'hydration', meta: { budget: 100 } });
  const completeEnv = beginHydrationSpan('bootstrap:env', { group: 'hydration', meta: { budget: 20 } });

  // ✅ Step 1: Load runtime env FIRST (before MSAL init)
  await ensureRuntimeEnv()
    .then(() => {
      finalizeHydrationSpan(completeEnv);
    })
    .catch((error) => {
      finalizeHydrationSpan(completeEnv, error);
      throw error;
    });

  // ✅ Step 2: Initialize MSAL singleton + handle redirect BEFORE React renders
  if (hasWindow) {
    try {
      const { getPcaSingleton } = await import('./auth/azureMsal');
      const msalInstance = await getPcaSingleton();
      
      console.info('[msal] 🚀 singleton created, calling handleRedirectPromise...');
      const result = await msalInstance.handleRedirectPromise();
      
      if (result?.account) {
        msalInstance.setActiveAccount(result.account);
        const username = (result.account as { username?: string; homeAccountId?: string }).username
          ?? (result.account as { homeAccountId?: string }).homeAccountId
          ?? '(unknown)';
        console.info('[msal] ✅ redirect success:', username);
        const msalKeys = Object.keys(sessionStorage).filter(k => k.toLowerCase().includes('msal'));
        console.info('[msal] sessionStorage MSAL keys:', msalKeys);
      } else {
        console.info('[msal] ℹ️  handleRedirectPromise returned null');
      }
    } catch (error) {
      // Non-fatal: continue app bootstrap even if MSAL init/redirect fails
      console.error('[msal] ❌ initialization/redirect error:', error);
    } finally {
      if (typeof window !== 'undefined') {
        window.__MSAL_REDIRECT_DONE__ = true;
        console.info('[msal] __MSAL_REDIRECT_DONE__ set true', {
          path: window.location.pathname,
          search: window.location.search,
        });
      }
    }
  }

  const completeImports = beginHydrationSpan('bootstrap:imports', { group: 'hydration', meta: { budget: 30 } });

  const modulesPromise = (Promise.all([
    import('./app/ConfigErrorBoundary'),
    import('./lib/debugLogger'),
    import('./config/featureFlags'),
  ]) as Promise<[
    typeof import('./app/ConfigErrorBoundary'),
    typeof import('./lib/debugLogger'),
    typeof import('./config/featureFlags')
  ]>)
    .then((modules) => {
      finalizeHydrationSpan(completeImports);
      return modules;
    })
    .catch((error) => {
      finalizeHydrationSpan(completeImports, error);
      throw error;
    });

  const completeAppImport = beginHydrationSpan('bootstrap:app-module', { group: 'hydration', meta: { budget: 20 } });

  const appPromise = (import('./App') as Promise<{ default: typeof import('./App').default }>)
    .then((module) => {
      finalizeHydrationSpan(completeAppImport);
      return module;
    })
    .catch((error) => {
      finalizeHydrationSpan(completeAppImport, error);
      throw error;
    });

  const completeMetrics = beginHydrationSpan('bootstrap:metrics', { group: 'hydration', meta: { budget: 10 } });
  void import('./metrics')
    .then(() => {
      finalizeHydrationSpan(completeMetrics);
    })
    .catch((error) => {
      finalizeHydrationSpan(completeMetrics, error);
    });

  // ✅ DEV: Expose authDiagnostics to window for debugging
  if (import.meta.env.DEV && hasWindow) {
    void import('./features/auth/diagnostics/collector')
      .then(({ exposeAuthDiagnosticsToWindow }) => {
        exposeAuthDiagnosticsToWindow();
      })
      .catch((error) => {
        console.warn('[main] failed to expose authDiagnostics to window', error);
      });
  }

  const envSnapshot = (getRuntimeEnv() as EnvRecord) ?? null;

  try {
    // 🔧 runtime env を最優先で適用してからモジュールを読み込み
    // (envPromise は既に await ensureRuntimeEnv() で完了済み)
    
    // ✅ NOW that runtime env is loaded, check for production misconfigurations
    guardProdMisconfig();

    const [modules, appModule] = await Promise.all([modulesPromise, appPromise]);
    const [{ ConfigErrorBoundary }, { auditLog }, featureFlagsModule] = modules;
    const { default: App } = appModule;
    const { FeatureFlagsProvider, resolveFeatureFlags } = featureFlagsModule;
    const flags = resolveFeatureFlags(envSnapshot ?? undefined);

    const completeRender = beginHydrationSpan('bootstrap:render', { group: 'hydration', meta: { budget: 60 } });

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
          borderRadius: '50%',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #1976d2',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px',
        }}
      />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#666', fontSize: '14px' }}>読み込み中...</p>
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <React.Suspense fallback={<SuspenseFallback />}>
      <React.StrictMode>
        <ConfigErrorBoundary>
          <FeatureFlagsProvider value={flags}>
            <App />
          </FeatureFlagsProvider>
        </ConfigErrorBoundary>
      </React.StrictMode>
    </React.Suspense>
  </ErrorBoundary>
    );

    const settle = (error?: unknown) => {
      finalizeHydrationSpan(completeRender, error);
      finalizeHydrationSpan(completeBootstrap, error);
      if (initialRouteEntry) {
        finalizeHydrationSpan(completeInitialRoute, error, {
          budget: initialRouteEntry.budget,
          path: initialPathname,
          search: initialSearch,
          status: error ? 'failed' : 'completed',
        });
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => settle());
    } else {
      settle();
    }

    runOnIdle(() => {
      if (envSnapshot && typeof window !== 'undefined' && (envSnapshot.MODE ?? '').toLowerCase() !== 'production') {
        window.__FLAGS__ = flags;
        if (isDev) {
          // eslint-disable-next-line no-console
          console.info('[flags]', flags);
        }
      }
      auditLog.info('flags', flags);
    });
  } catch (error) {
    finalizeHydrationSpan(completeBootstrap, error);
    if (initialRouteEntry) {
      finalizeHydrationSpan(completeInitialRoute, error, {
        budget: initialRouteEntry.budget,
        path: initialPathname,
        search: initialSearch,
        status: 'failed',
      });
    }
    throw error;
  }
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[bootstrap error]', error);
});