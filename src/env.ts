type EnvDict = Record<string, string | undefined>;

const INLINE_ENV: EnvDict = (() => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env) {
      return ((import.meta as ImportMeta).env ?? {}) as unknown as EnvDict;
    }
  } catch {
    // ignore environments where import.meta is unavailable (e.g., unit tests hoisting)
  }
  return {};
})();

const getWindowEnv = (): EnvDict | undefined => {
  if (typeof window === 'undefined') return undefined;
  const candidate = (window as typeof window & { __ENV__?: EnvDict }).__ENV__;
  return candidate ? { ...candidate } : undefined;
};

// 🚀 パフォーマンス最適化：軽量キャッシュ付き getRuntimeEnv
let cachedEnv: EnvDict | null = null;

export function getRuntimeEnv(): EnvDict {
  if (cachedEnv) return cachedEnv;

  const fromWindow = getWindowEnv();
  cachedEnv = fromWindow ? { ...INLINE_ENV, ...fromWindow } : { ...INLINE_ENV };
  return cachedEnv;
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
// 🔧 命名統一：環境フラグを定数化
export const isE2E = getFlag('VITE_E2E', false);
export const isDemo = getFlag('VITE_DEMO', false);
