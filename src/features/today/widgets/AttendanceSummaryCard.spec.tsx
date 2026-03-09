import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttendanceSummaryCard } from './AttendanceSummaryCard';

describe('AttendanceSummaryCard', () => {
  it('displays attendance counts with absence breakdown', () => {
    render(
      <AttendanceSummaryCard
        scheduledCount={20}
        facilityAttendees={12}
        sameDayAbsenceCount={2}
        sameDayAbsenceNames={['田中', '山田']}
        priorAbsenceCount={1}
        priorAbsenceNames={['佐藤']}
        lateOrEarlyLeave={1}
        lateOrEarlyNames={['鈴木']}
      />
    );

    expect(screen.getByText(/予定 20名/)).toBeInTheDocument();
    expect(screen.getByText(/通所済 12名/)).toBeInTheDocument();
    expect(screen.getByText(/当日欠席 2名/)).toBeInTheDocument();
    expect(screen.getByText(/事前欠席 1名/)).toBeInTheDocument();
    expect(screen.getByText(/遅刻・早退 1名/)).toBeInTheDocument();
    expect(screen.getByText(/田中、山田/)).toBeInTheDocument();
    expect(screen.getByText(/佐藤/)).toBeInTheDocument();
  });

  it('shows 記録重要 label for same-day absence', () => {
    render(
      <AttendanceSummaryCard
        scheduledCount={15}
        facilityAttendees={10}
        sameDayAbsenceCount={3}
        sameDayAbsenceNames={['田中', '山田', '鈴木']}
        priorAbsenceCount={0}
        priorAbsenceNames={[]}
        lateOrEarlyLeave={0}
        lateOrEarlyNames={[]}
      />
    );

    expect(screen.getByTestId('same-day-absence-important')).toBeInTheDocument();
    expect(screen.getByText('⚠ 記録重要')).toBeInTheDocument();
  });

  it('hides 記録重要 when only prior absences exist', () => {
    render(
      <AttendanceSummaryCard
        scheduledCount={15}
        facilityAttendees={12}
        sameDayAbsenceCount={0}
        sameDayAbsenceNames={[]}
        priorAbsenceCount={2}
        priorAbsenceNames={['佐藤', '高橋']}
        lateOrEarlyLeave={0}
        lateOrEarlyNames={[]}
      />
    );

    expect(screen.queryByTestId('same-day-absence-important')).not.toBeInTheDocument();
    expect(screen.getByText(/事前欠席 2名/)).toBeInTheDocument();
    expect(screen.getByText(/佐藤、高橋/)).toBeInTheDocument();
  });

  it('hides absence & late chips when counts are 0', () => {
    render(
      <AttendanceSummaryCard
        scheduledCount={15}
        facilityAttendees={15}
        sameDayAbsenceCount={0}
        sameDayAbsenceNames={[]}
        priorAbsenceCount={0}
        priorAbsenceNames={[]}
        lateOrEarlyLeave={0}
        lateOrEarlyNames={[]}
      />
    );

    expect(screen.getByText(/通所済 15名/)).toBeInTheDocument();
    expect(screen.queryByText(/当日欠席/)).not.toBeInTheDocument();
    expect(screen.queryByText(/事前欠席/)).not.toBeInTheDocument();
    expect(screen.queryByText(/遅刻/)).not.toBeInTheDocument();
  });

  it('has data-testid for integration testing', () => {
    render(
      <AttendanceSummaryCard
        scheduledCount={10}
        facilityAttendees={10}
        sameDayAbsenceCount={0}
        sameDayAbsenceNames={[]}
        priorAbsenceCount={0}
        priorAbsenceNames={[]}
        lateOrEarlyLeave={0}
        lateOrEarlyNames={[]}
      />
    );

    expect(screen.getByTestId('today-attendance-card')).toBeInTheDocument();
  });

  it('shows empty state when all counts are 0', () => {
    render(
      <AttendanceSummaryCard
        scheduledCount={0}
        facilityAttendees={0}
        sameDayAbsenceCount={0}
        sameDayAbsenceNames={[]}
        priorAbsenceCount={0}
        priorAbsenceNames={[]}
        lateOrEarlyLeave={0}
        lateOrEarlyNames={[]}
      />
    );

    expect(screen.getByTestId('today-empty-attendance')).toBeInTheDocument();
    expect(screen.getByText('出席データがありません')).toBeInTheDocument();
    expect(screen.getByTestId('today-attendance-card')).toBeInTheDocument();
  });
});
