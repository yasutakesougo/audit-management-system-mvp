import { z } from 'zod';

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
  const parsed = parseInt(String(val), 10);
  return isNaN(parsed) ? fallback : parsed;
}, z.number().int());

/**
 * Helper to parse comma-separated status codes into number array
 */
const zIntArrayFromString = z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    return val.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  }
  return [];
}, z.array(z.number().int()));

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

  // Auth / MSAL (Optional with defaults)
  VITE_MSAL_TOKEN_REFRESH_MIN: zIntFromString(300),
  VITE_MSAL_SCOPES: z.string().optional().default(''),
  VITE_MSAL_LOGIN_SCOPES: z.string().optional().default(''),
  VITE_LOGIN_SCOPES: z.string().optional().default(''),
  VITE_SP_SCOPE_DEFAULT: z.string().optional(),
  VITE_AAD_CLIENT_ID: z.string().optional(),
  VITE_AAD_TENANT_ID: z.string().optional(),
  VITE_MSAL_AUTHORITY: z.string().url().optional(),
  VITE_MSAL_REDIRECT_URI: z.string().optional(),

  // SharePoint Configuration
  VITE_SP_LIST_SCHEDULES: z.string().optional().default('Schedules'),
  VITE_SP_RETRY_MAX: zIntFromString(4),
  VITE_SP_RETRY_BASE_MS: zIntFromString(400),
  VITE_SP_RETRY_MAX_DELAY_MS: zIntFromString(5000),
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
  VITE_DEMO_MODE: zBoolFromString.optional().default(false),
  VITE_FORCE_DEMO: zBoolFromString.optional().default(false),

  // Debugging & E2E
  VITE_E2E: zBoolFromString.optional().default(false),
  VITE_E2E_MSAL_MOCK: zBoolFromString.optional().default(false),
  VITE_AUDIT_DEBUG: zBoolFromString.optional().default(false),
  VITE_DEV: zBoolFromString.optional().default(false),
  VITE_DEBUG_ENV: zBoolFromString.optional().default(false),

  // Schedules specific
  VITE_SCHEDULES_TZ: z.string().optional().default(''),
  VITE_SCHEDULES_WEEK_START: zIntFromString(1),
  VITE_SCHEDULES_CACHE_TTL: zIntFromString(60),
  VITE_GRAPH_RETRY_MAX: zIntFromString(2),
  VITE_GRAPH_RETRY_BASE_MS: zIntFromString(300),
  VITE_GRAPH_RETRY_CAP_MS: zIntFromString(2000),
  VITE_SCHEDULES_SAVE_MODE: z.enum(['real', 'mock']).optional().default('real'),

  // Audit feature
  VITE_AUDIT_BATCH_SIZE: zIntFromString(20),
  VITE_AUDIT_RETRY_MAX: zIntFromString(3),
  VITE_AUDIT_RETRY_BASE: zIntFromString(500),

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

  // External URLs
  VITE_TOKUSEI_FORMS_URL: z.string().url().optional(),

}).strict();

export type EnvSchema = z.infer<typeof envSchema>;

/**
 * Validates the environment dictionary against the schema.
 * Throws a detailed multiline error message if validation fails.
 */
export function validateEnv(raw: Record<string, unknown>): EnvSchema {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const { fieldErrors } = result.error.flatten();
    const errorMessages = Object.entries(fieldErrors)
      .map(([field, errors]) => `  - ${field}: ${errors?.join(', ')}`)
      .join('\n');

    throw new Error(
      `[env] Validation failed:\n${errorMessages}\n\nPlease check your .env file or build settings.`
    );
  }

  return result.data;
}
