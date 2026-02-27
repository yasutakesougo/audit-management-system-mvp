import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttendanceSummaryCard } from './AttendanceSummaryCard';

describe('AttendanceSummaryCard', () => {
  it('displays attendance counts', () => {
    render(
      <AttendanceSummaryCard
        facilityAttendees={12}
        absenceCount={2}
        absenceNames={['田中', '山田']}
        lateOrEarlyLeave={1}
        lateOrEarlyNames={['佐藤']}
      />
    );

    expect(screen.getByText(/通所中 12名/)).toBeInTheDocument();
    expect(screen.getByText(/欠席 2名/)).toBeInTheDocument();
    expect(screen.getByText(/遅刻・早退 1名/)).toBeInTheDocument();
    expect(screen.getByText(/田中、山田/)).toBeInTheDocument();
  });

  it('hides absence chip when count is 0', () => {
    render(
      <AttendanceSummaryCard
        facilityAttendees={15}
        absenceCount={0}
        absenceNames={[]}
        lateOrEarlyLeave={0}
        lateOrEarlyNames={[]}
      />
    );

    expect(screen.getByText(/通所中 15名/)).toBeInTheDocument();
    expect(screen.queryByText(/欠席/)).not.toBeInTheDocument();
    expect(screen.queryByText(/遅刻/)).not.toBeInTheDocument();
  });

  it('has data-testid for integration testing', () => {
    render(
      <AttendanceSummaryCard
        facilityAttendees={10}
        absenceCount={0}
        absenceNames={[]}
        lateOrEarlyLeave={0}
        lateOrEarlyNames={[]}
      />
    );

    expect(screen.getByTestId('today-attendance-card')).toBeInTheDocument();
  });
});
