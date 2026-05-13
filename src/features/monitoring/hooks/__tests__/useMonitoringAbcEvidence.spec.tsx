import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMonitoringAbcEvidence } from '../useMonitoringAbcEvidence';
import { useUser } from '@/features/users/useUsers';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { AbcRecord } from '@/domain/abc/abcRecord';

// ── モックセットアップ ──────────────────────────────────────

vi.mock('@/features/users/useUsers', () => ({
  useUser: vi.fn(),
  useUsers: vi.fn(),
}));

vi.mock('@/lib/data/useDataProvider', () => ({
  useDataProvider: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindByUserIdAndDateRange = vi.fn<any>();

vi.mock('@/infra/sharepoint/repos/SharePointAbcRecordRepository', () => {
  return {
    SharePointAbcRecordRepository: class {
      findByUserIdAndDateRange = mockFindByUserIdAndDateRange;
    },
  };
});

describe('useMonitoringAbcEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useDataProvider as any).mockReturnValue({ provider: {} });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useUser as any).mockReturnValue({ data: null, status: 'idle' });
    mockFindByUserIdAndDateRange.mockResolvedValue([]);
  });

  it('userId が空、または null の場合はリポジトリを呼ばず、空配列を返す', async () => {
    const { result } = renderHook(() =>
      useMonitoringAbcEvidence(null, '2026-05-01', 90),
    );

    expect(result.current.records).toEqual([]);
    expect(mockFindByUserIdAndDateRange).not.toHaveBeenCalled();
  });

  it('userId, supportStartDate, monitoringCycleDays がある場合、正しい期間でリポジトリを呼び出す', async () => {
    const mockRecords: AbcRecord[] = [
      {
        id: '1',
        userId: 'U001',
        userName: 'User 1',
        occurredAt: '2026-05-10T09:30:00.000Z',
        setting: '通所',
        antecedent: 'Antecedent 1',
        behavior: 'Behavior 1',
        consequence: 'Consequence 1',
        intensity: 'medium',
        durationMinutes: 5,
        riskFlag: false,
        recorderName: 'Staff 1',
        tags: [],
        notes: '',
        createdAt: '2026-05-10T09:30:00.000Z',
        sourceContext: {
          source: 'daily-support',
          date: '2026-05-10',
          slotId: '9:30頃|通所・朝の準備',
        },
      },
    ];
    mockFindByUserIdAndDateRange.mockResolvedValue(mockRecords);

    const { result } = renderHook(() =>
      useMonitoringAbcEvidence('U001', '2026-05-01', 90),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFindByUserIdAndDateRange).toHaveBeenCalledWith({
      userId: 'U001',
      from: '2026-05-01',
      to: '2026-07-30', // 2026-05-01 + 90 days
    });

    expect(result.current.records).toEqual(mockRecords);
    expect(result.current.period).toEqual({
      from: '2026-05-01',
      to: '2026-07-30',
      isProvisional: false,
      source: 'planning',
    });
  });

  it('monitoringCycleDays が未設定の場合はデフォルトで 90 日として計算する', async () => {
    const { result } = renderHook(() =>
      useMonitoringAbcEvidence('U001', '2026-05-01', undefined),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFindByUserIdAndDateRange).toHaveBeenCalledWith({
      userId: 'U001',
      from: '2026-05-01',
      to: '2026-07-30', // Default 90 days
    });
  });

  it('supportStartDate がなく、UserMaster.ServiceStartDate がある場合はそれを使用する', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useUser as any).mockReturnValue({
      data: { ServiceStartDate: '2026-04-01' },
      status: 'success',
    });

    const { result } = renderHook(() =>
      useMonitoringAbcEvidence('U001', null, 90),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFindByUserIdAndDateRange).toHaveBeenCalledWith({
      userId: 'U001',
      from: '2026-04-01',
      to: '2026-06-30', // 2026-04-01 + 90 days
    });

    expect(result.current.period?.source).toBe('master');
  });

  it('supportStartDate も ServiceStartDate もなく、appliedFrom がある場合は provisional fallback とする', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useUser as any).mockReturnValue({
      data: null,
      status: 'success',
    });

    const { result } = renderHook(() =>
      useMonitoringAbcEvidence('U001', null, 90, '2026-03-15'),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFindByUserIdAndDateRange).toHaveBeenCalledWith({
      userId: 'U001',
      from: '2026-03-15',
      to: '2026-06-13', // 2026-03-15 + 90 days
    });

    expect(result.current.period?.isProvisional).toBe(true);
    expect(result.current.period?.source).toBe('fallback');
  });
});
