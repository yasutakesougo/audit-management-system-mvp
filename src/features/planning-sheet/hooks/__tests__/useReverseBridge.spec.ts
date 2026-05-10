import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReverseBridge } from '../useReverseBridge';
import type { ExecutionRecord } from '../../../daily/domain/executionRecordTypes';
import type { WeeklyObservationRecord } from '@/domain/regulatory/weeklyObservation';

const { mockGetRecords, mockListByUser } = vi.hoisted(() => ({
  mockGetRecords: vi.fn<(date: string, userId: string) => ExecutionRecord[]>(),
  mockListByUser: vi.fn<(userId: string) => Promise<WeeklyObservationRecord[]>>(),
}));

vi.mock('../../../daily/stores/executionStore', () => ({
  useExecutionStore: () => ({
    getRecords: mockGetRecords,
  }),
}));

vi.mock('@/infra/localStorage/localStaffQualificationRepository', () => ({
  localWeeklyObservationRepository: {
    listByUser: mockListByUser,
  },
}));

describe('useReverseBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecords.mockReturnValue([]);
    mockListByUser.mockResolvedValue([]);
  });

  it('userId 未指定時はデータ取得を行わず suggestions=null を返す', async () => {
    const { result } = renderHook(() => useReverseBridge(undefined));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.suggestions).toBeNull();
    expect(result.current.error).toBeNull();

    expect(mockGetRecords).not.toHaveBeenCalled();
    expect(mockListByUser).not.toHaveBeenCalled();
  });

  it('userId 指定時は、集計期間の日次記録と週次観察記録を読み込んで提案を生成する', async () => {
    // 過去3日間の期間を設定してテストする
    const supportStartDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // 2日前

    const mockRecord: ExecutionRecord = {
      id: 'rec-1',
      date: supportStartDate,
      userId: 'U-022',
      scheduleItemId: 'sched-1',
      status: 'completed',
      triggeredBipIds: [],
      memo: '食事支援がスムーズに行われた。',
      recordedAt: new Date().toISOString(),
      recordedBy: 'staff-1',
    };

    const mockObservation: WeeklyObservationRecord = {
      id: 'obs-1',
      userId: 'U-022',
      observerId: 'obs-user',
      observerName: '佐藤中核',
      targetStaffId: 'staff-1',
      targetStaffName: '田中支援員',
      observationDate: supportStartDate,
      observationContent: '意欲的に完食された。',
      adviceContent: '引き続き見守りを行う。',
      followUpActions: 'なし',
      recordedBy: 'staff-1',
      recordedAt: new Date().toISOString(),
    };

    mockGetRecords.mockImplementation((date) => {
      if (date === supportStartDate) return [mockRecord];
      return [];
    });
    mockListByUser.mockResolvedValue([mockObservation]);

    const { result } = renderHook(() => useReverseBridge('U-022', supportStartDate));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.suggestions).not.toBeNull();
    
    // suggestions の内容確認
    const suggestions = result.current.suggestions!;
    expect(suggestions.evidenceSummary).toContain(supportStartDate);
    expect(suggestions.stats.recordCount).toBe(1);
    expect(suggestions.stats.observationCount).toBe(1);
    expect(suggestions.confidence).toBe('low');
    expect(suggestions.evidenceSummary).toContain('食事支援');
    expect(suggestions.evidenceSummary).toContain('意欲的に完食された。');
  });

  it('データ読込エラー発生時は error にエラーが設定される', async () => {
    mockListByUser.mockRejectedValue(new Error('weekly obs load failed'));

    const { result } = renderHook(() => useReverseBridge('U-022', '2026-05-01'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('weekly obs load failed');
    expect(result.current.suggestions).toBeNull();
  });
});
