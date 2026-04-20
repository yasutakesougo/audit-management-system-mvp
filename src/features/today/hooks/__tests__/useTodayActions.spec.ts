import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useTodayActions } from '../useTodayActions';
import { useTodayIspRenewSuggestActions } from '../useTodayIspRenewSuggestActions';
import { useUserAuthz } from '@/auth/useUserAuthz';

// Mock all dependencies
vi.mock('@/stores/useUsers', () => ({
  useUsers: () => ({ data: [{ UserID: 'U001', FullName: '山田太郎' }], isLoading: false }),
}));

vi.mock('@/features/daily/repositoryFactory', () => ({
  useDailyRecordRepository: () => ({
    list: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('@/features/daily/hooks/useDailySupportUserFilter', () => ({
  useDailySupportUserFilter: (users: any) => ({ filteredUsers: users }),
}));

vi.mock('@/lib/spClient', () => ({
  useSP: () => ({
    listItems: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../../transport/useTransportStatus', () => ({
  useTransportStatus: () => ({ isReady: true, status: { to: { overdueUserIds: [] }, from: { overdueUserIds: [] } } }),
}));

vi.mock('../useTodayIspRenewSuggestActions', () => ({
  useTodayIspRenewSuggestActions: vi.fn(),
}));

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: vi.fn(),
}));

vi.mock('@/auth/roles', () => ({
  canAccess: (role: string) => role === 'admin',
}));

// Mock @tanstack/react-query to prevent network requests
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false }),
}));

describe('useTodayActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin ユーザーの場合、planning signal があれば ActionCenterItem に変換される', async () => {
    // Admin 権限を持つよう設定
    vi.mocked(useUserAuthz).mockReturnValue({ role: 'admin', ready: true });
    
    // サンプルの planning signal を返すよう設定
    vi.mocked(useTodayIspRenewSuggestActions).mockReturnValue({
      signals: [{ id: 'signal-1', code: 'isp_renew_suggest' }] as any,
      actionSources: [],
      isLoading: false,
    });

    const { result } = renderHook(() => useTodayActions('2026-04-14'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const planningAction = result.current.actions.find(a => a.kind === 'planning');
    expect(planningAction).toBeDefined();
    expect(planningAction?.reasonCode).toBe('isp_renew_suggest');
    expect(planningAction?.count).toBe(1);
    expect(planningAction?.title).toBe('計画見直し推奨');
  });

  it('staff ユーザーの場合、planning signal があっても表示されない', async () => {
    // Staff 権限（admin以外）を設定
    vi.mocked(useUserAuthz).mockReturnValue({ role: 'viewer', ready: true });
    
    // シグナル自体は存在すると仮定
    vi.mocked(useTodayIspRenewSuggestActions).mockReturnValue({
      signals: [{ id: 'signal-1', code: 'isp_renew_suggest' }] as any,
      actionSources: [],
      isLoading: false,
    });

    const { result } = renderHook(() => useTodayActions('2026-04-14'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const planningAction = result.current.actions.find(a => a.kind === 'planning');
    expect(planningAction).toBeUndefined();
  });

  it('planning signal が空の場合、ActionCenterItem は生成されない', async () => {
    vi.mocked(useUserAuthz).mockReturnValue({ role: 'admin', ready: true });
    
    // シグナルなし
    vi.mocked(useTodayIspRenewSuggestActions).mockReturnValue({
      signals: [],
      actionSources: [],
      isLoading: false,
    });

    const { result } = renderHook(() => useTodayActions('2026-04-14'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const planningAction = result.current.actions.find(a => a.kind === 'planning');
    expect(planningAction).toBeUndefined();
  });
});
