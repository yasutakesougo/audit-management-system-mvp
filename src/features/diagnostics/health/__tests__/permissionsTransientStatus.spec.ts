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

function makeSpAdapter(readError: Error & { status: number }) {
  const getItemsTop1 = vi.fn().mockRejectedValue(readError);

  const sp: SpAdapter = {
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1, title: 'Test User' }),
    getWebTitle: vi.fn().mockResolvedValue('Test Site'),
    getListByTitle: vi.fn().mockResolvedValue({ id: '1', title: 'PermissionsTransientTest' }),
    getFields: vi.fn().mockResolvedValue([]),
    getItemsTop1,
    createItem: vi.fn().mockResolvedValue({ id: 101 }),
    updateItem: vi.fn(),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  };

  return { sp, getItemsTop1 };
}

describe('Health Checks — permissions transient status handling', () => {
  it('treats HTTP 429 on Read as WARN without write probes', async () => {
    const { sp, getItemsTop1 } = makeSpAdapter(
      makeHttpError(429, 'APIリクエストに失敗しました (429 TOO MANY REQUESTS)')
    );

    const results = await runHealthChecks(
      { ...baseCtx, listSpecs: () => [testSpec] },
      sp
    );

    const readCheck = results.find(
      (r) => r.key === 'permissions.read.permissions_transient'
    );
    expect(readCheck?.status).toBe('warn');
    expect(readCheck?.summary).toContain('一時的エラー');
    expect(getItemsTop1).toHaveBeenCalledTimes(1);
    expect(sp.createItem).not.toHaveBeenCalled();
    expect(sp.updateItem).not.toHaveBeenCalled();
    expect(sp.deleteItem).not.toHaveBeenCalled();
  });

  it('keeps HTTP 403 on Read as FAIL without retry', async () => {
    const { sp, getItemsTop1 } = makeSpAdapter(
      makeHttpError(403, 'APIリクエストに失敗しました (403 FORBIDDEN)')
    );

    const results = await runHealthChecks(
      { ...baseCtx, listSpecs: () => [testSpec] },
      sp
    );

    const readCheck = results.find(
      (r) => r.key === 'permissions.read.permissions_transient'
    );
    expect(readCheck?.status).toBe('fail');
    expect(readCheck?.summary).toContain('権限がありません');
    expect(getItemsTop1).toHaveBeenCalledTimes(1);
    expect(sp.createItem).not.toHaveBeenCalled();
  });
});
