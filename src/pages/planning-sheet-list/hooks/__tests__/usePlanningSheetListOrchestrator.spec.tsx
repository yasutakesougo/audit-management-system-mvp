import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlanningSheetListOrchestrator } from '../usePlanningSheetListOrchestrator';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mocks
const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

const mockRepo = {
  listCurrentByUser: vi.fn(),
  getById: vi.fn(),
};

vi.mock('@/features/planning-sheet/hooks/usePlanningSheetRepositories', () => ({
  usePlanningSheetRepositories: () => mockRepo,
}));

const mockIcebergRepo = {
  getLatestByUser: vi.fn(),
};

vi.mock('@/features/ibd/analysis/iceberg/SharePointIcebergRepository', () => ({
  useIcebergRepository: () => mockIcebergRepo,
}));

vi.mock('@/features/users/useUsers', () => ({
  useUsers: () => ({ data: [{ UserID: 'U001', UserName: 'Test' }] }),
}));

describe('usePlanningSheetListOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('userId');
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  );

  it('userId 未選択時はシート一覧が空であること', async () => {
    const { result } = renderHook(() => usePlanningSheetListOrchestrator(), { wrapper });
    
    expect(result.current.viewModel?.userId).toBeNull();
    expect(result.current.viewModel?.sheets).toEqual([]);
  });

  it('userId 選択時、データフェッチが成功し viewModel が構築されること', async () => {
    mockSearchParams.set('userId', 'U001');
    mockRepo.listCurrentByUser.mockResolvedValue([{ id: 's1', isCurrent: true }]);
    mockRepo.getById.mockResolvedValue({ id: 's1', assessment: { targetBehaviors: [] } });
    mockIcebergRepo.getLatestByUser.mockResolvedValue(null);

    const { result } = renderHook(() => usePlanningSheetListOrchestrator(), { wrapper });

    await waitFor(() => {
      expect(result.current.viewModel?.sheets.length).toBe(1);
      expect(result.current.viewModel?.isLoading).toBe(false);
    });
  });

  it('フェッチエラー時に error 状態が更新されること', async () => {
    mockSearchParams.set('userId', 'U001');
    mockRepo.listCurrentByUser.mockRejectedValue(new Error('Fetch failed'));

    const { result } = renderHook(() => usePlanningSheetListOrchestrator(), { wrapper });

    await waitFor(() => {
      expect(result.current.viewModel?.error).toBe('Fetch failed');
      expect(result.current.viewModel?.isLoading).toBe(false);
    });
  });

  it('userId 切替時に古い fetch 結果が混入しないこと', async () => {
    // 最初のユーザー
    mockSearchParams.set('userId', 'U001');
    mockRepo.listCurrentByUser.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([{ id: 's1' }]), 50)));
    
    const { result, rerender } = renderHook(() => usePlanningSheetListOrchestrator(), { wrapper });

    // 完了前にユーザー切り替え
    mockSearchParams.set('userId', 'U002');
    mockRepo.listCurrentByUser.mockResolvedValue([{ id: 's2' }]);
    rerender();

    await waitFor(() => {
      expect(result.current.viewModel?.userId).toBe('U002');
      expect(result.current.viewModel?.sheets[0]?.id).toBe('s2');
    });
  });

  it('current sheet がない場合、details フェッチが行われないこと', async () => {
    mockSearchParams.set('userId', 'U001');
    mockRepo.listCurrentByUser.mockResolvedValue([{ id: 's1', isCurrent: false }]);
    
    renderHook(() => usePlanningSheetListOrchestrator(), { wrapper });

    await waitFor(() => {
      expect(mockRepo.getById).not.toHaveBeenCalled();
    });
  });
});
