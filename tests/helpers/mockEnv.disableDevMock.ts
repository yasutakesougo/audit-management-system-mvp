import { vi } from 'vitest';

/**
 * spClient の DevMock を無効化するための vi.mock factory
 * 
 * **用途:**
 * - spClient の retry/error/etag 系 unit test で real fetch を観測する際に使用
 * - DevMock の shouldMock 分岐を false 固定にして、契約テスト（fetch 動作）を可能にする
 * 
 * **重要:** 
 * - この factory は `vi.hoisted` 内で dynamic import して使う（TDZ 回避）
 * - 関数そのものを `vi.mock` に渡す（即時実行しない）
 * 
 * @example
 * ```typescript
 * import { vi } from 'vitest';
 * 
 * const envFactory = vi.hoisted(() =>
 *   import('../helpers/mockEnv.disableDevMock').then((m) => m.envFactoryDisableDevMock)
 * );
 * 
 * vi.mock('@/lib/env', envFactory);
 * 
 * import { createSpClient } from '@/lib/spClient'; // vi.mock の後に import
 * ```
 * 
 * @see ARCHITECTURE_GUARDS.md - DevMock と Contract Tests を共存させるルール
 */
export async function envFactoryDisableDevMock() {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  
  // Default config for tests (msal.ts reads getAppConfig at module load time)
  const defaultConfig = {
    VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
    VITE_SP_SITE_RELATIVE: '/sites/demo',
    VITE_SP_RETRY_MAX: '3',
    VITE_SP_RETRY_BASE_MS: '100',
    VITE_SP_RETRY_MAX_DELAY_MS: '5000',
    VITE_MSAL_CLIENT_ID: '',
    VITE_MSAL_TENANT_ID: '',
    VITE_MSAL_TOKEN_REFRESH_MIN: '300',
    VITE_AUDIT_DEBUG: '',
    VITE_AUDIT_BATCH_SIZE: '',
    VITE_AUDIT_RETRY_MAX: '',
    VITE_AUDIT_RETRY_BASE: '',
    VITE_E2E: '',
    schedulesCacheTtlSec: 60,
    graphRetryMax: 2,
    graphRetryBaseMs: 100,
    graphRetryCapMs: 200,
    schedulesTz: 'Asia/Tokyo',
    schedulesWeekStart: 1,
    isDev: false,
  } as const;
  
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
    getAppConfig: vi.fn(() => defaultConfig),
  };
}
