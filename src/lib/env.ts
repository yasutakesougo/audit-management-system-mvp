import { getRuntimeEnv } from '@/env';
import { validateEnv, type EnvSchema } from './env.schema';

/**
 * Audit Management System - Environment Variables (Single Source of Truth)
 *
 * This module validates all environment variables at startup and exports a
 * type-safe 'env' object. Direct use of import.meta.env.VITE_* is discouraged.
 */

// 1. Initialize and Validate
const rawEnv = getRuntimeEnv();
let validatedEnv: EnvSchema;

try {
  validatedEnv = validateEnv(rawEnv);
} catch (error) {
  // Fail Fast: Initialization errors are critical.
  console.error('[env] CRITICAL: Environment validation failed.', error);
  // Throwing here will be caught by ConfigErrorBoundary if it wraps the app early enough,
  // or it will crash the app visibly.
  throw error;
}

/**
 * The validated, typed environment object.
 */
export const env = validatedEnv;

// --- Derived Constants & Helper Functions ---

// 1. SharePoint Resource & URLs
export const SP_RESOURCE = env.VITE_SP_RESOURCE.replace(/\/+$/, '');
export const SP_SITE_RELATIVE = env.VITE_SP_SITE_RELATIVE.startsWith('/')
  ? env.VITE_SP_SITE_RELATIVE.replace(/\/+$/, '')
  : `/${env.VITE_SP_SITE_RELATIVE.replace(/\/+$/, '')}`;

export const SP_BASE_URL = `${SP_RESOURCE}${SP_SITE_RELATIVE}`;
export const SP_API_WEB_URL = `${SP_BASE_URL}/_api/web`;

// 2. Auth Scopes
const parseScopes = (raw: string) => raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
export const MSAL_SCOPES = parseScopes(env.VITE_MSAL_SCOPES);
export const LOGIN_SCOPES = Array.from(new Set([
  ...parseScopes(env.VITE_LOGIN_SCOPES),
  ...parseScopes(env.VITE_MSAL_LOGIN_SCOPES),
  'openid',
  'profile'
]));

// 3. Modes & Feature Flags
export const IS_DEV = env.VITE_DEV || env.VITE_DEBUG_ENV;
export const IS_DEMO = env.VITE_DEMO_MODE || env.VITE_FORCE_DEMO;
export const IS_E2E = env.VITE_E2E;
export const IS_MSAL_MOCK = env.VITE_E2E_MSAL_MOCK;
export const SHOULD_SKIP_LOGIN = env.VITE_SKIP_LOGIN || IS_DEMO || (IS_E2E && IS_MSAL_MOCK);
export const SHOULD_SKIP_SHAREPOINT = env.VITE_SKIP_SHAREPOINT || IS_DEMO;

/**
 * Check if a feature is enabled.
 * Respects both environment variables and local storage overrides.
 */
const isFeatureEnabled = (name: string, envValue: boolean): boolean => {
  if (envValue) return true;
  if (typeof window === 'undefined') return false;
  try {
    const flag = window.localStorage.getItem(`feature:${name}`);
    return flag === '1' || flag === 'true';
  } catch {
    return false;
  }
};

export const IS_SCHEDULES_ENABLED = isFeatureEnabled('schedules', env.VITE_FEATURE_SCHEDULES);
export const IS_USERS_CRUD_ENABLED = isFeatureEnabled('usersCrud', env.VITE_FEATURE_USERS_CRUD);
export const IS_STAFF_ATTENDANCE_ENABLED = isFeatureEnabled('staffAttendance', env.VITE_FEATURE_STAFF_ATTENDANCE);
export const IS_COMPLIANCE_FORM_ENABLED = isFeatureEnabled('complianceForm', env.VITE_FEATURE_COMPLIANCE_FORM);

// Legacy Re-exports for backward compatibility (optional, but helps keep code running during refactor)
export const isDevModeEnabled = () => IS_DEV;
export const isDemoModeEnabled = () => IS_DEMO;
export const shouldSkipLogin = () => SHOULD_SKIP_LOGIN;
export const getAppConfig = () => ({
  ...env,
  isDev: IS_DEV,
  schedulesTz: env.VITE_SCHEDULES_TZ,
  schedulesWeekStart: env.VITE_SCHEDULES_WEEK_START,
}) as any; // Cast as AppConfig placeholder
