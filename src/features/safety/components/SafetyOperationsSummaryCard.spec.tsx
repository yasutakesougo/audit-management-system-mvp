import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SafetyOperationsSummaryCard from './SafetyOperationsSummaryCard';
import type { SafetyOperationsSummary } from '../hooks/useSafetyOperationsSummary';

const navigateMock = vi.fn();

const useSafetyOperationsSummaryMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/features/safety/hooks/useSafetyOperationsSummary', () => ({
  useSafetyOperationsSummary: () => useSafetyOperationsSummaryMock(),
}));

function createSummary(overrides: Partial<SafetyOperationsSummary> = {}): SafetyOperationsSummary {
  return {
    incident: {
      total: 3,
      bySeverity: { 低: 1, 中: 1, 高: 1, 重大インシデント: 0 },
      byType: {
        behavior: 1,
        injury: 1,
        property: 1,
        elopement: 0,
        other: 0,
      },
      pendingFollowUp: 1,
      last30Days: 3,
    },
    restraint: {
      total: 2,
      byType: { その他: 2 },
      byStatus: { draft: 0, submitted: 1, approved: 1, rejected: 0 },
      pendingApproval: 0,
      last30Days: 2,
      avgDurationMinutes: 20,
      incompleteRequirements: 0,
    },
    committee: {
      totalMeetings: 3,
      currentFiscalYearMeetings: 3,
      byType: { 定期開催: 3 },
      lastMeetingDate: '2026-04-01',
      nextRecommendedDate: '2026-07-01',
      meetsQuarterlyRequirement: true,
      restraintDiscussionRate: 75,
    },
    guideline: {
      totalVersions: 1,
      currentVersion: '1.0',
      currentEffectiveDate: '2026-01-01',
      currentFulfilledItems: 5,
      currentFulfillmentRate: 70,
      allItemsFulfilled: false,
      lastUpdatedAt: '2026-05-01T00:00:00.000Z',
    },
    training: {
      totalTrainings: 1,
      currentFiscalYearTrainings: 1,
      byType: { 身体拘束等適正化研修: 1 },
      lastTrainingDate: '2026-03-10',
      nextRecommendedDate: '2026-09-10',
      meetsBiannualRequirement: false,
      averageAttendanceRate: 90,
      totalParticipantCount: 12,
    },
    overallLevel: 'critical',
    actionRequiredCount: 1,
    ...overrides,
  };
}

describe('SafetyOperationsSummaryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
  });

  it('loading=true のとき LinearProgress のみを表示する', () => {
    useSafetyOperationsSummaryMock.mockReturnValue({
      summary: null,
      loading: true,
    });

    render(<SafetyOperationsSummaryCard />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('安全管理サマリ')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '適正化運用ダッシュボードを開く' })).not.toBeInTheDocument();
  });

  it('critical summary で要対応件数と主要数値と導線を表示する', () => {
    useSafetyOperationsSummaryMock.mockReturnValue({
      summary: createSummary(),
      loading: false,
      reload: vi.fn(),
    });

    render(<SafetyOperationsSummaryCard />);

    expect(screen.getByText('要対応事項: 1件')).toBeInTheDocument();
    expect(screen.getByText('要対応')).toBeInTheDocument();
    expect(screen.getByText('委員会（年4回）')).toBeInTheDocument();
    expect(screen.getByText('指針（7項目充足）')).toBeInTheDocument();
    expect(screen.getByText('研修（年2回）')).toBeInTheDocument();
    expect(screen.getByText('インシデント')).toBeInTheDocument();
    expect(screen.getByText('身体拘束')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: '適正化運用ダッシュボードを開く' });
    fireEvent.click(button);
    expect(navigateMock).toHaveBeenCalledWith('/admin/compliance-dashboard');
  });
});
