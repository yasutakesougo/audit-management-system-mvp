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

    return merged;
  }

  return { ...INLINE_ENV } as EnvDict;
}

export function get(name: string, fallback = ''): string {
  const value = getRuntimeEnv()[name];
  return value ?? fallback;
}

export function getNumber(name: string, fallback: number): number {
  const raw = get(name, String(fallback));
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function getFlag(name: string, fallback = false): boolean {
  const raw = get(name, fallback ? '1' : '0');
  const normalized = String(raw).toLowerCase();
  return normalized === '1' || normalized === 'true';
}

export function resolveIsDev(): boolean {
  const inlineMode = (() => {
    try {
      if (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env?.MODE) {
        return ((import.meta as ImportMeta).env.MODE ?? '') as string;
      }
    } catch {
      // ignore environments where import.meta is unavailable (e.g., unit tests)
    }
    return undefined;
  })();

  if (typeof inlineMode === 'string' && inlineMode.toLowerCase() === 'development') {
    return true;
  }

  if (get('MODE')?.toLowerCase() === 'development') {
    return true;
  }

  if (getFlag('DEV', false)) {
    return true;
  }

  if (typeof process !== 'undefined' && process.env) {
    const nodeMode = process.env.NODE_ENV ?? process.env.MODE ?? '';
    if (nodeMode.toLowerCase() === 'development') {
      return true;
    }
    const viteDev = process.env.VITE_DEV ?? '';
    if (viteDev.toLowerCase() === 'true') {
      return true;
    }
  }

  return false;
}

export const isDev = resolveIsDev();

// 🔧 Getters for dynamic runtime evaluation in E2E/Demo environments
export const getIsE2E = () => getFlag('VITE_E2E', false);
export const getIsE2eMsalMock = () => getFlag('VITE_E2E_MSAL_MOCK', false);
export const getIsDemo = () => getFlag('VITE_DEMO', false);
export const getIsWriteEnabled = () => getFlag('VITE_WRITE_ENABLED', true);

// Legacy constants (retained for compatibility but marked as dynamic where possible)
export const isE2E = getIsE2E();
export const isE2eMsalMock = getIsE2eMsalMock();
export const isDemo = getIsDemo();
export const isWriteEnabled = getIsWriteEnabled();

export const isE2eForceSchedulesWrite =
  getIsE2E() && getIsE2eMsalMock() && getFlag('VITE_E2E_FORCE_SCHEDULES_WRITE', false);

// Use a getter for more robust runtime evaluation in E2E environments
export function getIsE2eForceSchedulesWrite(): boolean {
  // Directly read from the runtime env to avoid any stale constant issues
  const runtimeEnv = getRuntimeEnv();
  const forceWriteRaw = runtimeEnv['VITE_E2E_FORCE_SCHEDULES_WRITE'];
  const forceWrite = forceWriteRaw === '1' || forceWriteRaw === 'true';
  
  if (forceWrite && !getIsE2E()) {
    // 📊 Warn if force write is set but E2E mode is not detected
    // eslint-disable-next-line no-console
    console.warn('[env] VITE_E2E_FORCE_SCHEDULES_WRITE is set but VITE_E2E is not detected. Access may be blocked.');
  }

  return forceWrite;
}
/**
 * Clear the cached env after runtime env is loaded.
 * Call this after window.__ENV__ is updated to ensure fresh reads.
 * @internal
 */
export function clearEnvCache(): void {
  // No-op as caching is disabled to support dynamic E2E overrides
}

/**
 * Read a boolean flag directly from the `window` object (not `window.__ENV__`).
 * Useful for E2E test shims like `window.__E2E_TODAY_OPS_MOCK__`.
 * Returns false when `window` is undefined or the key is absent.
 */
export function getWindowFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as typeof window & Record<string, unknown>)[key]);
}
