import { describe, expect, it, vi } from 'vitest';
import { runHealthChecks } from '../checks';
import type { HealthContext, ListSpec } from '../types';
import type { SpAdapter } from '../spAdapter';

function makeHttpError(status: number, message: string): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}

const baseCtx: HealthContext = {
  env: {
    VITE_SP_RESOURCE: 'https://tenant.sharepoint.com',
    VITE_MSAL_CLIENT_ID: 'client-id',
    VITE_MSAL_TENANT_ID: 'tenant-id',
  },
  siteUrl: 'https://tenant.sharepoint.com/sites/test',
  listSpecs: () => [],
  isProductionLike: true,
  autonomyLevel: 'F',
};

const testSpec: ListSpec = {
  key: 'permissions_transient',
  displayName: '権限診断テスト',
  resolvedTitle: 'PermissionsTransientTest',
  requiredFields: [],
  createItem: {},
  updateItem: {},
};

function makeSpAdapter(updateError: Error & { status: number }) {
  const updateItem = vi.fn().mockRejectedValue(updateError);

  const sp: SpAdapter = {
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1, title: 'Test User' }),
    getWebTitle: vi.fn().mockResolvedValue('Test Site'),
    getListByTitle: vi.fn().mockResolvedValue({ id: '1', title: 'PermissionsTransientTest' }),
    getFields: vi.fn().mockResolvedValue([]),
    getItemsTop1: vi.fn().mockResolvedValue([]),
    createItem: vi.fn().mockResolvedValue({ id: 101 }),
    updateItem,
    deleteItem: vi.fn().mockResolvedValue(undefined),
  };

  return { sp, updateItem };
}

describe('Health Checks — permissions transient status handling', () => {
  it('treats HTTP 429 on Update as WARN and retries', async () => {
    const { sp, updateItem } = makeSpAdapter(
      makeHttpError(429, 'APIリクエストに失敗しました (429 TOO MANY REQUESTS)')
    );

    const results = await runHealthChecks(
      { ...baseCtx, listSpecs: () => [testSpec] },
      sp
    );

    const updateCheck = results.find(
      (r) => r.key === 'permissions.update.permissions_transient'
    );
    expect(updateCheck?.status).toBe('warn');
    expect(updateCheck?.summary).toContain('一時的エラー');
    expect(updateItem).toHaveBeenCalledTimes(3);
  });

  it('keeps HTTP 403 on Update as FAIL without retry', async () => {
    const { sp, updateItem } = makeSpAdapter(
      makeHttpError(403, 'APIリクエストに失敗しました (403 FORBIDDEN)')
    );

    const results = await runHealthChecks(
      { ...baseCtx, listSpecs: () => [testSpec] },
      sp
    );

    const updateCheck = results.find(
      (r) => r.key === 'permissions.update.permissions_transient'
    );
    expect(updateCheck?.status).toBe('fail');
    expect(updateCheck?.summary).toContain('権限がありません');
    expect(updateItem).toHaveBeenCalledTimes(1);
  });
});
