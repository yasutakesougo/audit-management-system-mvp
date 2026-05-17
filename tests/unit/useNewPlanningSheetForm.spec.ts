import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock routing
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock hooks and auth
vi.mock('@/features/assessment/hooks/useTokuseiSurveyResponses', () => ({
  useTokuseiSurveyResponses: () => ({
    responses: [],
    status: 'success',
    refresh: vi.fn(),
  }),
}));

vi.mock('@/features/users/useUsers', () => ({
  useUsers: () => ({
    data: [
      { UserID: 'I005', FullName: '利用者 五郎', Status: 'active' },
      { UserID: 'I006', FullName: '利用者 六郎', Status: 'active' },
    ],
  }),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({
    account: { name: 'テスト職員' },
  }),
}));

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({
    role: 'staff',
  }),
}));

vi.mock('@/features/planning-sheet/hooks/useLatestBehaviorMonitoring', () => ({
  useLatestBehaviorMonitoring: () => ({
    record: null,
    isLoading: false,
  }),
}));

vi.mock('@/features/monitoring/data/useMonitoringMeetingRepository', () => ({
  useMonitoringMeetingRepository: () => ({}),
}));

vi.mock('@/features/ibd/analysis/iceberg/SharePointIcebergRepository', () => ({
  useIcebergRepository: () => ({
    getLatestByUser: vi.fn(),
  }),
}));

vi.mock('@/features/monitoring/hooks/useMonitoringAbcEvidence', () => ({
  useMonitoringAbcEvidence: () => ({
    records: [],
    loading: false,
    error: null,
    period: null,
  }),
}));

vi.mock('@/features/planning-sheet/stores/importAuditStore', () => ({
  useImportAuditStore: () => ({
    saveAuditRecord: vi.fn(),
  }),
}));

import { useNewPlanningSheetForm } from '@/features/planning-sheet/components/new-form/hooks/useNewPlanningSheetForm';
import { INITIAL_FORM, SAMPLE_FORM } from '@/features/planning-sheet/components/new-form/constants';

describe('useNewPlanningSheetForm', () => {
  const mockPlanningSheetRepo = {
    create: vi.fn().mockResolvedValue({ id: 'new-sheet-123' }),
  } as any;

  const mockIspRepo = {
    getCurrentByUser: vi.fn().mockResolvedValue({ id: 'isp-current-123' }),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初期状態が正しくセットアップされること', () => {
    const { result } = renderHook(() => useNewPlanningSheetForm({
      planningSheetRepo: mockPlanningSheetRepo,
      ispRepo: mockIspRepo,
    }));

    expect(result.current.selectedUser).toBeNull();
    expect(result.current.ispId).toBeNull();
    expect(result.current.activeStep).toBe(0);
    expect(result.current.form).toEqual(INITIAL_FORM);
    expect(result.current.isSaving).toBe(false);
  });

  it('利用者を選択すると、現行個別支援計画を正しく取得して紐付けること', async () => {
    const { result } = renderHook(() => useNewPlanningSheetForm({
      planningSheetRepo: mockPlanningSheetRepo,
      ispRepo: mockIspRepo,
    }));

    await act(async () => {
      await result.current.handleUserSelect(null, { id: 'I005', label: '利用者 五郎 (I005)' });
    });

    expect(mockIspRepo.getCurrentByUser).toHaveBeenCalledWith('I005');
    expect(result.current.selectedUser).toEqual({ id: 'I005', label: '利用者 五郎 (I005)' });
    expect(result.current.ispId).toBe('isp-current-123');
    expect(result.current.ispWarning).toBeNull();
  });

  it('updateField でフォームの各フィールドを更新できること', () => {
    const { result } = renderHook(() => useNewPlanningSheetForm({
      planningSheetRepo: mockPlanningSheetRepo,
      ispRepo: mockIspRepo,
    }));

    act(() => {
      result.current.updateField('title', 'テスト支援計画タイトル');
    });

    expect(result.current.form.title).toBe('テスト支援計画タイトル');
  });

  it('handleFillSample を呼ぶと、サンプルデータでフォームが埋まること', () => {
    const { result } = renderHook(() => useNewPlanningSheetForm({
      planningSheetRepo: mockPlanningSheetRepo,
      ispRepo: mockIspRepo,
    }));

    act(() => {
      result.current.handleFillSample();
    });

    expect(result.current.form).toEqual(SAMPLE_FORM);
  });

  it('ステップの切り替えができること', () => {
    const { result } = renderHook(() => useNewPlanningSheetForm({
      planningSheetRepo: mockPlanningSheetRepo,
      ispRepo: mockIspRepo,
    }));

    act(() => {
      result.current.setActiveStep(2);
    });

    expect(result.current.activeStep).toBe(2);
  });
});
