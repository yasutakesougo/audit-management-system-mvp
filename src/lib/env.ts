import { env } from '../env';

type Primitive = string | number | boolean | undefined | null;
export type EnvRecord = Record<string, Primitive>;

const TRUTHY = new Set(['1', 'true', 'yes', 'y', 'on', 'enabled']);
const FALSY = new Set(['0', 'false', 'no', 'n', 'off', 'disabled']);

const getMetaEnv = (): Record<string, Primitive> => {
  const meta = (import.meta as unknown as { env?: Record<string, Primitive> })?.env;
  return meta ?? {};
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
  const meta = getMetaEnv();
  if (key in meta) {
    return meta[key];
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

export const readOptionalEnv = (key: string, envOverride?: EnvRecord): string | undefined => {
  const raw = getEnvValue(key, envOverride);
  const normalized = normalizeString(raw);
  return normalized === '' ? undefined : normalized;
};

export const readBool = (key: string, fallback = false, envOverride?: EnvRecord): boolean =>
  coerceBoolean(getEnvValue(key, envOverride), fallback);

export const isDevMode = (envOverride?: EnvRecord): boolean => {
  if (envOverride && 'DEV' in envOverride) {
    return coerceBoolean(envOverride.DEV, false);
  }
  const meta = getMetaEnv();
  if ('DEV' in meta) {
    return coerceBoolean(meta.DEV, false);
  }
  if (typeof process !== 'undefined' && process.env && 'DEV' in process.env) {
    return coerceBoolean(process.env.DEV as Primitive, false);
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
  return env.VITE_SP_RESOURCE;
};

export const getSharePointSiteRelative = (envOverride?: EnvRecord): string => {
  const override = readEnv('VITE_SP_SITE_RELATIVE', '', envOverride).trim();
  if (override) {
    const normalized = override.startsWith('/') ? override : `/${override}`;
    return normalized.replace(/\/+$/, '');
  }
  return env.VITE_SP_SITE_RELATIVE;
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
