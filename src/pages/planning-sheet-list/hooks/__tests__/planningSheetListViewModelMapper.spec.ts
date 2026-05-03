import { describe, it, expect } from 'vitest';
import { mapToPlanningSheetListViewModel, MapperInput } from '../planningSheetListViewModelMapper';
import type { PlanningSheetListViewModel } from '../../types';
import type { IcebergSnapshot } from '@/features/ibd/analysis/iceberg/icebergTypes';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import type { IUserMaster } from '@/features/users/types';

describe('planningSheetListViewModelMapper', () => {
  const mockUser = {
    UserID: 'U001',
    UserName: 'テスト太郎',
    IsHighIntensitySupportTarget: true,
  } as unknown as IUserMaster;

  const mockIceberg = {
    sessionId: 'session-1',
    updatedAt: '2026-05-01T10:00:00Z',
    nodes: [
      { id: 'n1', type: 'behavior', label: '他害(叩く)', updatedAt: '2026-05-01T10:00:00Z' },
      { id: 'n2', type: 'background', label: '騒音', updatedAt: '2026-05-01T10:00:00Z' },
    ],
    links: [
      { sourceNodeId: 'n2', targetNodeId: 'n1', confidence: 'high' }
    ],
  } as unknown as IcebergSnapshot;

  const mockCurrentSheet = {
    assessment: {
      targetBehaviors: [{ name: '自傷行為' }],
      hypotheses: [{ function: '注意獲得' }],
    }
  } as unknown as SupportPlanningSheet;

  const baseInput: MapperInput = {
    userId: 'U001',
    sheets: [],
    isLoading: false,
    error: null,
    allUsers: [mockUser],
    latestIcebergSnapshot: null,
    currentSheetDetails: null,
  };

  it('現行支援計画に氷山分析の主要行動が未反映の場合、高レベル insight を出すこと', () => {
    const input: MapperInput = {
      ...baseInput,
      latestIcebergSnapshot: mockIceberg,
      currentSheetDetails: mockCurrentSheet,
    };
    const vm = mapToPlanningSheetListViewModel(input);

    expect(vm.differenceInsight).toBeDefined();
    const behaviorChange = vm.differenceInsight?.changes.find(c => c.label === '行動');
    expect(behaviorChange?.level).toBe('high');
    expect(behaviorChange?.value).toContain('他害(叩く)');
  });

  it('背景要因が仮説に未反映の場合、中レベル insight を出すこと', () => {
    // 行動は一致させて、要因だけ不一致にする
    const currentSheetWithMatchingBehavior = {
      assessment: {
        targetBehaviors: [{ name: '他害(叩く)' }],
        hypotheses: [{ function: '空腹' }],
      }
    } as unknown as SupportPlanningSheet;

    const input: MapperInput = {
      ...baseInput,
      latestIcebergSnapshot: mockIceberg,
      currentSheetDetails: currentSheetWithMatchingBehavior,
    };
    const vm = mapToPlanningSheetListViewModel(input);

    expect(vm.differenceInsight).toBeDefined();
    const factorChange = vm.differenceInsight?.changes.find(c => c.label === '要因');
    expect(factorChange?.level).toBe('medium');
    expect(factorChange?.value).toContain('騒音');
  });

  it('IsHighIntensitySupportTarget が false の場合、氷山分析導線を無効化すること', () => {
    const nonTargetUser = { ...mockUser, IsHighIntensitySupportTarget: false };
    const input: MapperInput = {
      ...baseInput,
      allUsers: [nonTargetUser],
    };
    const vm = mapToPlanningSheetListViewModel(input);

    expect(vm.isIcebergTarget).toBe(false);
  });

  it('iceberg snapshot が存在しない場合、Difference Insight を出さないこと', () => {
    const input: MapperInput = {
      ...baseInput,
      latestIcebergSnapshot: null,
      currentSheetDetails: mockCurrentSheet,
    };
    const vm = mapToPlanningSheetListViewModel(input);

    expect(vm.differenceInsight).toBeUndefined();
    expect(vm.icebergSummary).toBeUndefined();
  });

  it('ステータスに応じた色が正しくマッピングされること', () => {
    const input: MapperInput = {
      ...baseInput,
      sheets: [
        { id: '1', status: 'active' } as unknown as (PlanningSheetListViewModel['sheets'][0]),
        { id: '2', status: 'revision_pending' } as unknown as (PlanningSheetListViewModel['sheets'][0]),
      ],
    };
    const vm = mapToPlanningSheetListViewModel(input);

    expect(vm.sheets[0].statusColor).toBe('success');
    expect(vm.sheets[1].statusColor).toBe('warning');
  });
});
