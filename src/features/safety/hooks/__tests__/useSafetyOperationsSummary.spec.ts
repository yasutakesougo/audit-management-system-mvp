import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommitteeSummary } from '@/domain/safety/complianceCommittee';
import type { GuidelineSummary } from '@/domain/safety/guidelineVersion';
import type { RestraintSummary } from '@/domain/safety/physicalRestraint';
import type { TrainingSummary } from '@/domain/safety/trainingRecord';
import type { IncidentSummary } from '@/domain/support/incidentRepository';

import { useSafetyOperationsSummary } from '../useSafetyOperationsSummary';

const mocks = vi.hoisted(() => ({
  getIncidents: vi.fn(),
  getRestraints: vi.fn(),
  getCommittees: vi.fn(),
  getGuidelines: vi.fn(),
  getTrainings: vi.fn(),
  computeIncidentSummary: vi.fn(),
  computeRestraintSummary: vi.fn(),
  computeCommitteeSummary: vi.fn(),
  computeGuidelineSummary: vi.fn(),
  computeTrainingSummary: vi.fn(),
  computeOverallLevel: vi.fn(),
  computeActionRequiredCount: vi.fn(),
}));

vi.mock('@/infra/localStorage/localIncidentRepository', () => ({
  localIncidentRepository: { getAll: mocks.getIncidents },
}));

vi.mock('@/infra/localStorage/localRestraintRepository', () => ({
  localRestraintRepository: { getAll: mocks.getRestraints },
}));

vi.mock('@/infra/localStorage/localComplianceRepository', () => ({
  localCommitteeRepository: { getAll: mocks.getCommittees },
  localGuidelineRepository: { getAll: mocks.getGuidelines },
  localTrainingRepository: { getAll: mocks.getTrainings },
}));

vi.mock('@/domain/support/incidentRepository', () => ({
  computeIncidentSummary: mocks.computeIncidentSummary,
}));

vi.mock('@/domain/safety/physicalRestraint', () => ({
  computeRestraintSummary: mocks.computeRestraintSummary,
}));

vi.mock('@/domain/safety/complianceCommittee', () => ({
  computeCommitteeSummary: mocks.computeCommitteeSummary,
}));

vi.mock('@/domain/safety/guidelineVersion', () => ({
  computeGuidelineSummary: mocks.computeGuidelineSummary,
}));

vi.mock('@/domain/safety/trainingRecord', () => ({
  computeTrainingSummary: mocks.computeTrainingSummary,
}));

vi.mock('@/domain/safety/safetyLevel', () => ({
  computeOverallLevel: mocks.computeOverallLevel,
  computeActionRequiredCount: mocks.computeActionRequiredCount,
}));

const incidentSummary: IncidentSummary = {
  total: 2,
  bySeverity: { '低': 0, '中': 1, '高': 1, '重大インシデント': 0 },
  byType: { behavior: 1, injury: 1, property: 0, elopement: 0, other: 0 },
  pendingFollowUp: 1,
  last30Days: 2,
};

const restraintSummary: RestraintSummary = {
  total: 1,
  byType: { その他: 1 },
  byStatus: { draft: 0, submitted: 1, approved: 0, rejected: 0 },
  pendingApproval: 1,
  last30Days: 1,
  avgDurationMinutes: 15,
  incompleteRequirements: 0,
};

const committeeSummary: CommitteeSummary = {
  totalMeetings: 4,
  currentFiscalYearMeetings: 4,
  byType: { 定期開催: 4 },
  lastMeetingDate: '2026-05-01',
  nextRecommendedDate: '2026-08-01',
  meetsQuarterlyRequirement: true,
  restraintDiscussionRate: 100,
};

const guidelineSummary: GuidelineSummary = {
  totalVersions: 1,
  currentVersion: '1.0',
  currentEffectiveDate: '2026-04-01',
  currentFulfilledItems: 7,
  currentFulfillmentRate: 100,
  allItemsFulfilled: true,
  lastUpdatedAt: '2026-04-01T00:00:00.000Z',
};

const trainingSummary: TrainingSummary = {
  totalTrainings: 2,
  currentFiscalYearTrainings: 2,
  byType: { 身体拘束等適正化研修: 2 },
  lastTrainingDate: '2026-05-15',
  nextRecommendedDate: '2026-11-15',
  meetsBiannualRequirement: true,
  averageAttendanceRate: 100,
  totalParticipantCount: 8,
};

describe('useSafetyOperationsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getIncidents.mockResolvedValue(['incident']);
    mocks.getRestraints.mockResolvedValue(['restraint']);
    mocks.getCommittees.mockResolvedValue(['committee']);
    mocks.getGuidelines.mockResolvedValue(['guideline']);
    mocks.getTrainings.mockResolvedValue(['training']);

    mocks.computeIncidentSummary.mockReturnValue(incidentSummary);
    mocks.computeRestraintSummary.mockReturnValue(restraintSummary);
    mocks.computeCommitteeSummary.mockReturnValue(committeeSummary);
    mocks.computeGuidelineSummary.mockReturnValue(guidelineSummary);
    mocks.computeTrainingSummary.mockReturnValue(trainingSummary);
    mocks.computeOverallLevel.mockReturnValue('critical');
    mocks.computeActionRequiredCount.mockReturnValue(2);
  });

  it('5つのデータ源を集約して安全管理サマリを返す', async () => {
    const { result } = renderHook(() => useSafetyOperationsSummary());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mocks.computeIncidentSummary).toHaveBeenCalledWith(['incident']);
    expect(mocks.computeRestraintSummary).toHaveBeenCalledWith(['restraint']);
    expect(mocks.computeCommitteeSummary).toHaveBeenCalledWith(['committee']);
    expect(mocks.computeGuidelineSummary).toHaveBeenCalledWith(['guideline']);
    expect(mocks.computeTrainingSummary).toHaveBeenCalledWith(['training']);
    expect(mocks.computeOverallLevel).toHaveBeenCalledWith({
      incident: incidentSummary,
      restraint: restraintSummary,
      committee: committeeSummary,
      guideline: guidelineSummary,
      training: trainingSummary,
    });
    expect(result.current.summary).toEqual({
      incident: incidentSummary,
      restraint: restraintSummary,
      committee: committeeSummary,
      guideline: guidelineSummary,
      training: trainingSummary,
      overallLevel: 'critical',
      actionRequiredCount: 2,
    });
  });

  it('reloadで全データ源を再取得する', async () => {
    const { result } = renderHook(() => useSafetyOperationsSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.reload();
    });

    expect(mocks.getIncidents).toHaveBeenCalledTimes(2);
    expect(mocks.getRestraints).toHaveBeenCalledTimes(2);
    expect(mocks.getCommittees).toHaveBeenCalledTimes(2);
    expect(mocks.getGuidelines).toHaveBeenCalledTimes(2);
    expect(mocks.getTrainings).toHaveBeenCalledTimes(2);
  });
});
