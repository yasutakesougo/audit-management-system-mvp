import { describe, expect, it, vi } from 'vitest';
import { runHealthChecks } from '../checks';
import type { HealthContext } from '../types';
import type { SpAdapter } from '../spAdapter';

describe('Health Checks — Auth Gate', () => {
  const baseCtx: HealthContext = {
    env: {
      VITE_SP_RESOURCE: 'https://tenant.sharepoint.com',
      VITE_MSAL_CLIENT_ID: 'client-id',
      VITE_MSAL_TENANT_ID: 'tenant-id',
    },
    siteUrl: 'https://tenant.sharepoint.com/sites/test',
    listSpecs: () => [
      {
        key: 'users_master',
        displayName: '利用者マスタ',
        resolvedTitle: 'Users_Master',
        requiredFields: [],
        createItem: {},
        updateItem: {},
      },
    ],
    isProductionLike: true,
    autonomyLevel: 'F',
  };

  it('token未準備時は list/schema/permission checks をスキップし大量FAIL化しない', async () => {
    const sp: SpAdapter = {
      getCurrentUser: vi.fn(),
      getWebTitle: vi.fn(),
      getListByTitle: vi.fn(),
      getFields: vi.fn(),
      getItemsTop1: vi.fn(),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
    };

    const results = await runHealthChecks(baseCtx, sp, {
      hasActiveAccount: true,
      tokenReady: false,
      tokenPending: true,
    });

    expect(results.some((r) => r.key === 'auth.tokenReadiness')).toBe(true);
    expect(results.some((r) => r.key === 'lists.authGate' && r.detail === 'SKIPPED_AUTH_REQUIRED')).toBe(true);
    expect(results.some((r) => r.key.startsWith('lists.exists.'))).toBe(false);
    expect(sp.getCurrentUser).not.toHaveBeenCalled();
  });

  it('currentUserがAUTH_REQUIREDなら後続list checksをスキップする', async () => {
    const sp: SpAdapter = {
      getCurrentUser: vi.fn().mockRejectedValue(new Error('AUTH_REQUIRED')),
      getWebTitle: vi.fn().mockRejectedValue(new Error('AUTH_REQUIRED')),
      getListByTitle: vi.fn(),
      getFields: vi.fn(),
      getItemsTop1: vi.fn(),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
    };

    const results = await runHealthChecks(baseCtx, sp, {
      hasActiveAccount: true,
      tokenReady: true,
      tokenPending: false,
    });

    expect(results.find((r) => r.key === 'auth.currentUser')?.detail).toContain('AUTH_REQUIRED');
    expect(results.some((r) => r.key === 'lists.authGate' && r.detail === 'SKIPPED_AUTH_REQUIRED')).toBe(true);
    expect(results.some((r) => r.key.startsWith('lists.exists.'))).toBe(false);
    expect(sp.getListByTitle).not.toHaveBeenCalled();
  });
});
