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

export function getRuntimeEnv(): EnvDict {
  const fromWindow = getWindowEnv();
  return fromWindow ? { ...INLINE_ENV, ...fromWindow } : { ...INLINE_ENV };
}

export function get(name: string, fallback = ''): string {
  const value = getRuntimeEnv()[name];
  if (value === undefined || value === null) {
    return fallback;
  }
  return typeof value === 'string' ? value : String(value);
}

export function getNumber(name: string, fallback: number): number {
  const raw = get(name, String(fallback));
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function getFlag(name: string, fallback = false): boolean {
  const raw = get(name, fallback ? '1' : '0').toLowerCase();
  return raw === '1' || raw === 'true';
}

export const isDev = get('MODE') === 'development' || getFlag('DEV', false);
