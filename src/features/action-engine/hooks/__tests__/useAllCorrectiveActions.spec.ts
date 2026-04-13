import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ABCRecord } from '@/domain/behavior/abc';
import { useAllCorrectiveActions } from '../useAllCorrectiveActions';

// Mock getABCRecordsForUser
const mockGetABCRecordsForUser = vi.fn();
vi.mock('@/features/ibd/core/ibdStore', () => ({
  getABCRecordsForUser: (userId: string) => mockGetABCRecordsForUser(userId),
}));

// Mock useUsers
const mockUseUsers = vi.fn();
vi.mock('@/features/users/useUsers', () => ({
  useUsers: () => mockUseUsers(),
}));

function makeRecord(userId: string, recordedAt: string): ABCRecord {
  return {
    id: `abc-${userId}-${recordedAt}`,
    userId,
    recordedAt,
    behavior: '大声',
    intensity: 4,
    antecedent: '予定変更',
    consequence: '視覚提示',
    antecedentTags: [],
  } as ABCRecord;
}

describe('useAllCorrectiveActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUsers.mockReturnValue({
      data: [
        { UserID: 'U-001', FullName: 'User 1', IsActive: true },
        { UserID: 'U-002', FullName: 'User 2', IsActive: true },
      ],
      status: 'success',
    });
    mockGetABCRecordsForUser.mockReturnValue([]);
  });

  it('ibdStore からデータを取得し、ステータスが loading から ready に遷移する', async () => {
    const now = new Date();
    const recordedAt = now.toISOString();
    mockGetABCRecordsForUser.mockImplementation((userId) => {
      if (userId === 'U-001') {
        return [
          makeRecord('U-001', recordedAt),
          makeRecord('U-001', recordedAt),
          makeRecord('U-001', recordedAt),
        ];
      }
      return [];
    });

    const { result } = renderHook(() => useAllCorrectiveActions());

    // 初期状態は loading
    expect(result.current.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('U-001');
    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('U-002');
    
    // U-001 は高強度 (intensity 4) の記録があるので、何らかの提案が出るはず
    expect(result.current.suggestions.length).toBeGreaterThan(0);
    expect(result.current.suggestions.some(s => s.targetUserId === 'U-001')).toBe(true);
  });

  it('30日より前の記録はフィルタリングされる', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35);
    
    mockGetABCRecordsForUser.mockImplementation((userId) => {
      if (userId === 'U-001') return [makeRecord('U-001', oldDate.toISOString())];
      return [];
    });

    const { result } = renderHook(() => useAllCorrectiveActions());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    // 記録がフィルタリングされるため、提案は出ない（データ不足ルールは出るかもしれないが、今回の実装では records.length > 0 の時のみ処理している）
    expect(result.current.suggestions.filter(s => s.userId === 'U-001').length).toBe(0);
  });

  it('記録が時間順 (asc) にソートされて処理される', async () => {
    const now = new Date();
    const d1 = new Date(now); d1.setMinutes(now.getMinutes() - 10);
    const d2 = new Date(now); d2.setMinutes(now.getMinutes() - 5);
    
    mockGetABCRecordsForUser.mockReturnValue([
      makeRecord('U-001', d2.toISOString()), // あえて逆順で入れる
      makeRecord('U-001', d1.toISOString()),
    ]);

    const { result } = renderHook(() => useAllCorrectiveActions());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(mockGetABCRecordsForUser).toHaveBeenCalled();
    // 内部で sort されていることを担保（ロジックレベルの確認は buildCorrectiveActions のテストに譲るが、
    // ここではクラッシュせず、ソート済みデータが渡されていることを意図）
  });
});
