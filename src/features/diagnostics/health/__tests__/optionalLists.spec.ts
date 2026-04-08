import { describe, expect, it, vi } from 'vitest';
import { runHealthChecks } from '../checks';
import type { HealthContext, ListSpec } from '../types';
import type { SpAdapter } from '../spAdapter';

describe('Health Checks — Optional List Contract', () => {
  const mockSp: SpAdapter = {
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1, title: 'Test User' }),
    getWebTitle: vi.fn().mockResolvedValue('Test Site'),
    getListByTitle: vi.fn(),
    getFields: vi.fn(),
    getItemsTop1: vi.fn().mockResolvedValue([]),
    createItem: vi.fn().mockResolvedValue({ id: 101 }),
    updateItem: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  };

  const baseCtx: HealthContext = {
    env: {
      VITE_SP_RESOURCE: 'https://tenant.sharepoint.com',
      VITE_MSAL_CLIENT_ID: 'client-id',
      VITE_MSAL_TENANT_ID: 'tenant-id',
    },
    siteUrl: 'https://tenant.sharepoint.com/sites/test',
    listSpecs: [],
    isProductionLike: true,
    autonomyLevel: 'F',
  };

  it('必須リストが不在の場合は FAIL を返す', async () => {
    const spec: ListSpec = {
      key: 'required_list',
      displayName: '必須リスト',
      resolvedTitle: 'RequiredList',
      requiredFields: [],
      createItem: {},
      updateItem: {},
      isOptional: false,
    };

    (mockSp.getListByTitle as any).mockRejectedValueOnce(new Error('404 Not Found'));

    const ctx = { ...baseCtx, listSpecs: [spec] };
    const results = await runHealthChecks(ctx, mockSp);

    const existenceCheck = results.find(r => r.key === 'lists.exists.required_list');
    expect(existenceCheck?.status).toBe('fail');
    expect(existenceCheck?.summary).toContain('リストが見つかりません');
  });

  it('任意(optional)リストが不在の場合は WARN を返す', async () => {
    const spec: ListSpec = {
      key: 'optional_list',
      displayName: '任意リスト',
      resolvedTitle: 'OptionalList',
      requiredFields: [],
      createItem: {},
      updateItem: {},
      isOptional: true,
    };

    (mockSp.getListByTitle as any).mockRejectedValueOnce(new Error('404 Not Found'));

    const ctx = { ...baseCtx, listSpecs: [spec] };
    const results = await runHealthChecks(ctx, mockSp);

    const existenceCheck = results.find(r => r.key === 'lists.exists.optional_list');
    expect(existenceCheck?.status).toBe('warn');
    expect(existenceCheck?.summary).toContain('任意機能のため警告扱い');
  });

  it('任意リストが存在し、スキーマが正常なら PASS を返す', async () => {
    const spec: ListSpec = {
      key: 'optional_list',
      displayName: '任意リスト',
      resolvedTitle: 'OptionalList',
      requiredFields: [],
      createItem: {},
      updateItem: {},
      isOptional: true,
    };

    (mockSp.getListByTitle as any).mockResolvedValueOnce({ id: 'guid', title: 'OptionalList' });
    (mockSp.getFields as any).mockResolvedValueOnce([]);

    const ctx = { ...baseCtx, listSpecs: [spec] };
    const results = await runHealthChecks(ctx, mockSp);

    const existenceCheck = results.find(r => r.key === 'lists.exists.optional_list');
    expect(existenceCheck?.status).toBe('pass');
  });
});
