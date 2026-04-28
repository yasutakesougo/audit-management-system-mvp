import { describe, expect, it, vi } from 'vitest';
import { runHealthChecks } from '../checks';
import type { HealthContext, ListSpec } from '../types';
import type { SpAdapter } from '../spAdapter';

describe('Health Checks — Title Essential Toleration', () => {
  const mockSp: SpAdapter = {
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1, title: 'Test User' }),
    getWebTitle: vi.fn().mockResolvedValue('Test Site'),
    getListByTitle: vi.fn().mockResolvedValue({ id: 'guid', title: 'TestList' }),
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
    listSpecs: () => [],
    isProductionLike: true,
    autonomyLevel: 'F',
  };

  it('Title のみ missing essential の場合、FAIL にならず WARN になる', async () => {
    const spec: ListSpec = {
      key: 'test_list',
      displayName: 'テストリスト',
      resolvedTitle: 'TestList',
      requiredFields: [
        { internalName: 'Title', isEssential: true, typeHint: 'Text' }
      ],
      createItem: {},
      updateItem: {},
    };

    // getFields で Title が見つからない状態をシミュレート
    vi.mocked(mockSp.getFields).mockResolvedValueOnce([]);

    const ctx = { ...baseCtx, listSpecs: () => [spec] };
    const results = await runHealthChecks(ctx, mockSp);

    const schemaCheck = results.find(r => r.key === 'schema.fields.test_list');
    expect(schemaCheck?.status).toBe('warn');
    expect(schemaCheck?.summary).toContain('Title 列が物理列一覧で解決できませんでした');
  });

  it('Title + 他の essential が missing の場合、FAIL になる', async () => {
    const spec: ListSpec = {
      key: 'test_list',
      displayName: 'テストリスト',
      resolvedTitle: 'TestList',
      requiredFields: [
        { internalName: 'Title', isEssential: true, typeHint: 'Text' },
        { internalName: 'EssentialField', isEssential: true, typeHint: 'Text' }
      ],
      createItem: {},
      updateItem: {},
    };

    // どちらも見つからない
    vi.mocked(mockSp.getFields).mockResolvedValueOnce([]);

    const ctx = { ...baseCtx, listSpecs: () => [spec] };
    const results = await runHealthChecks(ctx, mockSp);

    const schemaCheck = results.find(r => r.key === 'schema.fields.test_list');
    expect(schemaCheck?.status).toBe('fail');
    expect(schemaCheck?.detail).toContain('EssentialField');
  });

  it('Title 以外の essential が missing の場合、従来通り FAIL になる', async () => {
    const spec: ListSpec = {
      key: 'test_list',
      displayName: 'テストリスト',
      resolvedTitle: 'TestList',
      requiredFields: [
        { internalName: 'EssentialField', isEssential: true, typeHint: 'Text' }
      ],
      createItem: {},
      updateItem: {},
    };

    // EssentialField が見つからないが、Title は存在する（が必須ではない）
    vi.mocked(mockSp.getFields).mockResolvedValueOnce([
      { internalName: 'Title' }
    ]);

    const ctx = { ...baseCtx, listSpecs: () => [spec] };
    const results = await runHealthChecks(ctx, mockSp);

    const schemaCheck = results.find(r => r.key === 'schema.fields.test_list');
    expect(schemaCheck?.status).toBe('fail');
    expect(schemaCheck?.detail).toContain('EssentialField');
  });
});
