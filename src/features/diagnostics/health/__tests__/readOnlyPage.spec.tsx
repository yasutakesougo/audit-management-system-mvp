import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthDiagnosisPage } from '../HealthDiagnosisPage';
import type { HealthContext, HealthReport } from '../types';

const dependencies = vi.hoisted(() => ({
  record: vi.fn(),
  sp: {
    getListFieldInternalNames: vi.fn().mockResolvedValue([]),
    listItems: vi.fn().mockResolvedValue([]),
    spFetch: vi.fn().mockImplementation(async () => new Response(JSON.stringify({ value: [] }), { status: 200 })),
  },
  repository: { getEvents: vi.fn().mockResolvedValue([]) },
  repairCandidates: false,
  indexPressure: false,
}));
vi.mock('@/lib/spClient', () => ({ useSP: () => dependencies.sp }));
vi.mock('@/sharepoint/healthReportAdapter', () => ({ recordHealthDiagnostics: dependencies.record }));
vi.mock('@/auth/useAuthReady', () => ({ useAuthReady: () => false }));
vi.mock('@/features/diagnostics/drift/infra/driftEventRepositoryFactory', () => ({
  useDriftEventRepository: () => dependencies.repository,
}));
vi.mock('@/features/diagnostics/remediation/hooks/useOperationalGovernance', () => ({
  useOperationalGovernance: () => ({
    recommendations: dependencies.repairCandidates ? [{
      id: 'test-repair', category: 'structural_drift', severity: 'warning',
      listTitle: 'DiagnosticTest', listKey: 'diagnostic_test', targetField: 'TestField',
      action: { type: 'create_column', label: 'Test repair', payload: {}, confidence: 'high', autoExecutable: false, tier: 'suggested', risk: 'low' },
      reason: 'Synthetic drift', sourceSignal: 'realtime',
      priority: { level: 'P2_HIGH', score: 1, summary: 'Synthetic priority', reasons: [] },
    }] : [],
    loading: false, executingIds: new Set(), results: {}, repair: vi.fn(),
  }),
}));
vi.mock('@/features/sp/health/hooks/useSpHealthSignal', () => ({
  useSpHealthSignal: () => dependencies.indexPressure ? {
    reasonCode: 'sp_index_pressure', listName: 'DiagnosticTest', message: 'Synthetic index pressure',
    severity: 'warning', source: 'realtime', occurredAt: '2026-10-07T00:00:00Z', occurrenceCount: 1,
  } : null,
}));
vi.mock('@/features/sp/health/indexAdvisor/useSpIndexCandidates', () => ({
  useSpIndexCandidates: () => ({
    additionCandidates: [{ internalName: 'TestField', displayName: 'Synthetic field', reason: 'Synthetic index need' }],
    deletionCandidates: [], loading: false, error: null, hasKnownConfig: true,
  }),
}));
afterEach(() => { dependencies.repairCandidates = false; dependencies.indexPressure = false; });

const ctx: HealthContext = {
  env: {}, siteUrl: 'https://tenant.invalid/sites/test', listSpecs: () => [],
  isProductionLike: true, autonomyLevel: 'F',
};
const report: HealthReport = {
  generatedAt: '2026-10-07T00:00:00Z', overall: 'pass', counts: { pass: 0, warn: 0, fail: 0 }, results: [],
  byCategory: Object.fromEntries(['config', 'auth', 'connectivity', 'lists', 'schema', 'permissions'].map(
    key => [key, { overall: 'pass', counts: { pass: 0, warn: 0, fail: 0 } }],
  )) as HealthReport['byCategory'],
};

describe('read-only diagnostic page', () => {
  async function renderPage() {
    await act(async () => {
      render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><HealthDiagnosisPage ctx={ctx} report={report} loading={false} error={null} run={async () => {}} /></MemoryRouter>);
    });
  }
  it('does not enable report writes even after a successful diagnosis', async () => {
    await act(async () => {
      render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><HealthDiagnosisPage ctx={ctx} report={report} loading={false} error={null} run={async () => {}} /></MemoryRouter>);
    });
    const save = screen.getByTestId('diagnostics-save');
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(dependencies.record).not.toHaveBeenCalled();
    expect(screen.getByTestId('diagnostics-readonly-notice')).toBeVisible();
  });

  it('does not expose column-repair execution when a recommendation exists', async () => {
    dependencies.repairCandidates = true;
    await renderPage();
    expect(screen.queryByRole('button', { name: '修復', exact: true })).not.toBeInTheDocument();
  });

  it('does not expose index-repair execution for index pressure', async () => {
    dependencies.indexPressure = true;
    await renderPage();
    expect(screen.queryByRole('button', { name: /今すぐ修復/ })).not.toBeInTheDocument();
  });
});
