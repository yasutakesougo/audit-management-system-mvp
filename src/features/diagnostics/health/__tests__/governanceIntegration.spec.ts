import { describe, expect, it, vi } from 'vitest';
import { runHealthChecks } from '../checks';
import type { HealthContext, ListSpec } from '../types';
import type { SpAdapter } from '../spAdapter';
import { presentGovernanceDecision } from '../../governance/governancePresenter';

describe('Governance Integration — runHealthChecks Flow', () => {
  const mockSp: SpAdapter = {
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1 }),
    getWebTitle: vi.fn().mockResolvedValue('Test Site'),
    getListByTitle: vi.fn().mockResolvedValue({ id: '1', title: 'TestList' }),
    getFields: vi.fn().mockResolvedValue([]),
    getItemsTop1: vi.fn().mockResolvedValue([]),
    createItem: vi.fn().mockResolvedValue({ id: 101 }),
    updateItem: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  };

  const baseCtx: HealthContext = {
    env: { VITE_SP_RESOURCE: 'https://test', VITE_MSAL_CLIENT_ID: 'cid', VITE_MSAL_TENANT_ID: 'tid' },
    siteUrl: 'https://test',
    listSpecs: [],
    isProductionLike: true,
    autonomyLevel: 'G',
  };

  it('detects a "case_mismatch" drift and attaches Level G "auto_heal" decision', async () => {
    const spec: ListSpec = {
      key: 'test_list',
      displayName: 'テストリスト',
      resolvedTitle: 'TestList',
      requiredFields: [{ internalName: 'FullName' }], // 期待
      createItem: {},
      updateItem: {},
    };

    // Mocks
    (mockSp.getCurrentUser as any).mockResolvedValue({ id: 1 });
    (mockSp.getWebTitle as any).mockResolvedValue('Site');
    (mockSp.getListByTitle as any).mockResolvedValue({ id: '1', title: 'TestList' });
    (mockSp.getItemsTop1 as any).mockResolvedValue([]);
    
    // actual fields has "fullname" (case mismatch)
    (mockSp.getFields as any).mockResolvedValue([{ internalName: 'fullname', staticName: 'fullname' }]);

    const results = await runHealthChecks({ ...baseCtx, listSpecs: [spec] }, mockSp);

    const schemaResult = results.find(r => r.key === 'schema.fields.test_list');
    expect(schemaResult).toBeDefined();
    expect(schemaResult?.status).toBe('warn');
    
    // Check governance decision attached
    expect(schemaResult?.governance).toBeDefined();
    expect(schemaResult?.governance?.action).toBe('auto_heal');
    expect(schemaResult?.governance?.riskLevel).toBe('low');

    // Verify presenter translates it correctly
    const ui = presentGovernanceDecision(schemaResult?.governance);
    expect(ui.badgeLabel).toBe('自動補正対象');
  });

  it('handles "suffix_mismatch" in Level G as "propose"', async () => {
     const spec: ListSpec = {
      key: 'test_list',
      displayName: 'テストリスト',
      resolvedTitle: 'TestList',
      requiredFields: [{ internalName: 'Status' }], 
      createItem: {},
      updateItem: {},
    };

    (mockSp.getCurrentUser as any).mockResolvedValue({ id: 1 });
    (mockSp.getWebTitle as any).mockResolvedValue('Site');
    (mockSp.getListByTitle as any).mockResolvedValue({ id: '1', title: 'TestList' });
    (mockSp.getItemsTop1 as any).mockResolvedValue([]);
    
    // suffix mismatch
    (mockSp.getFields as any).mockResolvedValue([{ internalName: 'Status0', staticName: 'Status0' }]);

    const results = await runHealthChecks({ ...baseCtx, listSpecs: [spec] }, mockSp);

    const schemaResult = results.find(r => r.key === 'schema.fields.test_list');
    expect(schemaResult?.governance?.action).toBe('propose');
    
    const ui = presentGovernanceDecision(schemaResult?.governance);
    expect(ui.badgeLabel).toBe('管理者確認推奨');
  });
});
