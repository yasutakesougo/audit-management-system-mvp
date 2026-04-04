import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TodaySummary } from '@/features/today/domain/useTodaySummary';
import { TodayLitePage } from './TodayLitePage';

function createSummary(overrides: Partial<TodaySummary> = {}): TodaySummary {
  return {
    attendanceSummary: {
      scheduledCount: 10,
      facilityAttendees: 8,
      sameDayAbsenceCount: 0,
      sameDayAbsenceNames: [],
      priorAbsenceCount: 0,
      priorAbsenceNames: [],
      lateOrEarlyLeave: 0,
      lateOrEarlyNames: [],
    },
    dailyRecordStatus: {
      pending: 2,
      completed: 8,
      total: 10,
      pendingUserIds: ['U001', 'U002'],
    },
    todayRecordCompletion: {
      total: 10,
      completed: 8,
      pending: 2,
      pendingUserIds: ['U001', 'U002'],
    },
    briefingAlerts: [],
    scheduleLanesToday: {
      staffLane: [],
      userLane: [],
      organizationLane: [],
    },
    serviceStructure: {} as unknown as TodaySummary['serviceStructure'],
    users: [],
    visits: {},
    todayExceptions: [],
    todayExceptionActions: [],
    ...overrides,
  };
}

describe('TodayLitePage', () => {
  it('会議レーンがある場合のみ会議カードを表示する', () => {
    const onNavigate = vi.fn();
    const withMeeting = createSummary({
      scheduleLanesToday: {
        staffLane: [{ id: 'm1', title: '職員会議', time: '15:30' }],
        userLane: [],
        organizationLane: [],
      },
    });
    const { rerender } = render(<TodayLitePage summary={withMeeting} role="staff" onNavigate={onNavigate} />);
    expect(screen.getByTestId('today-lite-action-card-meeting')).toBeInTheDocument();

    const withoutMeeting = createSummary();
    rerender(<TodayLitePage summary={withoutMeeting} role="staff" onNavigate={onNavigate} />);
    expect(screen.queryByTestId('today-lite-action-card-meeting')).not.toBeInTheDocument();
  });
});
