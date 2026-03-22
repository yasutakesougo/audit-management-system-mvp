/**
 * HandoffWeekView — コンポーネントテスト
 *
 * 主にU6改善 (pending badge) の視覚信号を検証する:
 * 1. 過去日の取りこぼし (overdue) バッジ表示
 * 2. 全件対応済みマーカー表示
 * 3. 週サマリーバーの残件警告
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WeekDaySummary, WeekSummary } from '../hooks/useHandoffWeekViewModel';
import { HandoffWeekView } from '../components/HandoffWeekView';

// ── Helpers ──

function makeDaySummary(overrides: Partial<WeekDaySummary> = {}): WeekDaySummary {
  return {
    date: '2026-03-09',
    label: '3/9 月',
    dayOfWeek: 1,
    count: 0,
    criticalCount: 0,
    unhandledCount: 0,
    topCategories: [],
    hasIncident: false,
    isToday: false,
    isFuture: false,
    ...overrides,
  };
}

function makeWeekSummary(days: WeekDaySummary[]): WeekSummary {
  let totalCount = 0;
  let criticalCount = 0;
  let unhandledCount = 0;
  let hasIncident = false;

  for (const d of days) {
    totalCount += d.count;
    criticalCount += d.criticalCount;
    unhandledCount += d.unhandledCount;
    if (d.hasIncident) hasIncident = true;
  }

  return {
    days,
    totalCount,
    criticalCount,
    unhandledCount,
    topCategories: [],
    hasIncident,
    hasAnyItems: totalCount > 0,
  };
}

describe('HandoffWeekView', () => {
  const defaultProps = {
    loading: false,
    error: null,
    onDayClick: vi.fn(),
  };

  it('ローディング時にスピナーを表示する', () => {
    const summary = makeWeekSummary([]);
    render(<HandoffWeekView {...defaultProps} summary={summary} loading={true} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('エラー時にアラートを表示する', () => {
    const summary = makeWeekSummary([]);
    render(<HandoffWeekView {...defaultProps} summary={summary} error="テストエラー" />);
    expect(screen.getByText('テストエラー')).toBeInTheDocument();
  });

  it('過去日で未対応ありの日に「⚠ 未対応」バッジを表示する', () => {
    // 過去日: isToday=false, isFuture=false, unhandledCount > 0
    const day = makeDaySummary({
      date: '2026-03-09',
      count: 3,
      unhandledCount: 2,
      isToday: false,
      isFuture: false,
    });
    const summary = makeWeekSummary([day]);
    render(<HandoffWeekView {...defaultProps} summary={summary} />);
    expect(screen.getByText('⚠ 未対応2')).toBeInTheDocument();
  });

  it('今日の未対応は通常バッジ (⚠なし) で表示する', () => {
    const day = makeDaySummary({
      date: '2026-03-10',
      count: 3,
      unhandledCount: 2,
      isToday: true,
      isFuture: false,
    });
    const summary = makeWeekSummary([day]);
    render(<HandoffWeekView {...defaultProps} summary={summary} />);
    expect(screen.getByText('未対応2')).toBeInTheDocument();
    expect(screen.queryByText('⚠ 未対応2')).not.toBeInTheDocument();
  });

  it('過去日で全件対応済みの日に ✅ 対応済みを表示する', () => {
    const day = makeDaySummary({
      date: '2026-03-09',
      count: 5,
      unhandledCount: 0,
      isToday: false,
      isFuture: false,
    });
    const summary = makeWeekSummary([day]);
    render(<HandoffWeekView {...defaultProps} summary={summary} />);
    expect(screen.getByText('✅ 対応済み')).toBeInTheDocument();
  });

  it('過去日で件数0の日には ✅ 対応済みを表示しない', () => {
    const day = makeDaySummary({
      date: '2026-03-09',
      count: 0,
      unhandledCount: 0,
      isToday: false,
      isFuture: false,
    });
    const summary = makeWeekSummary([day]);
    render(<HandoffWeekView {...defaultProps} summary={summary} />);
    expect(screen.queryByText('✅ 対応済み')).not.toBeInTheDocument();
  });

  it('週サマリーバーに過去の残件警告を表示する', () => {
    const days = [
      makeDaySummary({ date: '2026-03-09', count: 3, unhandledCount: 2, isToday: false, isFuture: false }),
      makeDaySummary({ date: '2026-03-10', count: 1, unhandledCount: 1, isToday: false, isFuture: false }),
      makeDaySummary({ date: '2026-03-11', count: 2, unhandledCount: 0, isToday: true, isFuture: false }),
    ];
    const summary = makeWeekSummary(days);
    render(<HandoffWeekView {...defaultProps} summary={summary} />);
    // 過去日2日に残件あり
    expect(screen.getByText('⚠ 2日に残件あり')).toBeInTheDocument();
  });

  it('今日の未対応だけでは残件警告を出さない', () => {
    const day = makeDaySummary({
      date: '2026-03-11',
      count: 3,
      unhandledCount: 2,
      isToday: true,
      isFuture: false,
    });
    const summary = makeWeekSummary([day]);
    render(<HandoffWeekView {...defaultProps} summary={summary} />);
    expect(screen.queryByText(/日に残件あり/)).not.toBeInTheDocument();
  });

  it('日カードクリックでコールバックが呼ばれる', () => {
    const onDayClick = vi.fn();
    const day = makeDaySummary({ date: '2026-03-09', count: 1 });
    const summary = makeWeekSummary([day]);
    render(<HandoffWeekView {...defaultProps} summary={summary} onDayClick={onDayClick} />);
    fireEvent.click(screen.getByTestId('handoff-week-day-btn-2026-03-09'));
    expect(onDayClick).toHaveBeenCalledWith('2026-03-09');
  });

  it('未来日のカードはクリックできない', () => {
    const day = makeDaySummary({ date: '2099-01-06', isFuture: true });
    const summary = makeWeekSummary([day]);
    render(<HandoffWeekView {...defaultProps} summary={summary} />);
    const btn = screen.getByTestId('handoff-week-day-btn-2099-01-06');
    expect(btn.closest('button')).toBeDisabled();
  });
});
