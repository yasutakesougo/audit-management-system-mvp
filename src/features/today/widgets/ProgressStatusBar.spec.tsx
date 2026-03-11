import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressStatusBar, type TodayProgressSummary } from './ProgressStatusBar';

const baseSummary: TodayProgressSummary = {
  pendingRecordCount: 0,
  totalRecordCount: 12,
  pendingAttendanceCount: 0,
  pendingBriefingCount: 0,
};

describe('ProgressStatusBar', () => {
  it('shows pending counts when there are unfinished items', () => {
    render(
      <ProgressStatusBar
        summary={{
          ...baseSummary,
          pendingRecordCount: 5,
          pendingAttendanceCount: 3,
          pendingBriefingCount: 2,
        }}
      />
    );

    expect(screen.getByText(/未記録 5件/)).toBeInTheDocument();
    expect(screen.getByText(/出欠未確認 3名/)).toBeInTheDocument();
    expect(screen.getByText(/申し送り 2件/)).toBeInTheDocument();
    expect(screen.getByText(/7\/12 完了/)).toBeInTheDocument();
  });

  it('shows completion message when all items are done', () => {
    render(
      <ProgressStatusBar
        summary={{
          ...baseSummary,
          pendingRecordCount: 0,
          pendingAttendanceCount: 0,
          pendingBriefingCount: 0,
        }}
      />
    );

    expect(screen.getByText(/本日の業務はすべて完了しています/)).toBeInTheDocument();
    // 未完了チップは表示されない
    expect(screen.queryByText(/未記録/)).not.toBeInTheDocument();
  });

  it('does not render any CTA buttons', () => {
    render(
      <ProgressStatusBar
        summary={{
          ...baseSummary,
          pendingRecordCount: 10,
          pendingBriefingCount: 3,
        }}
      />
    );

    // ボタンが一切ない（CTA なしの進捗要約に徹する）
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('only shows chips for non-zero counts', () => {
    render(
      <ProgressStatusBar
        summary={{
          ...baseSummary,
          pendingRecordCount: 7,
          pendingAttendanceCount: 0,
          pendingBriefingCount: 0,
        }}
      />
    );

    expect(screen.getByText(/未記録 7件/)).toBeInTheDocument();
    expect(screen.queryByText(/出欠未確認/)).not.toBeInTheDocument();
    expect(screen.queryByText(/申し送り/)).not.toBeInTheDocument();
  });
});
