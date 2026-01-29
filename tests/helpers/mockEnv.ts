import type { AppConfig } from '@/lib/env';

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


