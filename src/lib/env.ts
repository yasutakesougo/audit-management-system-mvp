import { env as baseEnv, getIsDemo, getIsE2E, getIsMsalMock, resetBaseEnvCache, type EnvRecord } from '@/env';
import { getParsedEnv, resetParsedEnvForTests, validateEnv, type EnvSchema } from './env.schema';
export type { EnvRecord };

export type AppConfig = EnvSchema;

/**
 * Audit Management System - Environment Variables (Single Source of Truth)
 *
 * This module extends the raw @/env with Zod validation and provides
 * type-safe access to all configuration.
 */

export const getRuntimeEnv = () => (globalThis as { __TEST_ENV__?: EnvRecord }).__TEST_ENV__ || baseEnv;

// 1. Initialize and Validate (Fail Fast)
try {
  validateEnv(getRuntimeEnv() as EnvRecord);
} catch (error) {
  console.error('[env] CRITICAL: Environment validation failed.', error);
  throw error;
}

/**
 * The validated, typed environment object. (Proxy-based for test reactivity)
 */
export const env: EnvSchema = new Proxy({} as EnvSchema, {
  get(_, prop) {
    if (typeof prop !== 'string') return undefined;
    return getParsedEnv()[prop as keyof EnvSchema];
  },
  ownKeys() {
    return Reflect.ownKeys(getParsedEnv());
  },
  getOwnPropertyDescriptor(_, prop) {
    return Reflect.getOwnPropertyDescriptor(getParsedEnv(), prop);
  },
});

// --- Derived Helpers (Dynamic) ---

export const getSPResource = () => (env.VITE_SP_RESOURCE || '').replace(/\/+$/, '');
export const getSPSiteRelative = () => {
  const raw = env.VITE_SP_SITE_RELATIVE || '';
  const normalized = raw.replace(/\/+$/, '');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};
export const getSPBaseUrl = () => `${getSPResource()}${getSPSiteRelative()}`;
export const getSPApiWebUrl = () => `${getSPBaseUrl()}/_api/web`;

/** @deprecated Use getSPResource() or env.VITE_SP_RESOURCE */
export const SP_RESOURCE = getSPResource();
/** @deprecated Use getSPSiteRelative() or env.VITE_SP_SITE_RELATIVE */
export const SP_SITE_RELATIVE = getSPSiteRelative();
/** @deprecated Use getSPBaseUrl() */
export const SP_BASE_URL = getSPBaseUrl();
/** @deprecated Use getSPApiWebUrl() */
export const SP_API_WEB_URL = getSPApiWebUrl();

// 2. Auth Scopes
const parseScopes = (raw: string | undefined) => (raw || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);

export const getMsalScopes = () => parseScopes(env.VITE_MSAL_SCOPES);
export const getLoginScopes = () => Array.from(new Set([
  ...parseScopes(env.VITE_LOGIN_SCOPES),
  ...parseScopes(env.VITE_MSAL_LOGIN_SCOPES),
  'openid',
  'profile'
]));

/** @deprecated Use getMsalScopes() */
export const MSAL_SCOPES = getMsalScopes();
/** @deprecated Use getLoginScopes() */
export const LOGIN_SCOPES = getLoginScopes();

// 3. Modes & Feature Flags

/** @deprecated Use getIsDev() or env.VITE_DEV */
export const IS_DEV = env.VITE_DEV || env.VITE_DEBUG_ENV;
/** @deprecated Use getIsDemo() or env.VITE_DEMO_MODE */
export const IS_DEMO = env.VITE_DEMO_MODE || env.VITE_FORCE_DEMO;
/** @deprecated Use getIsE2E() */
export const IS_E2E = env.VITE_E2E;
/** @deprecated Use getIsMsalMock() */
export const IS_MSAL_MOCK = env.VITE_E2E_MSAL_MOCK;

export const isDevMode = (o?: EnvRecord) => (o ? !!o.VITE_DEV : IS_DEV);
export const isTestMode = (o?: EnvRecord) => (o ? o.VITE_APP_ENV === 'test' : env.VITE_APP_ENV === 'test');
export const isDevModeEnabled = (o?: EnvRecord) => isDevMode(o);
export const isDemoModeEnabled = (o?: EnvRecord) => (o ? !!o.VITE_DEMO_MODE : getIsDemo());
export const isForceDemoEnabled = (o?: EnvRecord) => (o ? !!o.VITE_FORCE_DEMO : env.VITE_FORCE_DEMO);

const getStorage = () => (typeof window !== 'undefined' ? window.localStorage : (globalThis as unknown as { localStorage: Storage }).localStorage);

export const shouldSkipLogin = (o?: EnvRecord): boolean => {
  // 1. Check localStorage first
  const storage = getStorage();
  if (storage) {
    try {
      const flag = storage.getItem('SKIP_LOGIN');
      if (flag !== null) {
        const s = flag.toLowerCase().trim();
        if (s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'enabled') return true;
        if (s === 'false' || s === '0' || s === 'no' || s === 'off' || s === 'disabled') return false;
      }
    } catch { /* ignore */ }
  }

  // 2. Check override object or global env
  const isDemoVal = o ? o.VITE_DEMO_MODE : getIsDemo();
  const skipLoginVal = o ? o.VITE_SKIP_LOGIN : env.VITE_SKIP_LOGIN;
  const e2eVal = o ? o.VITE_E2E : getIsE2E();
  const msalMockVal = o ? o.VITE_E2E_MSAL_MOCK : getIsMsalMock();

  const check = (v: unknown) => v === true || v === 'true' || v === '1' || (typeof v === 'string' && ['yes', 'on', 'enabled'].includes(v.toLowerCase()));

  return check(isDemoVal) || check(skipLoginVal) || check(e2eVal) || check(msalMockVal);
};

export const shouldSkipSharePoint = (o?: EnvRecord) => {
  if (o) return !!o.VITE_SKIP_SHAREPOINT;
  return env.VITE_SKIP_SHAREPOINT || getIsDemo();
};

export const skipSharePoint = (o?: EnvRecord) => shouldSkipSharePoint(o);

export const SHOULD_SKIP_LOGIN = shouldSkipLogin();
export const SHOULD_SKIP_SHAREPOINT = shouldSkipSharePoint();
export const IS_SKIP_SHAREPOINT = SHOULD_SKIP_SHAREPOINT;

const isFeatureEnabled = (name: string, envValue: boolean): boolean => {
  const storage = getStorage();
  if (storage) {
    try {
      const flag = storage.getItem(`feature:${name}`);
      if (flag === '1' || flag === 'true' || flag === 'on' || flag === 'enabled') return true;
      if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'disabled') return false;
    } catch { /* ignore */ }
  }
  return envValue;
};

export const IS_SCHEDULES_ENABLED = isFeatureEnabled('schedules', env.VITE_FEATURE_SCHEDULES);
export const IS_USERS_CRUD_ENABLED = isFeatureEnabled('usersCrud', env.VITE_FEATURE_USERS_CRUD);
export const IS_STAFF_ATTENDANCE_ENABLED = isFeatureEnabled('staffAttendance', env.VITE_FEATURE_STAFF_ATTENDANCE);
export const IS_COMPLIANCE_FORM_ENABLED = isFeatureEnabled('complianceForm', env.VITE_FEATURE_COMPLIANCE_FORM);
export const IS_ICEBERG_PDCA_ENABLED = isFeatureEnabled('icebergPdca', env.VITE_FEATURE_ICEBERG_PDCA);
export const IS_APP_SHELL_VSCODE_ENABLED = isFeatureEnabled('appShellVsCode', env.VITE_FEATURE_APPSHELL_VSCODE);

// 4. Persistence & Migration Helpers
export const ALLOW_WRITE_FALLBACK = () => env.VITE_ALLOW_WRITE_FALLBACK;
export const allowWriteFallback = ALLOW_WRITE_FALLBACK;
export const GET_SCHEDULE_SAVE_MODE = () => env.VITE_SCHEDULES_SAVE_MODE;
export const getScheduleSaveMode = GET_SCHEDULE_SAVE_MODE;

// 2. SharePoint Resource & URLs (Helpers to support overrides if needed)
export const getSharePointResource = (o?: EnvRecord) => (o ? String(o.VITE_SP_RESOURCE || '').replace(/\/+$/, '') : getSPResource());
export const getSharePointBaseUrl = (o?: EnvRecord) => {
  if (o) {
    const res = getSharePointResource(o);
    const rel = String(o.VITE_SP_SITE_RELATIVE || '').startsWith('/')
      ? String(o.VITE_SP_SITE_RELATIVE).replace(/\/+$/, '')
      : `/${String(o.VITE_SP_SITE_RELATIVE || '').replace(/\/+$/, '')}`;
    return `${res}${rel}`;
  }
  return getSPBaseUrl();
};

export const getMsalLoginScopes = (o?: EnvRecord) => {
  const parse = (raw: string | number | boolean | undefined) => String(raw || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  const rawScopes = o
    ? [...parse(o.VITE_LOGIN_SCOPES), ...parse(o.VITE_MSAL_LOGIN_SCOPES)]
    : [...parse(env.VITE_LOGIN_SCOPES), ...parse(env.VITE_MSAL_LOGIN_SCOPES)];

  const identityScopes = ['openid', 'profile'];
  const filtered = new Set<string>(['openid', 'profile']);

  for (const s of rawScopes) {
    if (identityScopes.includes(s)) {
      filtered.add(s);
    } else {
      console.warn(`[env] Ignoring non-identity login scope "${s}". Only openid/profile are requested during login.`);
    }
  }
  return Array.from(filtered);
};

export const getConfiguredMsalScopes = (o?: EnvRecord) => {
  const raw = o ? o.VITE_MSAL_SCOPES : env.VITE_MSAL_SCOPES;
  const rawStr = String(raw || '');

  // Test expectation: log error for comma-only or malformed inputs
  if (rawStr.trim() !== '' && rawStr.includes(',') && !rawStr.replace(/[\s,]/g, '')) {
    console.error('[env] Failed to parse scopes from value:', rawStr);
  }

  const scopes = rawStr.split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean);
  return Array.from(new Set(scopes));
};

export const isE2eMsalMockEnabled = (o?: EnvRecord) => {
  if (o) {
    if (o.VITE_E2E_MSAL_MOCK !== undefined) return String(o.VITE_E2E_MSAL_MOCK) === 'true' || o.VITE_E2E_MSAL_MOCK === true;
    if (o.VITE_MSAL_MOCK !== undefined) return String(o.VITE_MSAL_MOCK) === 'true' || o.VITE_MSAL_MOCK === true;
  }
  return getIsMsalMock();
};

// Feature Flags (Function aliases)
const readFlag = (key: string, storageKey: string, fallback: boolean, o?: EnvRecord) => {
  const storage = getStorage();
  if (storage) {
    try {
      const stored = storage.getItem(storageKey);
      if (stored !== null) {
        const s = stored.toLowerCase().trim();
        const result = (s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'enabled');
        if (result) return true;
        if (s === 'false' || s === '0' || s === 'no' || s === 'off' || s === 'disabled') return false;
      }
    } catch { /* ignore */ }
  }
  return readBool(key, fallback, o);
};

export const isAppShellVsCodeEnabled = (o?: EnvRecord) => readFlag('VITE_FEATURE_APPSHELL_VSCODE', 'feature:appshell_vscode', false, o);
export const isComplianceFormEnabled = (o?: EnvRecord) => readFlag('VITE_FEATURE_COMPLIANCE_FORM', 'feature:compliance_form', false, o);
export const isIcebergPdcaEnabled = (o?: EnvRecord) => readFlag('VITE_FEATURE_ICEBERG_PDCA', 'feature:iceberg_pdca', false, o);
export const isSchedulesFeatureEnabled = (o?: EnvRecord) => readFlag('VITE_FEATURE_SCHEDULES', 'feature:schedules', false, o);
export const isSchedulesWeekV2Enabled = (o?: EnvRecord) => readFlag('VITE_FEATURE_SCHEDULES_WEEK_V2', 'feature:schedules_week_v2', false, o);
export const isStaffAttendanceEnabled = (o?: EnvRecord) => readFlag('VITE_FEATURE_STAFF_ATTENDANCE', 'feature:staff_attendance', false, o);

// --- Extended Helpers ---

export const getMsalTokenRefreshMin = (o?: EnvRecord) => {
  const val = o ? Number(o.VITE_MSAL_TOKEN_REFRESH_MIN) : env.VITE_MSAL_TOKEN_REFRESH_MIN;
  return !isNaN(val) && val > 0 ? val : 300;
};

export const getSharePointSiteRelative = (o?: EnvRecord) => {
  const val = String((o ? o.VITE_SP_SITE_RELATIVE : env.VITE_SP_SITE_RELATIVE) || '');
  const normalized = val.replace(/\/+$/, '');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

export const getSharePointBaseUrlWithApi = (o?: EnvRecord) => {
  return `${getSharePointBaseUrl(o)}/_api/web`;
};

export const getSharePointDefaultScope = (o?: EnvRecord): string => {
  const explicit = String((o ? o.VITE_SP_SCOPE_DEFAULT : env.VITE_SP_SCOPE_DEFAULT) || '').trim();

  if (explicit && (explicit.includes('.default') || !explicit.includes('.sharepoint.com'))) {
     throw new Error(`Invalid SharePoint scope: ${explicit}`);
  }

  if (explicit && explicit !== '') return explicit;

  const skipLog = o ? o.VITE_SKIP_LOGIN : env.VITE_SKIP_LOGIN;
  const isDemoVal = o ? o.VITE_DEMO_MODE : IS_DEMO;
  if (isDemoVal || skipLog === 'true' || (skipLog as unknown) === true) {
    return 'https://example.sharepoint.com/AllSites.Read';
  }

  const msalScopes = getConfiguredMsalScopes(o);
  const spScope = msalScopes.find(s => s.toLowerCase().includes('.sharepoint.com') && !s.toLowerCase().endsWith('.default'));
  if (spScope) return spScope;

  const res = getSharePointResource(o);
  if (res && res !== '' && res.includes('.sharepoint.com')) {
    return `${res}/AllSites.Read`;
  }

  throw new Error('VITE_SP_SCOPE_DEFAULT is required (e.g. https://{host}.sharepoint.com/AllSites.Read)');
};

/** @deprecated Use env.VITE_... directly */
export const readEnv = (key: string, fallback?: string, override?: Record<string, unknown>) => {
  const source = (override || env) as Record<string, unknown>;
  return (source[key] ?? fallback) as string;
};

/** @deprecated Use env.VITE_... directly */
export const readBool = (key: string, fallback?: boolean, override?: Record<string, unknown>) => {
  const source = (override || env) as Record<string, unknown>;
  const val = source[key];
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.toLowerCase().trim();
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'enabled') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  }
  return !!fallback;
};

/** @deprecated Use env.VITE_... directly */
export const readOptionalEnv = (key: string, fallback?: string, override?: Record<string, unknown>) => {
  const source = (override || env) as Record<string, unknown>;
  return (source[key] ?? fallback) as string | undefined;
};

/** @deprecated Use readBool */
export const readViteBool = readBool;

/** Cache clearer helper */
export const clearEnvCache = () => {
    resetBaseEnvCache();
    resetParsedEnvForTests();
};

export const getAppConfig = () => ({
  ...env,
  isDev: IS_DEV,
  schedulesTz: env.VITE_SCHEDULES_TZ,
  schedulesWeekStart: env.VITE_SCHEDULES_WEEK_START,
  schedulesCacheTtlSec: env.VITE_SCHEDULES_CACHE_TTL,
  graphRetryMax: env.VITE_GRAPH_RETRY_MAX,
  graphRetryBaseMs: env.VITE_GRAPH_RETRY_BASE_MS,
  graphRetryCapMs: env.VITE_GRAPH_RETRY_CAP_MS,
});

/**
 * 🚀 Vitest Helper: Reset internal state for module shadowing tests
 * @internal
 */
export const __resetAppConfigForTests = () => {};
