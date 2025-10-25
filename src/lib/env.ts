// --- DEBUG START ---
try {
  const e = getEnv();
  // 最小限だけ出力
  console.info('[env.runtime.json loaded]', {
    MODE: (e as any).MODE,
    VITE_SP_BASE_URL: (e as any).VITE_SP_BASE_URL,
    VITE_SP_SITE_URL: (e as any).VITE_SP_SITE_URL,
    VITE_SP_RESOURCE: (e as any).VITE_SP_RESOURCE,
  });
} catch (err) {
  console.warn('[env.debug] failed to print env', err);
}
// --- DEBUG END ---
// src/lib/env.ts
// どの実行環境（Vite/Node/テスト/CJS）でも安全に環境変数を読むためのユーティリティ。
// import.meta / process.env を**トップレベル**で一切参照しない。

export type EnvDict = Record<string, string | undefined>;

// キャッシュ（1プロセスで1回だけ解決）
let _envCache: EnvDict | null = null;

/**
 * 実行時に安全に環境変数を解決。
 * 優先順位:
 *  1) Vite の import.meta.env（あれば） ← ランタイム eval 経由で安全に評価
 *  2) process.env（Node/テスト）
 *  3) globalThis.__ENV（任意の注入口。テストやE2Eで上書きしたい場合に使用）
 */
export function getEnv(): EnvDict {
  if (_envCache) return _envCache;

  const out: EnvDict = {};

  // 1) Vite import.meta.env を “eval” 経由で**ランタイム**取得（CJS でもパースエラーにならない）
  try {
    // eslint-disable-next-line no-new-func
    const getImportMeta = Function('try { return import.meta; } catch { return undefined; }');
    const im = getImportMeta() as any;
    if (im?.env && typeof im.env === 'object') {
      Object.assign(out, im.env as Record<string, string | undefined>);
    }
  } catch {
    // ignore
  }

  // 2) Node (process.env)
  try {
    const pe = (globalThis as any)?.process?.env;
    if (pe && typeof pe === 'object') {
      Object.assign(out, pe as Record<string, string | undefined>);
    }
  } catch {
    // ignore
  }

  // 3) 任意注入（テスト・E2Eで上書きしたいとき）
  try {
    const injected = (globalThis as any)?.__ENV;
    if (injected && typeof injected === 'object') {
      Object.assign(out, injected as Record<string, string | undefined>);
    }
  } catch {
    // ignore
  }

  _envCache = out;
  return _envCache;
}

// 文字列
export function readString(key: string, fallback = ''): string {
  const v = getEnv()[key];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

// 真偽（"1","true","on","yes" を true）
// (legacy readBool removed; use new universal implementation below)

// 数値
export function readNumber(key: string, fallback = 0): number {
  const v = getEnv()[key];
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// アプリ共通設定（必要に応じてここに寄せる）
// (legacy getAppConfig removed; use new universal implementation below)

type Primitive = string | number | boolean | undefined | null;
export type EnvRecord = Record<string, Primitive>;

export type AppConfig = {
  VITE_SP_RESOURCE: string;
  VITE_SP_SITE_RELATIVE: string;
  VITE_SP_RETRY_MAX: string;
  VITE_SP_RETRY_BASE_MS: string;
  VITE_SP_RETRY_MAX_DELAY_MS: string;
  VITE_MSAL_CLIENT_ID: string;
  VITE_MSAL_TENANT_ID: string;
  VITE_MSAL_TOKEN_REFRESH_MIN: string;
  VITE_AUDIT_DEBUG: string;
  VITE_AUDIT_BATCH_SIZE: string;
  VITE_AUDIT_RETRY_MAX: string;
  VITE_AUDIT_RETRY_BASE: string;
  schedulesCacheTtlSec: number;
  graphRetryMax: number;
  graphRetryBaseMs: number;
  graphRetryCapMs: number;
  schedulesTz: string;
  schedulesWeekStart: number;
  isDev: boolean;
};

const TRUTHY = new Set(['1', 'true', 'yes', 'y', 'on', 'enabled']);
const FALSY = new Set(['0', 'false', 'no', 'n', 'off', 'disabled']);

const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampWeekStart = (value: number, fallback = 1): number => {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value);
  if (normalized < 0 || normalized > 6) return fallback;
  return normalized;
};

const normalizeString = (value: Primitive): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
};

const coerceBoolean = (value: Primitive, fallback = false): boolean => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  if (TRUTHY.has(normalized)) return true;
  if (FALSY.has(normalized)) return false;
  return fallback;
};


const getEnvValue = (key: string, envOverride?: EnvRecord): Primitive => {
  if (envOverride && key in envOverride) {
    return envOverride[key];
  }
  const runtime = getEnv() as EnvRecord;
  if (key in runtime) {
    return runtime[key];
  }
  return undefined;
};

const resolveIsDev = (envOverride?: EnvRecord): boolean => {
  const modeValue = getEnvValue('MODE', envOverride);
  if (typeof modeValue === 'string' && modeValue.trim()) {
    return modeValue.trim().toLowerCase() === 'development';
  }
  const devValue = getEnvValue('DEV', envOverride);
  if (devValue !== undefined) {
    return coerceBoolean(devValue, false);
  }
  const runtime = getEnv();
  const mode = runtime.MODE ?? runtime.NODE_ENV;
  if (typeof mode === 'string' && mode.toLowerCase() === 'development') {
    return true;
  }
  return false;
};

export const readEnv = (key: string, fallback = '', envOverride?: EnvRecord): string => {
  const raw = getEnvValue(key, envOverride);
  const normalized = normalizeString(raw);
  return normalized === '' ? fallback : normalized;
};

let appConfigCache: AppConfig | null = null;

export const getAppConfig = (envOverride?: EnvRecord): AppConfig => {
  if (!envOverride && appConfigCache) {
    return appConfigCache;
  }

  const cfg: AppConfig = {
    VITE_SP_RESOURCE: readEnv('VITE_SP_RESOURCE', '', envOverride),
    VITE_SP_SITE_RELATIVE: readEnv('VITE_SP_SITE_RELATIVE', '', envOverride),
    VITE_SP_RETRY_MAX: readEnv('VITE_SP_RETRY_MAX', '4', envOverride),
    VITE_SP_RETRY_BASE_MS: readEnv('VITE_SP_RETRY_BASE_MS', '400', envOverride),
    VITE_SP_RETRY_MAX_DELAY_MS: readEnv('VITE_SP_RETRY_MAX_DELAY_MS', '5000', envOverride),
    VITE_MSAL_CLIENT_ID: readEnv('VITE_MSAL_CLIENT_ID', '', envOverride),
    VITE_MSAL_TENANT_ID: readEnv('VITE_MSAL_TENANT_ID', '', envOverride),
    VITE_MSAL_TOKEN_REFRESH_MIN: readEnv('VITE_MSAL_TOKEN_REFRESH_MIN', '300', envOverride),
    VITE_AUDIT_DEBUG: readEnv('VITE_AUDIT_DEBUG', '', envOverride),
    VITE_AUDIT_BATCH_SIZE: readEnv('VITE_AUDIT_BATCH_SIZE', '', envOverride),
    VITE_AUDIT_RETRY_MAX: readEnv('VITE_AUDIT_RETRY_MAX', '', envOverride),
    VITE_AUDIT_RETRY_BASE: readEnv('VITE_AUDIT_RETRY_BASE', '', envOverride),
    schedulesCacheTtlSec: parseNumber(readEnv('VITE_SCHEDULES_CACHE_TTL', '60', envOverride), 60),
    graphRetryMax: parseNumber(readEnv('VITE_GRAPH_RETRY_MAX', '2', envOverride), 2),
    graphRetryBaseMs: parseNumber(readEnv('VITE_GRAPH_RETRY_BASE_MS', '300', envOverride), 300),
    graphRetryCapMs: parseNumber(readEnv('VITE_GRAPH_RETRY_CAP_MS', '2000', envOverride), 2000),
    schedulesTz: readEnv('VITE_SCHEDULES_TZ', '', envOverride).trim(),
    schedulesWeekStart: clampWeekStart(parseNumber(readEnv('VITE_SCHEDULES_WEEK_START', '1', envOverride), 1)),
    isDev: resolveIsDev(envOverride),
  };

  if (!envOverride) {
    appConfigCache = cfg;
  }

  return cfg;
};

export const __resetAppConfigForTests = (): void => {
  appConfigCache = null;
};

export const readOptionalEnv = (key: string, envOverride?: EnvRecord): string | undefined => {
  const raw = getEnvValue(key, envOverride);
  const normalized = normalizeString(raw);
  return normalized === '' ? undefined : normalized;
};

export const readBool = (key: string, fallback = false, envOverride?: EnvRecord): boolean =>
  coerceBoolean(getEnvValue(key, envOverride), fallback);

export const isDevMode = (envOverride?: EnvRecord): boolean => {
  const explicit = getEnvValue('DEV', envOverride);
  if (explicit !== undefined) {
    return coerceBoolean(explicit, false);
  }
  const runtime = getEnv();
  const mode = runtime.MODE ?? runtime.NODE_ENV;
  if (typeof mode === 'string' && mode.toLowerCase() === 'development') {
    return true;
  }
  return false;
};

export const isDemoModeEnabled = (envOverride?: EnvRecord): boolean =>
  readBool('VITE_DEMO_MODE', false, envOverride);

export const isWriteEnabled = (envOverride?: EnvRecord): boolean =>
  readBool('VITE_WRITE_ENABLED', false, envOverride);

export const isAuditDebugEnabled = (envOverride?: EnvRecord): boolean =>
  readBool('VITE_AUDIT_DEBUG', false, envOverride);

export const isSchedulesFeatureEnabled = (envOverride?: EnvRecord): boolean => {
  if (readBool('VITE_FEATURE_SCHEDULES', false, envOverride)) {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      const flag = window.localStorage.getItem('feature:schedules');
      if (flag != null) {
        const normalized = flag.trim().toLowerCase();
        if (TRUTHY.has(normalized)) return true;
        if (FALSY.has(normalized)) return false;
      }
    } catch {
      // ignore storage access issues (private mode, etc.)
    }
  }
  return false;
};

export const isSchedulesCreateEnabled = (envOverride?: EnvRecord): boolean => {
  if (readBool('VITE_FEATURE_SCHEDULES_CREATE', false, envOverride)) {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      const flag = window.localStorage.getItem('feature:schedulesCreate');
      if (flag != null) {
        const normalized = flag.trim().toLowerCase();
        if (TRUTHY.has(normalized)) return true;
        if (FALSY.has(normalized)) return false;
      }
    } catch {
      // ignore storage access issues
    }
  }
  return false;
};

export const isComplianceFormEnabled = (envOverride?: EnvRecord): boolean => {
  if (readBool('VITE_FEATURE_COMPLIANCE_FORM', false, envOverride)) {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      const flag = window.localStorage.getItem('feature:complianceForm');
      if (flag != null) {
        const normalized = flag.trim().toLowerCase();
        if (TRUTHY.has(normalized)) return true;
        if (FALSY.has(normalized)) return false;
      }
    } catch {
      // ignore storage access issues
    }
  }
  return false;
};

export const isTimeflowV2Enabled = (envOverride?: EnvRecord): boolean => {
  if (readBool('VITE_FEATURE_TIMEFLOW_V2', false, envOverride)) {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      const flag = window.localStorage.getItem('feature:timeflowV2');
      if (flag != null) {
        const normalized = flag.trim().toLowerCase();
        if (TRUTHY.has(normalized)) return true;
        if (FALSY.has(normalized)) return false;
      }
    } catch {
      // ignore storage access issues
    }
  }
  return false;
};

export const shouldSkipLogin = (envOverride?: EnvRecord): boolean => {
  if (isDemoModeEnabled(envOverride) || readBool('VITE_SKIP_LOGIN', false, envOverride)) {
    return true;
  }

  if (typeof window !== 'undefined') {
    try {
      const flag = window.localStorage.getItem('skipLogin');
      if (flag != null) {
        const normalized = flag.trim().toLowerCase();
        if (TRUTHY.has(normalized)) return true;
        if (FALSY.has(normalized)) return false;
      }
    } catch {
      // ignore storage failures (e.g., private mode)
    }
  }

  return false;
};

export const isUsersCrudEnabled = (envOverride?: EnvRecord): boolean => {
  if (readBool('VITE_FEATURE_USERS_CRUD', false, envOverride)) {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      const flag = window.localStorage.getItem('feature:usersCrud');
      if (flag != null) {
        const normalized = flag.trim().toLowerCase();
        if (TRUTHY.has(normalized)) return true;
        if (FALSY.has(normalized)) return false;
      }
    } catch {
      // ignore storage access issues
    }
  }
  return false;
};

export const isE2eMsalMockEnabled = (envOverride?: EnvRecord): boolean =>
  readBool('VITE_E2E_MSAL_MOCK', false, envOverride);

export const allowWriteFallback = (envOverride?: EnvRecord): boolean =>
  readBool('VITE_ALLOW_WRITE_FALLBACK', false, envOverride);

export const getSharePointResource = (envOverride?: EnvRecord): string => {
  const resourceVal = readEnv('VITE_SP_RESOURCE', '', envOverride).trim();
  if (resourceVal) {
    return resourceVal.replace(/\/+$/, '');
  }
  const envObj = getEnv();
  const envRaw = envObj.VITE_SP_RESOURCE;
  const envStr = typeof envRaw === 'string' ? envRaw : String(envRaw ?? '');
  return envStr.replace(/\/+$/, '');
};

export const getSharePointSiteRelative = (envOverride?: EnvRecord): string => {
  const siteVal = readEnv('VITE_SP_SITE_RELATIVE', '', envOverride).trim();
  if (siteVal) {
    const normalized = siteVal.startsWith('/') ? siteVal : `/${siteVal}`;
    return normalized.replace(/\/+$/, '');
  }
  const envObj = getEnv();
  const envRaw = envObj.VITE_SP_SITE_RELATIVE;
  const fromEnvStr = typeof envRaw === 'string' ? envRaw.trim() : String(envRaw ?? '').trim();
  if (!fromEnvStr) {
    return '';
  }
  const normalized = fromEnvStr.startsWith('/') ? fromEnvStr : `/${fromEnvStr}`;
  return normalized.replace(/\/+$/, '');
};

export const getSharePointBaseUrl = (envOverride?: EnvRecord): string => {
  const resource = getSharePointResource(envOverride);
  const site = getSharePointSiteRelative(envOverride);
  const base = site ? `${resource}${site}` : resource;
  return `${base.replace(/\/$/, '')}/_api/web`;
};

export const getSchedulesListIdFromEnv = (envOverride?: EnvRecord): string => {
  const override = readEnv('VITE_SP_LIST_SCHEDULES', '', envOverride).trim();
  if (override) {
    return override;
  }
  return 'Schedules';
};

const parseScopeList = (raw: string): string[] => {
  if (!raw) return [];
  const scopes = raw
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (scopes.length === 0 && raw.trim().length > 0) {
    console.error('[env] Failed to parse scopes from value:', raw);
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const scope of scopes) {
    if (scope && !seen.has(scope)) {
      seen.add(scope);
      result.push(scope);
    }
  }
  return result;
};

export const getConfiguredMsalScopes = (envOverride?: EnvRecord): string[] => {
  const raw = readEnv('VITE_MSAL_SCOPES', '', envOverride);
  return parseScopeList(raw);
};

export const getMsalTokenRefreshMin = (envOverride?: EnvRecord): number => {
  const raw = readEnv('VITE_MSAL_TOKEN_REFRESH_MIN', '', envOverride);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
};

const IDENTITY_SCOPE_ALLOWLIST = new Set(['openid', 'profile']);
const IDENTITY_SCOPE_ORDER = ['openid', 'profile'] as const;

export const getMsalLoginScopes = (envOverride?: EnvRecord): string[] => {
  const scopeKeys = ['VITE_LOGIN_SCOPES', 'VITE_MSAL_LOGIN_SCOPES'] as const;
  const sanitized = new Set<string>();

  for (const key of scopeKeys) {
    const raw = readEnv(key, '', envOverride);
    if (!raw) continue;
    const parsed = parseScopeList(raw);
    for (const scope of parsed) {
      if (IDENTITY_SCOPE_ALLOWLIST.has(scope)) {
        sanitized.add(scope);
      } else {
        console.warn(`[env] Ignoring non-identity login scope "${scope}". Only openid/profile are requested during login.`);
      }
    }
  }

  const result: string[] = [...IDENTITY_SCOPE_ORDER];
  for (const scope of sanitized) {
    if (!result.includes(scope)) {
      result.push(scope);
    }
  }
  return result;
};

const DEMO_SHAREPOINT_SCOPE = 'https://example.sharepoint.com/AllSites.Read';

const SHAREPOINT_SCOPE_PATTERN = /^https:\/\/[^/]+\.sharepoint\.com\/AllSites\.(Read|FullControl)$/i;
const SHAREPOINT_RESOURCE_PATTERN = /^https:\/\/[^/]+\.sharepoint\.com$/i;

export const getSharePointDefaultScope = (envOverride?: EnvRecord): string => {
  const raw = readEnv('VITE_SP_SCOPE_DEFAULT', '', envOverride).trim();
  if (!raw) {
    if (shouldSkipLogin(envOverride)) {
      console.warn('[env] VITE_SP_SCOPE_DEFAULT missing but skip-login/demo mode enabled; using placeholder scope.');
      return DEMO_SHAREPOINT_SCOPE;
    }
    const msalScopes = getConfiguredMsalScopes(envOverride);
    const derived = msalScopes.find((scope) => SHAREPOINT_SCOPE_PATTERN.test(scope));
    if (derived) {
      console.warn('[env] VITE_SP_SCOPE_DEFAULT missing; reusing SharePoint scope from VITE_MSAL_SCOPES.');
      return derived;
    }
    const resource = getSharePointResource(envOverride);
    if (resource && SHAREPOINT_RESOURCE_PATTERN.test(resource)) {
      const normalized = resource.replace(/\/$/, '');
      const fallbackScope = `${normalized}/AllSites.Read`;
      console.warn('[env] VITE_SP_SCOPE_DEFAULT missing; deriving SharePoint scope from VITE_SP_RESOURCE.');
      return fallbackScope;
    }
    throw new Error('VITE_SP_SCOPE_DEFAULT is required (e.g. https://{host}.sharepoint.com/AllSites.Read)');
  }

  if (!SHAREPOINT_SCOPE_PATTERN.test(raw)) {
    throw new Error(`Invalid SharePoint scope: ${raw}`);
  }

  return raw;
};
