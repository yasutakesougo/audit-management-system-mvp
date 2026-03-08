import type { BriefingAlert } from '@/features/dashboard/sections/types';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BriefingActionList } from './BriefingActionList';

// Mock useAuth (needed by useAlertActionState)
vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ account: { username: 'test@example.com' } }),
}));

// ── Test Helpers ──

const makeTodayAlert = (overrides: Partial<BriefingAlert> = {}): BriefingAlert => ({
  id: 'test-absent',
  type: 'absent',
  severity: 'error',
  label: '本日欠席',
  count: 2,
  targetAnchorId: 'sec-attendance',
  section: 'today',
  tags: ['重要'],
  items: [
    { userId: 'U001', userName: '田中 太郎' },
    { userId: 'U002', userName: '山田 花子' },
  ],
  ...overrides,
});

const makeOngoingAlert = (overrides: Partial<BriefingAlert> = {}): BriefingAlert => ({
  id: 'test-evening',
  type: 'evening_followup',
  severity: 'warning',
  label: '夕方フォロー未完了',
  count: 1,
  targetAnchorId: 'sec-attendance',
  section: 'ongoing',
  tags: ['継続'],
  items: [
    { userId: 'U003', userName: '鈴木 次郎' },
  ],
  ...overrides,
});

// ── Tests ──

describe('BriefingActionList', () => {
  it('shows empty state when alerts is empty', () => {
    render(<BriefingActionList alerts={[]} />);

    expect(screen.getByTestId('today-empty-briefing')).toBeInTheDocument();
    expect(screen.getByText('ブリーフィング項目はありません')).toBeInTheDocument();
    // wrapper testid should still be present for E2E stability
    expect(screen.getByTestId('today-accordion-briefing')).toBeInTheDocument();
  });

  it('renders accordion when alerts exist', () => {
    const alerts = [makeTodayAlert()];

    render(<BriefingActionList alerts={alerts} />);

    // Should NOT show empty state
    expect(screen.queryByTestId('today-empty-briefing')).not.toBeInTheDocument();
    // Should show the accordion
    expect(screen.getByTestId('today-accordion-briefing')).toBeInTheDocument();
    expect(screen.getByText('本日欠席 (2件)')).toBeInTheDocument();
  });
});

describe('BriefingActionList — 2-section 表示', () => {
  it('today アラートが「今日の共有事項」セクションに表示される', () => {
    render(<BriefingActionList alerts={[makeTodayAlert()]} />);

    expect(screen.getByText(/今日の共有事項/)).toBeInTheDocument();
    expect(screen.getByText('本日欠席 (2件)')).toBeInTheDocument();
  });

  it('ongoing アラートが「最近の引き継ぎ要点」セクションに表示される', () => {
    render(<BriefingActionList alerts={[makeOngoingAlert()]} />);

    expect(screen.getByText(/最近の引き継ぎ要点/)).toBeInTheDocument();
    expect(screen.getByText('夕方フォロー未完了 (1件)')).toBeInTheDocument();
  });

  it('today と ongoing の両方がある場合、両セクションが表示される', () => {
    render(
      <BriefingActionList alerts={[makeTodayAlert(), makeOngoingAlert()]} />,
    );

    expect(screen.getByText(/今日の共有事項/)).toBeInTheDocument();
    expect(screen.getByText(/最近の引き継ぎ要点/)).toBeInTheDocument();
    expect(screen.getByText('本日欠席 (2件)')).toBeInTheDocument();
    expect(screen.getByText('夕方フォロー未完了 (1件)')).toBeInTheDocument();
  });

  it('全件 today の場合、ongoing セクションに空メッセージが出る', () => {
    render(<BriefingActionList alerts={[makeTodayAlert()]} />);

    expect(screen.getByText('最近の引き継ぎ要点はありません')).toBeInTheDocument();
  });

  it('全件 ongoing の場合、today セクションに空メッセージが出る', () => {
    render(<BriefingActionList alerts={[makeOngoingAlert()]} />);

    expect(screen.getByText('今日の共有事項はありません')).toBeInTheDocument();
  });
});

describe('BriefingActionList — タグ chip', () => {
  it('重要タグが表示される', () => {
    render(<BriefingActionList alerts={[makeTodayAlert({ tags: ['重要'] })]} />);

    const actions = screen.getByTestId('today-briefing-actions');
    expect(within(actions).getByText('重要')).toBeInTheDocument();
  });

  it('継続タグが表示される', () => {
    render(<BriefingActionList alerts={[makeOngoingAlert({ tags: ['継続'] })]} />);

    const actions = screen.getByTestId('today-briefing-actions');
    expect(within(actions).getByText('継続')).toBeInTheDocument();
  });

  it('新規タグが表示される', () => {
    render(
      <BriefingActionList
        alerts={[makeTodayAlert({ id: 'late', type: 'late', label: '遅刻・早退', tags: ['新規'] })]}
      />,
    );

    const actions = screen.getByTestId('today-briefing-actions');
    expect(within(actions).getByText('新規')).toBeInTheDocument();
  });

  it('タグなしのアラートでも表示が壊れない', () => {
    render(<BriefingActionList alerts={[makeTodayAlert({ tags: undefined })]} />);

    expect(screen.getByText('本日欠席 (2件)')).toBeInTheDocument();
  });
});
