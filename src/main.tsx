import React from 'react';
import ReactDOM from 'react-dom/client';
import { getRuntimeEnv, isDev, clearEnvCache } from './env';
import { guardProdMisconfig } from './lib/envGuards';
import { resolveHydrationEntry } from './hydration/routes';
import { beginHydrationSpan, finalizeHydrationSpan } from './lib/hydrationHud';

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
  }
}

// NOTE: Do NOT call guardProdMisconfig() here - it needs runtime env to be loaded first!
// Call it after ensureRuntimeEnv() completes below.

const RUNTIME_PATH_KEYS = new Set(['RUNTIME_ENV_PATH', 'VITE_RUNTIME_ENV_PATH']);

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
        console.info('[msal] ℹ️  no redirect result (first load or no auth callback)');
      }
    } catch (error) {
      // Non-fatal: continue app bootstrap even if MSAL init/redirect fails
      console.error('[msal] ❌ initialization/redirect error:', error);
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

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ConfigErrorBoundary>
          <FeatureFlagsProvider value={flags}>
            <App />
          </FeatureFlagsProvider>
        </ConfigErrorBoundary>
      </React.StrictMode>
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