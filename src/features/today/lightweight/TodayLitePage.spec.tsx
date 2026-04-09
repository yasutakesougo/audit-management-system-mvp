import type { TodaySummary } from '@/features/today/domain/useTodaySummary';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodayLitePage } from './TodayLitePage';

const createSummary = (): TodaySummary => ({
  attendanceSummary: { facilityAttendees: 8 },
  dailyRecordStatus: { pending: 2, completed: 0, total: 2, pendingUserIds: [] },
  todayRecordCompletion: { total: 1, completed: 0, pending: 1, pendingUserIds: ['U001'], byUser: [] },
  briefingAlerts: [{ id: 'w1', label: '申し送り未確認', count: 1, severity: 'warning' }],
  scheduleLanesToday: { staffLane: [], userLane: [], organizationLane: [] },
  serviceStructure: {},
  users: [{ UserID: 'U001' }, { UserID: 'U002' }, { UserID: 'U003' }],
  visits: {},
  todayExceptions: [{ id: 'ex-1' }],
  todayExceptionActions: [],
} as unknown as TodaySummary);

describe('TodayLitePage core workflow', () => {
  it('shows viewer core actions in fixed order', () => {
    render(<TodayLitePage summary={createSummary()} role="staff" onNavigate={vi.fn()} />);

    const buttons = [
      screen.getByTestId('today-lite-action-attendance'),
      screen.getByTestId('today-lite-action-daily-table'),
      screen.getByTestId('today-lite-action-handoff-timeline'),
    ];
    expect(buttons.map((button) => button.textContent)).toEqual([
      '出欠を確認する',
      '日々の記録を入力する',
      '申し送りを確認する',
    ]);
  });

  it('navigates viewer core actions to attendance -> table -> handoff routes', () => {
    const onNavigate = vi.fn();
    render(<TodayLitePage summary={createSummary()} role="staff" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByTestId('today-lite-action-attendance'));
    fireEvent.click(screen.getByTestId('today-lite-action-daily-table'));
    fireEvent.click(screen.getByTestId('today-lite-action-handoff-timeline'));

    expect(onNavigate).toHaveBeenNthCalledWith(1, '/daily/attendance');
    expect(onNavigate).toHaveBeenNthCalledWith(2, '/daily/table');
    expect(onNavigate).toHaveBeenNthCalledWith(3, '/handoff-timeline');
  });

  it('keeps admin reachability while preserving core flow order', () => {
    render(<TodayLitePage summary={createSummary()} role="admin" onNavigate={vi.fn()} />);

    expect(screen.getByTestId('today-lite-admin-insights')).toBeInTheDocument();
    expect(screen.getByTestId('today-lite-action-attendance')).toBeInTheDocument();
    expect(screen.getByTestId('today-lite-action-daily-table')).toBeInTheDocument();
    expect(screen.getByTestId('today-lite-action-handoff-timeline')).toBeInTheDocument();
  });

  it('hides admin insights for viewer/staff', () => {
    render(<TodayLitePage summary={createSummary()} role="staff" onNavigate={vi.fn()} />);
    expect(screen.queryByTestId('today-lite-admin-insights')).not.toBeInTheDocument();
  });
});
