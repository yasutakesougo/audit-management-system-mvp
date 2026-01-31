// src/lib/runtimeEnv.ts
export type RuntimeEnv = Record<string, string | undefined>;

type GlobalRuntimeEnvCarrier = typeof globalThis & {
  __ENV__?: unknown;
  __RUNTIME_ENV__?: unknown;
  __APP_ENV__?: unknown;
  __RUNTIME_CONFIG__?: unknown;
};

const isRuntimeEnv = (value: unknown): value is RuntimeEnv =>
  typeof value === 'object' && value !== null;

export function getRuntimeEnv(): RuntimeEnv {
  const g = globalThis as GlobalRuntimeEnvCarrier;

  // よくある注入パターンを全部見る（あなたの環境はここに当たってるはず）
  const injected =
    g.__ENV__ ??
    g.__RUNTIME_ENV__ ??
    g.__APP_ENV__ ??
    g.__RUNTIME_CONFIG__ ??
    undefined;

  if (isRuntimeEnv(injected)) return injected;

  // Vite fallback
  const viteEnv = (import.meta as { env?: unknown }).env;
  if (isRuntimeEnv(viteEnv)) return viteEnv;

  return {};
}

export const runtimeEnv = getRuntimeEnv();

export function getEnv(key: string): string | undefined {
  return runtimeEnv[key];
}
