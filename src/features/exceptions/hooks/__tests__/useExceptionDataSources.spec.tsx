import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useExceptionDataSources } from '../useExceptionDataSources';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';
import { useDailyRecordRepository } from '@/features/daily/repositoryFactory';
import { useHandoffData } from '@/features/handoff/hooks/useHandoffData';
import { useIspRepositories } from '@/features/support-plan-guide/hooks/useIspRepositories';

// ─── Mocks ───────────────────────────────────────────────
vi.mock('@/features/users/hooks/useUsersQuery', () => ({
  useUsersQuery: vi.fn(),
}));

vi.mock('@/features/daily/repositoryFactory', () => ({
  useDailyRecordRepository: vi.fn(),
}));

vi.mock('@/features/handoff/hooks/useHandoffData', () => ({
  useHandoffData: vi.fn(),
}));

vi.mock('@/features/support-plan-guide/hooks/useIspRepositories', () => ({
  useIspRepositories: vi.fn(),
}));

// ─── Tests ───────────────────────────────────────────────
describe('useExceptionDataSources - ISP hasPlan 結合', () => {
  const mockDailyRepo = { list: vi.fn() };
  const mockHandoffRepo = { getRecords: vi.fn() };
  const mockIspRepo = { listAllCurrent: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useDailyRecordRepository).mockReturnValue(mockDailyRepo as never);
    vi.mocked(useHandoffData).mockReturnValue({ repo: mockHandoffRepo } as never);
    vi.mocked(useIspRepositories).mockReturnValue({ ispRepo: mockIspRepo } as never);

    mockDailyRepo.list.mockResolvedValue([]);
    mockHandoffRepo.getRecords.mockResolvedValue([]);
  });

  it('current ISP を持つ user は hasPlan = true, 持たない user は hasPlan = false になる', async () => {
    vi.mocked(useUsersQuery).mockReturnValue({
      data: [
        { Id: 1, UserID: 'U-001', FullName: '山田 太郎', IsActive: true, IsHighIntensitySupportTarget: true },
        { Id: 2, UserID: 'U-002', FullName: '鈴木 次郎', IsActive: true, IsHighIntensitySupportTarget: true },
        { Id: 3, UserID: 'U-003', FullName: '佐藤 三郎', IsActive: true, IsHighIntensitySupportTarget: false },
      ],
      status: 'success',
      error: null,
      refresh: vi.fn(),
    } as never);

    mockIspRepo.listAllCurrent.mockResolvedValue([
      { userId: 'U-001', isCurrent: true }, // U-001 のみ現行計画あり
    ]);

    const { result } = renderHook(() => useExceptionDataSources());

    await waitFor(() => {
      expect(result.current.status).not.toBe('loading');
    });

    const summaries = result.current.userSummaries;

    const user1 = summaries.find((u) => u.userId === 'U-001')!;
    const user2 = summaries.find((u) => u.userId === 'U-002')!;

    // U-001: 計画あり
    expect(user1.hasPlan).toBe(true);
    // U-002: 計画なし (これによって attention-user が例外として上がる)
    expect(user2.hasPlan).toBe(false);
  });

  it('ISP 取得失敗時は安全側にフォールバックして全員の hasPlan = true になる', async () => {
    vi.mocked(useUsersQuery).mockReturnValue({
      data: [
        { Id: 1, UserID: 'U-001', FullName: '山田 太郎', IsActive: true, IsHighIntensitySupportTarget: true },
        { Id: 2, UserID: 'U-002', FullName: '鈴木 次郎', IsActive: true, IsHighIntensitySupportTarget: true },
      ],
      status: 'success',
      error: null,
      refresh: vi.fn(),
    } as never);

    // 強制的に ISP の取得を失敗させる
    mockIspRepo.listAllCurrent.mockRejectedValue(new Error('SharePoint Network Error'));

    const { result } = renderHook(() => useExceptionDataSources());

    await waitFor(() => {
      expect(result.current.status).not.toBe('loading');
    });

    const summaries = result.current.userSummaries;

    // 取得失敗時は「障害で全員が注意対象 (hasPlan: false) にならない」ための安全側 true フォールバック
    expect(summaries[0].hasPlan).toBe(true);
    expect(summaries[1].hasPlan).toBe(true);

    // ISP単体のエラーにより全体の status は error にならない（画面を壊さない）
    expect(result.current.status).not.toBe('error');
    // でもエラー自体は拾える（必要に応じて警告などが出せるように）
    expect(result.current.error).toBe('SharePoint Network Error');
  });
});
