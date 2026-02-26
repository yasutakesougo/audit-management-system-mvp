import { getRuntimeEnv } from '@/env';
import { z } from 'zod';

const TIME_24H_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Helper to parse boolean from string ("true", "1", "false", "0")
 */
const zBoolFromString = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.toLowerCase().trim();
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  }
  return false;
}, z.boolean());

/**
 * Helper to parse integer from string
 */
const zIntFromString = (fallback: number) => z.preprocess((val) => {
  if (typeof val === 'number') return val;
  const parsed = parseInt(String(val), 10);
  return isNaN(parsed) ? fallback : parsed;
}, z.number());

const zFloatFromString = (fallback: number) => z.preprocess((val) => {
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? fallback : parsed;
}, z.number());

/**
 * Helper for optional URLs that handles empty strings/nulls as undefined
 */
const zOptionalUrl = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  return val;
}, z.string().url().optional());

/**
 * Environment variable schema for Audit Management System.
 * Enforces strict typing and presence of required infrastructure variables.
 */
export const envSchema = z.object({
  // Infrastructure (Required)
  VITE_SP_RESOURCE: z.string().url(),
  VITE_SP_SITE_RELATIVE: z.string().startsWith('/'),
  VITE_MSAL_CLIENT_ID: z.string().min(1),
  VITE_MSAL_TENANT_ID: z.string().min(1),

  // MSAL / Auth
  VITE_MSAL_TOKEN_REFRESH_MIN: zIntFromString(300),
  VITE_MSAL_SCOPES: z.string().optional().default(''),
  VITE_MSAL_LOGIN_SCOPES: z.string().optional().default(''),
  VITE_LOGIN_SCOPES: z.string().optional().default(''),
  VITE_SP_SCOPE_DEFAULT: z.string().optional(),
  VITE_AAD_CLIENT_ID: z.string().optional(),
  VITE_AAD_TENANT_ID: z.string().optional(),
  VITE_SP_LIST_SCHEDULES: z.string().optional(),
  VITE_SP_LIST_USERS: z.string().optional(),
  VITE_SP_LIST_DAILY: z.string().optional(),
  VITE_SP_LIST_STAFF: z.string().optional(),
  VITE_MSAL_AUTHORITY: zOptionalUrl,
  VITE_MSAL_REDIRECT_URI: z.string().optional(),
  VITE_MSAL_LOGIN_FLOW: z.string().optional().default('popup'),
  VITE_AZURE_CLIENT_ID: z.string().optional(),
  VITE_AZURE_TENANT_ID: z.string().optional(),

  // SharePoint Configuration
  VITE_SP_RETRY_MAX: zIntFromString(4),
  VITE_SP_RETRY_BASE_MS: zIntFromString(400),
  VITE_SP_RETRY_MAX_DELAY_MS: zIntFromString(5000),
  VITE_SP_LIST_ACTIVITY_DIARY: z.string().optional().default('ActivityDiary'),
  VITE_SP_LIST_STAFF_ATTENDANCE: z.string().optional().default('StaffAttendance'),
  VITE_SP_LIST_STAFF_GUID: z.string().optional(),
  VITE_SP_LIST_PLAN_GOAL: z.string().optional().default('PlanGoals'),
  VITE_SP_LIST_NURSE_OBSERVATION: z.string().optional().default('NurseObservations'),
  VITE_SP_LIST_MEETING_SESSIONS: z.string().optional().default('MeetingSessions'),
  VITE_SP_LIST_MEETING_STEPS: z.string().optional().default('MeetingSteps'),
  VITE_SP_HANDOFF_LIST_TITLE: z.string().optional().default('Handoff'),
  VITE_SP_HANDOFF_LIST_ID: z.string().optional(),
  VITE_SCHEDULES_LIST_TITLE: z.string().optional().default('Schedules'),
  VITE_SP_TENANT: z.string().optional(),
  VITE_SP_SITE: z.string().optional(),
  VITE_SP_SITE_URL: z.string().optional(), // Legacy support
  VITE_FORCE_SHAREPOINT: zBoolFromString.optional().default(false),
  VITE_ALLOW_SHAREPOINT_OUTSIDE_SPFX: zBoolFromString.optional().default(false),
  VITE_SKIP_SHAREPOINT: zBoolFromString.optional().default(false),
  VITE_SKIP_LOGIN: zBoolFromString.optional().default(false),

  // Feature Flags
  VITE_FEATURE_SCHEDULES: zBoolFromString.optional().default(false),
  VITE_FEATURE_SCHEDULES_GRAPH: zBoolFromString.optional().default(false),
  VITE_FEATURE_SCHEDULES_SP: zBoolFromString.optional().default(false),
  VITE_FEATURE_SCHEDULES_WEEK_V2: zBoolFromString.optional().default(false),
  VITE_FEATURE_USERS_CRUD: zBoolFromString.optional().default(false),
  VITE_FEATURE_STAFF_ATTENDANCE: zBoolFromString.optional().default(false),
  VITE_FEATURE_ICEBERG_PDCA: zBoolFromString.optional().default(false),
  VITE_FEATURE_COMPLIANCE_FORM: zBoolFromString.optional().default(false),
  VITE_FEATURE_HYDRATION_HUD: zBoolFromString.optional().default(false),
  VITE_FEATURE_APPSHELL_VSCODE: zBoolFromString.optional().default(false),
  VITE_HANDOFF_STORAGE: z.string().optional().default('local'),
  VITE_STAFF_ATTENDANCE_STORAGE: z.string().optional().default('local'),
  VITE_MEETING_PERSISTENCE_ENABLED: zBoolFromString.optional().default(false),
  VITE_NURSE_SYNC_SP: zBoolFromString.optional().default(false),
  VITE_DEMO_MODE: zBoolFromString.optional().default(false),
  VITE_FORCE_DEMO: zBoolFromString.optional().default(false),

  // Debugging & E2E
  VITE_E2E: zBoolFromString.optional().default(false),
  VITE_E2E_MSAL_MOCK: zBoolFromString.optional().default(false),
  VITE_MSAL_MOCK: zBoolFromString.optional().default(false),
  VITE_AUDIT_DEBUG: zBoolFromString.optional().default(false),
  VITE_AUDIT_BATCH_SIZE: zIntFromString(20),
  VITE_AUDIT_RETRY_MAX: zIntFromString(3),
  VITE_AUDIT_RETRY_BASE: zIntFromString(500),
  VITE_DEV: zBoolFromString.optional().default(false),
  VITE_DEBUG_ENV: zBoolFromString.optional().default(false),
  VITE_E2E_ENFORCE_AUDIENCE: zBoolFromString.optional().default(false),
  VITE_HANDOFF_DEBUG: zBoolFromString.optional().default(false),
  VITE_ENABLE_MEETING_LOG: zBoolFromString.optional().default(false),
  VITE_MEETING_LOG_MASK_USER: zBoolFromString.optional().default(false),
  VITE_SCHEDULES_DEBUG: zBoolFromString.optional().default(false),
  VITE_STAFF_ATTENDANCE_WRITE: zBoolFromString.optional().default(false),

  // Schedules specific
  VITE_SCHEDULES_TZ: z.string().optional().default(''),
  VITE_SCHEDULES_WEEK_START: zIntFromString(1),
  VITE_SCHEDULES_CACHE_TTL: zIntFromString(60),
  VITE_GRAPH_RETRY_MAX: zIntFromString(2),
  VITE_GRAPH_RETRY_BASE_MS: zIntFromString(300),
  VITE_GRAPH_RETRY_CAP_MS: zIntFromString(2000),
  VITE_SCHEDULES_SAVE_MODE: z.enum(['real', 'mock']).optional().default('real'),


  // Additional identifiers (found in code)
  VITE_AAD_ADMIN_GROUP_ID: z.string().optional(),
  VITE_AAD_RECEPTION_GROUP_ID: z.string().optional(),
  VITE_ADMIN_GROUP_ID: z.string().optional(),
  VITE_RECEPTION_GROUP_ID: z.string().optional(),
  VITE_APP_ENV: z.string().optional().default('development'),
  VITE_APP_VERSION: z.string().optional().default('0.1.0'),

  // Miscellaneous
  VITE_WRITE_ENABLED: zBoolFromString.optional().default(true),
  VITE_ALLOW_WRITE_FALLBACK: zBoolFromString.optional().default(false),

  // Service Records Configuration
  VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: zFloatFromString(0.75).superRefine((v, ctx) => {
    if (v <= 0) ctx.addIssue({ code: 'too_small' as const, minimum: 0, inclusive: false, type: 'number', message: 'Discrepancy threshold must be positive' } as unknown as Parameters<typeof ctx.addIssue>[0]);
  }),
  VITE_ABSENCE_MONTHLY_LIMIT: zIntFromString(2).superRefine((v, ctx) => {
    if (!Number.isInteger(v)) ctx.addIssue({ code: 'invalid_type' as const, expected: 'integer', received: 'float', message: 'Absence monthly limit must be an integer' });
  }),
  VITE_FACILITY_CLOSE_TIME: z.string().optional().default('18:00').superRefine((v, ctx) => {
    if (!TIME_24H_PATTERN.test(v)) ctx.addIssue({ code: 'custom', message: 'Facility close time must be HH:MM (24h)' });
  }),

  // External URLs
  VITE_TOKUSEI_FORMS_URL: zOptionalUrl,

  // Firebase / Firestore (PR #600 Support)
  VITE_FIREBASE_API_KEY: z.string().optional(),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  VITE_FIREBASE_PROJECT_ID: z.string().optional(),
  VITE_FIREBASE_APP_ID: z.string().optional(),
  VITE_FIREBASE_AUTH_MODE: z.string().optional(),
  VITE_FIREBASE_TOKEN_EXCHANGE_URL: zOptionalUrl,
  VITE_FIREBASE_AUTH_ALLOW_ANON_FALLBACK: zBoolFromString.optional().default(false),
  VITE_FIRESTORE_USE_EMULATOR: zBoolFromString.optional().default(false),
  VITE_FIRESTORE_EMULATOR_HOST: z.string().optional().default('127.0.0.1'),
  VITE_FIRESTORE_EMULATOR_PORT: zIntFromString(8080),
}).passthrough();

export type EnvSchema = z.infer<typeof envSchema> & { [key: string]: unknown };
export const appEnvSchema = envSchema;
export type ParsedEnv = EnvSchema;

// Compatibility alias for AppEnvSchema if needed in env.ts
export const AppEnvSchema = envSchema;

/**
 * Direct schema-only parsing (bypasses validation safety/placeholders)
 * Used by tests to verify strict schema behavior.
 * Merges minimal infra placeholders to avoid "missing field" noise during partial schema tests.
 */
export function parseEnv(raw: Record<string, unknown>): EnvSchema {
  const placeholders = {
  };
  return envSchema.parse({ ...placeholders, ...raw });
}

/**
 * Validates the environment dictionary against the schema.
 * Throws a detailed multiline error message if validation fails.
 */
export function validateEnv(raw: Record<string, unknown>): EnvSchema {
  const isTest =
    (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST)) ||
    (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === 'test');

  const placeholders = {
  };

  // Pre-merge for tests to improve safeParse success rate and provide defaults
  const toParse = isTest ? { ...placeholders, ...raw } : raw;
  const result = envSchema.safeParse(toParse);

  if (!result.success) {
    const { fieldErrors } = result.error.flatten();
    const errorMessages = Object.entries(fieldErrors)
      .map(([field, errors]) => `  - ${field}: ${errors?.join(', ')}`)
      .join('\n');

    const message = `[env] Validation failed:\n${errorMessages}\n\nPlease check your .env file or build settings.`;

    if (isTest) {
      // In test environment, we log a warning but return a best-effort object to keep tests running.
      // We prioritize successfully parsed/coerced values from result.data if any exist.
      console.warn(`[env] Test environment validation warning:\n${errorMessages}`);
      return {
        ...placeholders,
        ...raw,
        ...(result.data || {}),
      } as EnvSchema;
    }

    throw new Error(message);
  }

  return result.data;
}

let cachedParsedEnv: EnvSchema | null = null;

export function getParsedEnv(overrides?: Partial<EnvSchema>): EnvSchema {
  const base = (globalThis as unknown as { __TEST_ENV__?: Record<string, unknown> }).__TEST_ENV__ || getRuntimeEnv() || import.meta.env;

  if (overrides) {
    // Overrides always bypass cache
    return parseEnv({ ...(base as unknown as Record<string, unknown>), ...overrides });
  }

  if (cachedParsedEnv) return cachedParsedEnv;

  cachedParsedEnv = validateEnv(base as unknown as Record<string, unknown>);
  return cachedParsedEnv;
}

export function resetParsedEnvForTests() {
  cachedParsedEnv = null;
}


