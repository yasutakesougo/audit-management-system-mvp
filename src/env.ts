type EnvDict = Record<string, string | undefined>;

const TRUTHY_RUNTIME_VALUES = new Set(['1', 'true', 'yes', 'y', 'on', 'enabled']);

const INLINE_ENV: EnvDict = (() => {
  let fromImportMeta: EnvDict = {};
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env) {
      fromImportMeta = ((import.meta as ImportMeta).env ?? {}) as unknown as EnvDict;
    }
  } catch {
    // ignore environments where import.meta is unavailable (e.g., unit tests hoisting)
  }

  const fromProcess: EnvDict = (() => {
    if (typeof process === 'undefined' || !process.env) return {};
    // Ensure everything is stringified for consistent merging.
    return Object.fromEntries(
      Object.entries(process.env).map(([key, value]) => [key, value === undefined ? value : String(value)]),
    );
  })();

  // Prefer process.env (Vitest stub/env file) over import.meta to honor test/runtime overrides.
  return { ...fromImportMeta, ...fromProcess };
})();

const getWindowEnv = (): EnvDict | undefined => {
  if (typeof window === 'undefined') return undefined;
  const candidate = (window as typeof window & { __ENV__?: EnvDict }).__ENV__;
  return candidate ? { ...candidate } : undefined;
};

const E2E_OVERRIDE_KEYS = ['VITE_E2E', 'VITE_SKIP_LOGIN', 'VITE_SKIP_SHAREPOINT', 'VITE_E2E_MSAL_MOCK'];

const normalizeRuntimeString = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
};

const isTruthyRuntimeValue = (value: string | undefined): boolean => {
  const normalized = normalizeRuntimeString(value);
  return normalized ? TRUTHY_RUNTIME_VALUES.has(normalized) : false;
};

const isE2eOrTestHint = (value: string | undefined): boolean => {
  const normalized = normalizeRuntimeString(value);
  if (!normalized) return false;
  return normalized === 'e2e' || normalized === 'test';
};

const shouldAllowRuntimeFlagOverrides = (runtimeEnv?: EnvDict): boolean => {
  if (!runtimeEnv) return false;
  if (isTruthyRuntimeValue(runtimeEnv.__ALLOW_RUNTIME_FLAG_OVERRIDES__)) {
    return true;
  }
  if (isTruthyRuntimeValue(runtimeEnv.VITE_E2E)) {
    return true;
  }
  if (isTruthyRuntimeValue(runtimeEnv.PLAYWRIGHT_TEST)) {
    return true;
  }
  if (isE2eOrTestHint(runtimeEnv.VITE_APP_ENV) || isE2eOrTestHint(runtimeEnv.APP_ENV)) {
    return true;
  }
  if (isE2eOrTestHint(runtimeEnv.MODE) || isE2eOrTestHint(runtimeEnv.NODE_ENV)) {
    return true;
  }
  return false;
};

// 🚀 パフォーマンス最適化：軽量キャッシュ付き getRuntimeEnv
let cachedEnv: EnvDict | null = null;

export function getRuntimeEnv(): EnvDict {
  const fromWindow = getWindowEnv();
  if (fromWindow) {
    const allowRuntimeOverrides = shouldAllowRuntimeFlagOverrides(fromWindow);
    const merged = { ...INLINE_ENV, ...fromWindow } as EnvDict;

    if (!allowRuntimeOverrides) {
      for (const key of E2E_OVERRIDE_KEYS) {
        if (INLINE_ENV[key] !== undefined) {
          merged[key] = INLINE_ENV[key];
        }
      }
    }

    cachedEnv = merged;
    return merged;
  }

  if (cachedEnv) return cachedEnv;

  const merged = { ...INLINE_ENV } as EnvDict;
  cachedEnv = merged;
  return merged;
}

export function get(name: string, fallback = ''): string {
  const value = getRuntimeEnv()[name];
  return value ?? fallback;
}

export function getFlag(name: string, fallback = false): boolean {
  const raw = get(name, fallback ? '1' : '0');
  const normalized = String(raw).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export const getIsDemo = () => {
  if (typeof window !== 'undefined' && (window as unknown as { auditDemoMode?: boolean }).auditDemoMode) return true;
  return isTruthyRuntimeValue(getRuntimeEnv().VITE_DEMO_MODE) || isTruthyRuntimeValue(getRuntimeEnv().VITE_FORCE_DEMO);
};

export const getIsE2E = () => isTruthyRuntimeValue(getRuntimeEnv().VITE_E2E);

export const getIsMsalMock = () => {
  const env = getRuntimeEnv();
  return isTruthyRuntimeValue(env.VITE_E2E_MSAL_MOCK) || isTruthyRuntimeValue(env.VITE_MSAL_MOCK);
};

export const isDev = (() => {
  const env = getRuntimeEnv();
  const mode = (env.MODE || env.NODE_ENV || '').toLowerCase();
  return mode === 'development' || isTruthyRuntimeValue(env.DEV) || isTruthyRuntimeValue(env.VITE_DEV);
})();

export const isE2E = getIsE2E();
export const isE2eMsalMock = getIsMsalMock();
export const isDemo = getIsDemo();

/**
 * Runtime environment record (loosely typed for low-level access)
 */
export type EnvRecord = Record<string, string | number | boolean | undefined>;

/**
 * Lightweight environment getter (used by @/lib/env for validation)
 */
export const env = getRuntimeEnv();

export function getNumber(name: string, fallback: number): number {
  const value = get(name, '');
  if (!value) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

export const isWriteEnabled = isTruthyRuntimeValue(getRuntimeEnv().VITE_WRITE_ENABLED);
export const isE2eForceSchedulesWrite = isTruthyRuntimeValue(getRuntimeEnv().VITE_E2E_FORCE_SCHEDULES_WRITE);
