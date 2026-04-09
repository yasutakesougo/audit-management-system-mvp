import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTodayExceptions } from '../useTodayExceptions';
import { useExceptionDataSources } from '@/features/exceptions/hooks/useExceptionDataSources';
import { useLocation } from 'react-router-dom';

vi.mock('react-router-dom', () => ({
  useLocation: vi.fn(),
}));

vi.mock('@/features/exceptions/hooks/useExceptionDataSources', () => ({
  useExceptionDataSources: vi.fn(),
}));

vi.mock('@/features/exceptions/hooks/useExceptionPreferences', () => ({
  useActiveExceptionPreferences: () => ({
    dismissedStableIds: new Set(),
    snoozedStableIds: new Set(),
  }),
}));

describe('useTodayExceptions - Signal Governance RBV', () => {
  beforeEach(() => {
    vi.mocked(useLocation).mockReturnValue({ search: '' } as any);
  });

  it('admin ロールでは setup-incomplete シグナルが表示される', () => {
    vi.mocked(useExceptionDataSources).mockReturnValue({
      status: 'ready',
      userSummaries: [{ userId: 'user-1', userName: 'User 1', isSupportProcedureTarget: false }],
      expectedUsers: [],
      todayRecords: [],
      criticalHandoffs: [],
      today: '2026-04-09',
      refetchDailyRecords: vi.fn(),
    } as any);

    const { result } = renderHook(() => useTodayExceptions({ role: 'admin' }));
    
    const hasSetupSignal = result.current.items.some(i => i.kind === 'setup-incomplete');
    expect(hasSetupSignal).toBe(true);
  });

  it('staff ロールでは setup-incomplete シグナルが抑制される', () => {
    vi.mocked(useExceptionDataSources).mockReturnValue({
      status: 'ready',
      userSummaries: [{ userId: 'user-1', userName: 'User 1', isSupportProcedureTarget: false }],
      expectedUsers: [],
      todayRecords: [],
      criticalHandoffs: [],
      today: '2026-04-09',
      refetchDailyRecords: vi.fn(),
    } as any);

    const { result } = renderHook(() => useTodayExceptions({ role: 'staff' }));
    
    const hasSetupSignal = result.current.items.some(i => i.kind === 'setup-incomplete');
    expect(hasSetupSignal).toBe(false);
  });
  
  it('staff ロールでも missing-record (ownerRole: staff) は表示される', () => {
    vi.mocked(useExceptionDataSources).mockReturnValue({
      status: 'ready',
      userSummaries: [{ userId: 'user-1', userName: 'User 1', isSupportProcedureTarget: true }],
      expectedUsers: [{ userId: 'user-1', userName: 'User 1' }],
      todayRecords: [], // Case record missing
      criticalHandoffs: [],
      today: '2026-04-09',
      refetchDailyRecords: vi.fn(),
    } as any);

    const { result } = renderHook(() => useTodayExceptions({ role: 'staff' }));
    
    const hasMissingRecord = result.current.items.some(i => i.kind === 'missing-record');
    expect(hasMissingRecord).toBe(true);
  });

  it('強度行動障害だが分析対象未設定の場合に専用シグナルが表示される', () => {
    vi.mocked(useExceptionDataSources).mockReturnValue({
      status: 'ready',
      userSummaries: [{ 
        userId: 'user-1', 
        userName: 'User 1', 
        isHighIntensity: true, 
        isSupportProcedureTarget: false 
      }],
      expectedUsers: [],
      todayRecords: [],
      criticalHandoffs: [],
      today: '2026-04-09',
      refetchDailyRecords: vi.fn(),
    } as any);

    const { result } = renderHook(() => useTodayExceptions({ role: 'admin' }));
    
    const setupSignal = result.current.items.find(i => i.kind === 'setup-incomplete');
    expect(setupSignal).toBeDefined();
    expect(setupSignal?.title).toBe('分析対象者の設定漏れ');
    expect(setupSignal?.description).toContain('強度行動障害');
    expect(setupSignal?.description).toContain('User 1');
  });
});
