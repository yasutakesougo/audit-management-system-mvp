import type { AppConfig } from '@/lib/env';

/**
 * Per-test config override store.
 * vi.mock の getAppConfig が読む。
 * @internal Test infrastructure only.
 */
let testConfigOverride: Partial<AppConfig> | null = null;

/**
 * Test用デフォルト AppConfig。
 * msal.ts が module load で読むため、全必須キーを埋める必要がある。
 *
 * @param overrides - 上書きするキーと値
 * @returns AppConfig
 *
 * @example
 * const config = createBaseTestAppConfig({ isDev: true });
 */
export function createBaseTestAppConfig(
  overrides: Partial<AppConfig> = {}
): AppConfig {
  const baseConfig: AppConfig = {
    VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
    VITE_SP_SITE_URL: 'https://contoso.sharepoint.com/sites/demo',
    VITE_SP_SITE_RELATIVE: '/sites/demo',
    VITE_SP_RETRY_MAX: '3',
    VITE_SP_RETRY_BASE_MS: '10',
    VITE_SP_RETRY_MAX_DELAY_MS: '50',
    VITE_MSAL_CLIENT_ID: '',
    VITE_MSAL_TENANT_ID: '',
    VITE_MSAL_TOKEN_REFRESH_MIN: '300',
    VITE_AUDIT_DEBUG: '',
    VITE_AUDIT_BATCH_SIZE: '',
    VITE_AUDIT_RETRY_MAX: '',
    VITE_AUDIT_RETRY_BASE: '',
    VITE_E2E: '',
    schedulesCacheTtlSec: 300,
    graphRetryMax: 3,
    graphRetryBaseMs: 100,
    graphRetryCapMs: 1000,
    schedulesTz: 'Asia/Tokyo',
    schedulesWeekStart: 1,
    isDev: false,
  };

  return { ...baseConfig, ...overrides };
}

/**
 * Merge base config with per-test overrides.
 * Used by vi.mock factory to support per-test config customization.
 * @internal Called by vi.mock factory only.
 */
export function mergeTestConfig(overrides?: Partial<AppConfig>): AppConfig {
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
 *
 * @example
 * it('test with custom config', () => {
 *   setTestConfigOverride({ VITE_SP_RETRY_MAX: '1' });
 *   // ... test code ...
 * });
 */
export function setTestConfigOverride(overrides: Partial<AppConfig>): void {
  testConfigOverride = overrides;
}

/**
 * Reset per-test config override. Should be called in afterEach.
 * @internal
 */
export function resetTestConfigOverride(): void {
  testConfigOverride = null;
}


