// src/env.ts

// Central runtime env access with window overrides (from main.tsx) and memoization.
// Exposes: getRuntimeEnv, refreshRuntimeEnvCache, get, getNumber, getFlag,
//          isDev, isProd, isTest, getJSON, getList

type EnvDict = Record<string, string | undefined>;

type WindowWithEnv = typeof window & { __ENV__?: EnvDict };

// Inline (build-time) env from Vite/import.meta
const INLINE_ENV: EnvDict = (() => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env) {
      // Cast defensively: Vite provides a plain object of string values
      return ((import.meta as ImportMeta).env ?? {}) as unknown as EnvDict;
    }
  } catch {
    // ignore environments where import.meta is unavailable (e.g., unit tests hoisting)
  }
  return {};
})();

let _cachedRuntimeEnv: EnvDict | null = null;

const getWindowEnv = (): EnvDict | undefined => {
  if (typeof window === 'undefined') return undefined;
  const candidate = (window as WindowWithEnv).__ENV__;
  return candidate ? { ...candidate } : undefined;
};

export function getRuntimeEnv(): EnvDict {
  if (_cachedRuntimeEnv) return _cachedRuntimeEnv;
  const fromWindow = getWindowEnv();
  _cachedRuntimeEnv = fromWindow ? { ...INLINE_ENV, ...fromWindow } : { ...INLINE_ENV };
  return _cachedRuntimeEnv;
}

// In cases like hot-reload or tests, allow clearing the memoized snapshot
export function refreshRuntimeEnvCache(): void {
  _cachedRuntimeEnv = null;
}

export function get(name: string, fallback = ''): string {
  const value = getRuntimeEnv()[name];
  if (value === undefined || value === null) return fallback;
  return typeof value === 'string' ? value : String(value);
}

export function getNumber(name: string, fallback: number): number {
  const raw = get(name, String(fallback));
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function getFlag(name: string, fallback = false): boolean {
  const raw = get(name, fallback ? '1' : '0').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

const mode = get('MODE', '').toLowerCase();
export const isDev = mode === 'development' || getFlag('DEV', false);
export const isProd = mode === 'production' || getFlag('PROD', false);
export const isTest = mode === 'test' || getFlag('TEST', false);

// Helpers for structured envs
export function getJSON<T = unknown>(name: string, fallback: T): T {
  const raw = get(name, '');
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getList(name: string, fallback: string[] = [], sep = ','): string[] {
  const raw = get(name, '');
  if (!raw) return fallback;
  return raw
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}
