import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useExceptionCenterOrchestrator } from '../useExceptionCenterOrchestrator';
import { useExceptionDataSources } from '../useExceptionDataSources';
import { useBridgeExceptions } from '../useBridgeExceptions';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';
import { usePersistentDrift } from '@/features/diagnostics/drift/hooks/usePersistentDrift';

vi.mock('../useExceptionDataSources');
vi.mock('../useBridgeExceptions');
vi.mock('@/features/users/hooks/useUsersQuery');
vi.mock('@/features/diagnostics/drift/hooks/usePersistentDrift');

describe('useExceptionCenterOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useUsersQuery as any).mockReturnValue({ data: [] });
    (useBridgeExceptions as any).mockReturnValue({ exceptions: [], isLoading: false });
    (useExceptionDataSources as any).mockReturnValue({
      status: 'ready',
      expectedUsers: [],
      todayRecords: [],
      criticalHandoffs: [],
      userSummaries: [],
      dataOSResolutions: {},
      integrityExceptions: [],
      today: '2026-04-07',
    });
  });

  it('integrates persistent drifts into the exception list with correct mapping', () => {
    const mockDrifts = [
      {
        id: 'drift-123',
        listName: 'Users_Master',
        fieldName: 'UserCode',
        agingDays: 5,
        detectedAt: '2026-04-02T10:00:00Z',
        driftType: 'case_mismatch',
      },
    ];

    (usePersistentDrift as any).mockReturnValue({
      items: mockDrifts,
      isLoading: false,
    });

    const { result } = renderHook(() => useExceptionCenterOrchestrator());

    const driftItem = result.current.items.find(i => i.id.startsWith('drift-'));
    expect(driftItem).toBeDefined();
    expect(driftItem?.title).toBe('[⚠️ 持続的ドリフト] Users_Master');
    expect(driftItem?.severity).toBe('high');
    expect(driftItem?.category).toBe('integrity');
    expect(driftItem?.description).toContain("不整合が 5日間 放置されています");
    expect(driftItem?.remediationProposal).toBeDefined();
    expect(driftItem?.remediationProposal?.impact).toContain('大文字小文字を定義に合わせます');
  });

  it('shows loading state when persistent drift is loading', () => {
    (usePersistentDrift as any).mockReturnValue({
      items: [],
      isLoading: true,
    });

    const { result } = renderHook(() => useExceptionCenterOrchestrator());
    expect(result.current.isLoading).toBe(true);
  });
});
