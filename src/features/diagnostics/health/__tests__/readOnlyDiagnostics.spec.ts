import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runHealthChecks } from '../checks';
import { runAllListChecks } from '../checks/listChecks';
import { driftEventBus } from '../../drift/domain/DriftEventBus';
import type { HealthCheckResult, HealthContext, ListSpec } from '../types';
import type { SpAdapter } from '../spAdapter';
import { useHealthChecks } from '../useHealthChecks';

const auth = vi.hoisted(() => ({ acquireToken: vi.fn(), adapter: null as unknown }));
vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ acquireToken: auth.acquireToken, isAuthenticated: true, tokenReady: true, loading: false }),
}));
vi.mock('../spAdapter', () => ({ createSpAdapterWithAuth: () => auth.adapter }));

const spec: ListSpec = {
  key: 'support_record_daily', displayName: 'Diagnostic test list', resolvedTitle: 'DiagnosticTest',
  requiredFields: [], createItem: { Title: 'probe' }, updateItem: { Title: 'updated' },
};
const context: HealthContext = {
  env: { VITE_SP_RESOURCE: 'https://tenant.invalid', VITE_MSAL_CLIENT_ID: 'test-client', VITE_MSAL_TENANT_ID: 'test-tenant' },
  siteUrl: 'https://tenant.invalid/sites/test', listSpecs: () => [spec],
  isProductionLike: true, autonomyLevel: 'F',
};
function adapter() {
  return {
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1, title: 'Synthetic' }),
    getWebTitle: vi.fn().mockResolvedValue('Test'),
    getListByTitle: vi.fn().mockResolvedValue({ id: 'test-list', title: 'DiagnosticTest' }),
    getFields: vi.fn<SpAdapter['getFields']>().mockResolvedValue([]), getItemsTop1: vi.fn().mockResolvedValue([]),
    createItem: vi.fn().mockResolvedValue({ id: 2676 }),
    updateItem: vi.fn().mockResolvedValue(undefined), deleteItem: vi.fn().mockResolvedValue(undefined),
  } satisfies SpAdapter;
}
function expectNoWrites(sp: SpAdapter) {
  expect(sp.createItem).not.toHaveBeenCalled();
  expect(sp.updateItem).not.toHaveBeenCalled();
  expect(sp.deleteItem).not.toHaveBeenCalled();
}
afterEach(() => { vi.clearAllMocks(); });

describe('DIAGNOSTIC-SAFETY-V1', () => {
  it.each([
    { label: 'production', isProductionLike: true, autonomyLevel: 'F' as const },
    { label: 'unknown/nonproduction', isProductionLike: false, autonomyLevel: 'F' as const },
    { label: 'higher autonomy does not authorize writes', isProductionLike: true, autonomyLevel: 'G' as const },
  ])('$label diagnostic never executes CRUD', async (mode) => {
    const sp = adapter();
    const results = await runHealthChecks({ ...context, ...mode }, sp);
    expect(results.find(r => r.key === 'permissions.read.support_record_daily')?.status).toBe('pass');
    expectNoWrites(sp);
    expect(results.find(r => r.key === 'permissions.write.skipped.support_record_daily')).toMatchObject({
      status: 'warn', detail: 'WRITE_DIAGNOSTICS_DISABLED',
      evidence: { mode: 'READ_ONLY', writeExecuted: false },
    });
    expect(results.some(r => /^permissions\.(create|update|delete)\./.test(r.key))).toBe(false);
  });

  it('direct list diagnostics cannot bypass read-only enforcement', async () => {
    const sp = adapter();
    const results: HealthCheckResult[] = [];
    await runAllListChecks(context, sp, results);
    expectNoWrites(sp);
  });

  it('read failure never triggers write probes or write retries', async () => {
    const sp = adapter();
    sp.getItemsTop1.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    const results = await runHealthChecks(context, sp);
    expect(results.find(r => r.key === 'permissions.read.support_record_daily')?.status).toBe('fail');
    expectNoWrites(sp);
  });

  it('schema drift stays in the report without firing persistence events', async () => {
    const sp = adapter();
    sp.getFields.mockResolvedValue([{ internalName: 'fullname', staticName: 'fullname' }]);
    const events: unknown[] = [];
    const unsubscribe = driftEventBus.subscribe(event => events.push(event));
    try {
      const results = await runHealthChecks({ ...context, listSpecs: () => [{ ...spec, requiredFields: [{ internalName: 'FullName' }] }] }, sp);
      expect(results.find(r => r.key === 'schema.fields.support_record_daily')?.status).toBe('warn');
      expect(results.find(r => r.key === 'schema.fields.support_record_daily')?.evidence?.drifted).toEqual([
        { expected: 'FullName', actual: 'fullname', driftType: 'case_mismatch' },
      ]);
      expect(events).toEqual([]);
      expectNoWrites(sp);
    } finally { unsubscribe(); }
  });

  it.each([
    { label: 'case', actual: 'fullname', candidates: ['FullName'], driftType: 'case_mismatch' },
    { label: 'suffix', actual: 'FullName0', candidates: ['FullName'], driftType: 'suffix_mismatch' },
    { label: 'fallback', actual: 'LegacyName', candidates: ['FullName', 'LegacyName'], driftType: 'fallback' },
  ])('retains $label silent drift as non-persisted report evidence without a schema WARN', async (example) => {
    const sp = adapter();
    sp.getFields.mockResolvedValue([{ internalName: example.actual, staticName: example.actual }]);
    const events: unknown[] = [];
    const unsubscribe = driftEventBus.subscribe(event => events.push(event));
    try {
      const results = await runHealthChecks({ ...context, listSpecs: () => [{ ...spec,
        requiredFields: [{ internalName: 'FullName', isSilent: true, candidates: example.candidates }],
      }] }, sp);
      const schema = results.filter(result => result.category === 'schema');
      expect(schema.every(result => result.status === 'pass')).toBe(true);
      expect(schema.flatMap(result => (result.evidence?.silentDrifted ?? []) as unknown[])).toEqual([
        { expected: 'FullName', actual: example.actual, driftType: example.driftType },
      ]);
      expect(schema.some(result => result.summary === 'すべての期待列が物理名と一致しています。')).toBe(false);
      expect(events).toEqual([]);
      expectNoWrites(sp);
    } finally { unsubscribe(); }
  });

  it('retains silent evidence even when the same list has a missing essential field', async () => {
    const sp = adapter();
    sp.getFields.mockResolvedValue([{ internalName: 'fullname', staticName: 'fullname' }]);
    const events: unknown[] = [];
    const unsubscribe = driftEventBus.subscribe(event => events.push(event));
    try {
      const results = await runHealthChecks({ ...context, listSpecs: () => [{ ...spec, requiredFields: [
        { internalName: 'FullName', isSilent: true }, { internalName: 'RequiredField', isEssential: true },
      ] }] }, sp);
      expect(results.find(result => result.key === 'schema.fields.support_record_daily')?.status).toBe('fail');
      expect(results.flatMap(result => (result.evidence?.silentDrifted ?? []) as unknown[])).toEqual([
        { expected: 'FullName', actual: 'fullname', driftType: 'case_mismatch' },
      ]);
      expect(events).toEqual([]);
      expectNoWrites(sp);
    } finally { unsubscribe(); }
  });

  it('page-load hook and manual rerun are read-only', async () => {
    const sp = adapter();
    auth.adapter = sp;
    const { result } = renderHook(() => useHealthChecks(context));
    await waitFor(() => expect(result.current.report).not.toBeNull());
    expectNoWrites(sp);
    await act(async () => { await result.current.run(); });
    expect(sp.getItemsTop1).toHaveBeenCalledTimes(2);
    expectNoWrites(sp);
  });
});
