import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import type { IUserMaster } from '@/features/users/types';
import { useTodayIspRenewSuggestActions } from '../useTodayIspRenewSuggestActions';

const listByUser = vi.fn();
const monitoringRepo = {
  listByUser,
};

vi.mock('@/features/monitoring/data/useMonitoringMeetingRepository', () => ({
  useMonitoringMeetingRepository: () => monitoringRepo,
}));

function makeMeeting(overrides: Partial<MonitoringMeetingRecord> = {}): MonitoringMeetingRecord {
  return {
    id: 'mtg-1',
    userId: 'U001',
    userName: '山田太郎',
    ispId: 'isp-1',
    planningSheetId: 'sheet-1',
    planningSheetTitle: '支援計画',
    meetingType: 'regular',
    meetingDate: '2026-04-10',
    venue: '会議室A',
    attendees: [],
    goalEvaluations: [],
    overallAssessment: '支援の再調整が必要',
    userFeedback: '',
    familyFeedback: '',
    planChangeDecision: 'major_revision',
    changeReason: '達成率が停滞している',
    decisions: [],
    nextMonitoringDate: '2026-05-10',
    implementationSummary: '',
    behaviorChangeSummary: '',
    effectiveSupportSummary: '',
    issueSummary: '',
    discussionSummary: '会議で見直しを決定',
    requiresPlanSheetUpdate: true,
    requiresIspUpdate: true,
    nextActions: [],
    hasBasicTrainedMember: true,
    hasPracticalTrainedMember: true,
    qualificationCheckStatus: 'ok',
    recordedBy: 'admin@example.com',
    recordedAt: '2026-04-10T09:00:00.000Z',
    status: 'finalized',
    finalizedAt: '2026-04-10T10:00:00.000Z',
    finalizedBy: 'admin@example.com',
    previousMeetingId: undefined,
    ...overrides,
  };
}

describe('useTodayIspRenewSuggestActions', () => {
  beforeEach(() => {
    listByUser.mockReset();
  });

  const targetUsers: IUserMaster[] = [
    { UserID: 'U001', IsHighIntensitySupportTarget: true } as IUserMaster,
  ];

  it('MonitoringMeeting の見直し判定を Today signal/action source に変換する', async () => {
    listByUser.mockResolvedValue([makeMeeting()]);

    const { result } = renderHook(() => useTodayIspRenewSuggestActions(targetUsers));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.signals).toHaveLength(1);
    expect(result.current.signals[0].code).toBe('isp_renew_suggest');
    expect(result.current.actionSources).toHaveLength(1);
    expect(result.current.actionSources[0].sourceType).toBe('isp_renew_suggest');
  });

  it('no_change の場合は signal を生成しない', async () => {
    listByUser.mockResolvedValue([
      makeMeeting({ planChangeDecision: 'no_change', requiresPlanSheetUpdate: false, requiresIspUpdate: false }),
    ]);

    const { result } = renderHook(() => useTodayIspRenewSuggestActions(targetUsers));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.signals).toHaveLength(0);
    expect(result.current.actionSources).toHaveLength(0);
  });

  it('対象利用者がいない場合は repository を呼ばない', async () => {
    const { result } = renderHook(() =>
      useTodayIspRenewSuggestActions([
        { UserID: 'U001', IsHighIntensitySupportTarget: false } as IUserMaster,
      ]),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(listByUser).not.toHaveBeenCalled();
    expect(result.current.signals).toHaveLength(0);
  });
});
