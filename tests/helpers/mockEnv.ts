import type { EnvSchema } from '@/lib/env.schema';

/**
 * Per-test config override store.
 * vi.mock の getAppConfig が読む。
 * @internal Test infrastructure only.
 */
let testConfigOverride: Partial<EnvSchema> | null = null;

/**
 * Test用デフォルト AppConfig。
 * msal.ts が module load で読むため、全必須キーを埋める必要がある。
 *
 * @param overrides - 上書きするキーと値
 * @returns EnvSchema
 *
 * @example
 * const config = createBaseTestAppConfig({ isDev: true });
 */
export function createBaseTestAppConfig(
  overrides: Partial<EnvSchema> = {}
): EnvSchema {
  const baseConfig = {
    VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
    VITE_SP_SITE_URL: 'https://contoso.sharepoint.com/sites/demo',
    VITE_SP_SITE_RELATIVE: '/sites/demo',
    VITE_SP_RETRY_MAX: 3,
    VITE_SP_RETRY_BASE_MS: 10,
    VITE_SP_RETRY_MAX_DELAY_MS: 50,
    VITE_MSAL_CLIENT_ID: '00000000-0000-0000-0000-000000000000',
    VITE_MSAL_TENANT_ID: 'test-tenant',
    VITE_MSAL_TOKEN_REFRESH_MIN: 300,
    VITE_AUDIT_DEBUG: false,
    VITE_AUDIT_BATCH_SIZE: 20,
    VITE_AUDIT_RETRY_MAX: 3,
    VITE_AUDIT_RETRY_BASE: 500,
    VITE_E2E: false,
    VITE_E2E_MSAL_MOCK: false,
    VITE_DEMO_MODE: false,
    VITE_SKIP_LOGIN: false,
    VITE_SKIP_SHAREPOINT: false,
    VITE_FORCE_SHAREPOINT: false,
    VITE_FEATURE_SCHEDULES: false,
    VITE_FEATURE_SCHEDULES_GRAPH: false,
    VITE_FEATURE_SCHEDULES_SP: false,
    VITE_FEATURE_SCHEDULES_WEEK_V2: false,
    VITE_FEATURE_USERS_CRUD: false,
    VITE_FEATURE_STAFF_ATTENDANCE: false,
    VITE_FEATURE_ICEBERG_PDCA: false,
    VITE_FEATURE_COMPLIANCE_FORM: false,
    VITE_FEATURE_HYDRATION_HUD: false,
    VITE_FEATURE_APPSHELL_VSCODE: false,
    VITE_HANDOFF_STORAGE: 'local',
    VITE_STAFF_ATTENDANCE_STORAGE: 'local',
    VITE_MEETING_PERSISTENCE_ENABLED: false,
    VITE_NURSE_SYNC_SP: false,
    VITE_WRITE_ENABLED: true,
    VITE_ALLOW_WRITE_FALLBACK: false,
    VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: 0.75,
    VITE_ABSENCE_MONTHLY_LIMIT: 2,
    VITE_FACILITY_CLOSE_TIME: '18:00',
    VITE_SCHEDULES_TZ: 'Asia/Tokyo',
    VITE_SCHEDULES_WEEK_START: 1,
    VITE_SCHEDULES_CACHE_TTL: 60,
    VITE_GRAPH_RETRY_MAX: 2,
    VITE_GRAPH_RETRY_BASE_MS: 300,
    VITE_GRAPH_RETRY_CAP_MS: 2000,
    VITE_SCHEDULES_SAVE_MODE: 'real',
    VITE_APP_ENV: 'test',
    VITE_APP_VERSION: '0.1.0',
    VITE_DEV: false,
    VITE_DEBUG_ENV: false,
    VITE_E2E_ENFORCE_AUDIENCE: false,
    VITE_HANDOFF_DEBUG: false,
    VITE_ENABLE_MEETING_LOG: false,
    VITE_MEETING_LOG_MASK_USER: false,
    VITE_SCHEDULES_DEBUG: false,
    VITE_STAFF_ATTENDANCE_WRITE: false,
    VITE_MSAL_SCOPES: '',
    VITE_MSAL_LOGIN_SCOPES: '',
    VITE_LOGIN_SCOPES: '',
    VITE_SP_SCOPE_DEFAULT: '',
    VITE_AAD_CLIENT_ID: '',
    VITE_AAD_TENANT_ID: '',
    VITE_MSAL_LOGIN_FLOW: 'popup',
    VITE_SP_LIST_SCHEDULES: 'Schedules',
    VITE_SP_LIST_ACTIVITY_DIARY: 'ActivityDiary',
    VITE_SP_LIST_DAILY: 'DailyRecords',
    VITE_SP_LIST_STAFF: 'Staff',
    VITE_SP_LIST_STAFF_ATTENDANCE: 'StaffAttendance',
    VITE_SP_LIST_USERS: 'Users',
    VITE_SP_LIST_PLAN_GOAL: 'PlanGoals',
    VITE_SP_LIST_NURSE_OBSERVATION: 'NurseObservations',
    VITE_SP_LIST_MEETING_SESSIONS: 'MeetingSessions',
    VITE_SP_LIST_MEETING_STEPS: 'MeetingSteps',
    VITE_SP_HANDOFF_LIST_TITLE: 'Handoff',
    VITE_SCHEDULES_LIST_TITLE: 'Schedules',
    isDev: false,
  };

  return { ...baseConfig, ...overrides } as EnvSchema;
}

/**
 * Merge base config with per-test overrides.
 * Used by vi.mock factory to support per-test config customization.
 * @internal Called by vi.mock factory only.
 */
export function mergeTestConfig(overrides?: Partial<EnvSchema>): EnvSchema {
  const base = createBaseTestAppConfig();
  const merged = { ...base, ...(testConfigOverride || {}) };
  if (overrides) {
    return { ...merged, ...overrides };
  }
  return merged;
}

/**
 * Set per-test config override. Call this before the test that needs custom config.
 * Must be followed by resetTestConfigOverride() in afterEach.
 *
 * @param overrides - Config keys to override for this test
 */
export function setTestConfigOverride(overrides: Partial<EnvSchema>): void {
  testConfigOverride = overrides;
  // Also sync with the global test env to satisfy the Proxy-based 'env' export
  /* eslint-disable @typescript-eslint/no-explicit-any */
  (globalThis as any).__TEST_ENV__ = {
     ...((globalThis as any).__TEST_ENV__ || {}),
     ...overrides
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * Reset per-test config override. Should be called in afterEach.
 * @internal
 */
export function resetTestConfigOverride(): void {
  testConfigOverride = null;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  delete (globalThis as any).__TEST_ENV__;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
