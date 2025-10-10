import { getRuntimeEnv } from '../env';

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
};

const TRUTHY = new Set(['1', 'true', 'yes', 'y', 'on', 'enabled']);
const FALSY = new Set(['0', 'false', 'no', 'n', 'off', 'disabled']);

const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const runtime = getRuntimeEnv() as EnvRecord;
  if (key in runtime) {
    return runtime[key];
  }
  if (typeof process !== 'undefined' && process.env && key in process.env) {
    return process.env[key] as Primitive;
  }
  return undefined;
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
  const runtime = getRuntimeEnv();
  const mode = runtime.MODE ?? runtime.NODE_ENV;
  if (typeof mode === 'string' && mode.toLowerCase() === 'development') {
    return true;
  }
  if (typeof process !== 'undefined' && process.env && 'NODE_ENV' in process.env) {
    return String(process.env.NODE_ENV).toLowerCase() === 'development';
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
  const resource = readEnv('VITE_SP_RESOURCE', '', envOverride).trim();
  if (resource) {
    return resource.replace(/\/+$/, '');
  }
  const runtime = getRuntimeEnv();
  return (runtime.VITE_SP_RESOURCE ?? '').replace(/\/+$/, '');
};

export const getSharePointSiteRelative = (envOverride?: EnvRecord): string => {
  const override = readEnv('VITE_SP_SITE_RELATIVE', '', envOverride).trim();
  if (override) {
    const normalized = override.startsWith('/') ? override : `/${override}`;
    return normalized.replace(/\/+$/, '');
  }
  const runtime = getRuntimeEnv();
  const fromEnv = (runtime.VITE_SP_SITE_RELATIVE ?? '').trim();
  if (!fromEnv) {
    return '';
  }
  const normalized = fromEnv.startsWith('/') ? fromEnv : `/${fromEnv}`;
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
