import type { BriefingAlert } from '@/features/dashboard/sections/types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BriefingActionList } from './BriefingActionList';

/** Render helper with router context */
const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

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
    { userId: 'U001', userName: '田中 太郎', morningContacted: false, eveningChecked: false },
    { userId: 'U002', userName: '山田 花子', morningContacted: true, eveningChecked: false },
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
    renderWithRouter(<BriefingActionList alerts={[]} />);

    expect(screen.getByTestId('today-empty-briefing')).toBeInTheDocument();
    expect(screen.getByText('ブリーフィング項目はありません')).toBeInTheDocument();
    // wrapper testid should still be present for E2E stability
    expect(screen.getByTestId('today-accordion-briefing')).toBeInTheDocument();
  });

  it('renders accordion when alerts exist', () => {
    const alerts = [makeTodayAlert()];

    renderWithRouter(<BriefingActionList alerts={alerts} />);

    // Should NOT show empty state
    expect(screen.queryByTestId('today-empty-briefing')).not.toBeInTheDocument();
    // Should show the accordion
    expect(screen.getByTestId('today-accordion-briefing')).toBeInTheDocument();
    expect(screen.getByText('本日欠席 (2件)')).toBeInTheDocument();
  });
});

describe('BriefingActionList — 2-section 表示', () => {
  it('today アラートが「今日の共有事項」セクションに表示される', () => {
    renderWithRouter(<BriefingActionList alerts={[makeTodayAlert()]} />);

    expect(screen.getByText(/今日の共有事項/)).toBeInTheDocument();
    expect(screen.getByText('本日欠席 (2件)')).toBeInTheDocument();
  });

  it('ongoing アラートが「最近の引き継ぎ要点」セクションに表示される', () => {
    renderWithRouter(<BriefingActionList alerts={[makeOngoingAlert()]} />);

    expect(screen.getByText(/最近の引き継ぎ要点/)).toBeInTheDocument();
    expect(screen.getByText('夕方フォロー未完了 (1件)')).toBeInTheDocument();
  });

  it('today と ongoing の両方がある場合、両セクションが表示される', () => {
    renderWithRouter(
      <BriefingActionList alerts={[makeTodayAlert(), makeOngoingAlert()]} />,
    );

    expect(screen.getByText(/今日の共有事項/)).toBeInTheDocument();
    expect(screen.getByText(/最近の引き継ぎ要点/)).toBeInTheDocument();
    expect(screen.getByText('本日欠席 (2件)')).toBeInTheDocument();
    expect(screen.getByText('夕方フォロー未完了 (1件)')).toBeInTheDocument();
  });

  it('全件 today の場合、ongoing セクションに空メッセージが出る', () => {
    renderWithRouter(<BriefingActionList alerts={[makeTodayAlert()]} />);

    expect(screen.getByText('最近の引き継ぎ要点はありません')).toBeInTheDocument();
  });

  it('全件 ongoing の場合、today セクションに空メッセージが出る', () => {
    renderWithRouter(<BriefingActionList alerts={[makeOngoingAlert()]} />);

    expect(screen.getByText('今日の共有事項はありません')).toBeInTheDocument();
  });
});

describe('BriefingActionList — タグ chip', () => {
  it('重要タグが表示される', () => {
    renderWithRouter(<BriefingActionList alerts={[makeTodayAlert({ tags: ['重要'] })]} />);

    const actions = screen.getByTestId('today-briefing-actions');
    expect(within(actions).getByText('重要')).toBeInTheDocument();
  });

  it('継続タグが表示される', () => {
    renderWithRouter(<BriefingActionList alerts={[makeOngoingAlert({ tags: ['継続'] })]} />);

    const actions = screen.getByTestId('today-briefing-actions');
    expect(within(actions).getByText('継続')).toBeInTheDocument();
  });

  it('新規タグが表示される', () => {
    renderWithRouter(
      <BriefingActionList
        alerts={[makeTodayAlert({ id: 'late', type: 'late', label: '遅刻・早退', tags: ['新規'] })]}
      />,
    );

    const actions = screen.getByTestId('today-briefing-actions');
    expect(within(actions).getByText('新規')).toBeInTheDocument();
  });

  it('タグなしのアラートでも表示が壊れない', () => {
    renderWithRouter(<BriefingActionList alerts={[makeTodayAlert({ tags: undefined })]} />);

    expect(screen.getByText('本日欠席 (2件)')).toBeInTheDocument();
  });
});

describe('BriefingActionList — アクションボタン動作', () => {
  it('📞 連絡確認を押すと出欠ページに遷移する（欠席登録フロー）', async () => {
    renderWithRouter(<BriefingActionList alerts={[makeTodayAlert()]} />);

    const row = screen.getByTestId('alert-action-row-U001');
    const confirmBtn = within(row).getByText('📞 連絡確認');
    fireEvent.click(confirmBtn);

    // Should not show snackbar — navigates away instead
    expect(screen.queryByText(/連絡確認済み/)).not.toBeInTheDocument();
  });

  it('📝 申し送り作成を押すと handoff-open-quicknote-dialog イベントが発火する', () => {
    const spy = vi.fn();
    window.addEventListener('handoff-open-quicknote-dialog', spy);

    renderWithRouter(<BriefingActionList alerts={[makeTodayAlert()]} />);

    const row = screen.getByTestId('alert-action-row-U001');
    const handoffBtn = within(row).getByText('📝 申し送り作成');
    fireEvent.click(handoffBtn);

    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('handoff-open-quicknote-dialog', spy);
  });

  it('📝 申し送り作成ボタンは常に有効（遷移後もクリック可）', () => {
    renderWithRouter(<BriefingActionList alerts={[makeTodayAlert()]} />);

    const row = screen.getByTestId('alert-action-row-U001');
    const handoffBtn = within(row).getByText('📝 申し送り作成');
    expect(handoffBtn).not.toBeDisabled();
  });
});

describe('BriefingActionList — 欠席2ステップワークフロー', () => {
  it('欠席行には「朝連絡」「夕方確認」のステップ表示がある', () => {
    renderWithRouter(<BriefingActionList alerts={[makeTodayAlert()]} />);

    // U001: morningContacted=false, eveningChecked=false
    const steps1 = screen.getByTestId('absence-steps-U001');
    expect(within(steps1).getByText('朝連絡 未')).toBeInTheDocument();
    expect(within(steps1).getByText('夕方確認 未')).toBeInTheDocument();

    // U002: morningContacted=true, eveningChecked=false
    const steps2 = screen.getByTestId('absence-steps-U002');
    expect(within(steps2).getByText('朝連絡 済')).toBeInTheDocument();
    expect(within(steps2).getByText('夕方確認 未')).toBeInTheDocument();
  });

  it('朝連絡済みユーザーは📞ボタンが無効になる', () => {
    renderWithRouter(<BriefingActionList alerts={[makeTodayAlert()]} />);

    // U002 has morningContacted=true → contact-confirm should be disabled
    const row = screen.getByTestId('alert-action-row-U002');
    const confirmBtn = within(row).getByText('📞 連絡確認');
    expect(confirmBtn).toBeDisabled();

    // U001 has morningContacted=false → button should be enabled
    const row1 = screen.getByTestId('alert-action-row-U001');
    const confirmBtn1 = within(row1).getByText('📞 連絡確認');
    expect(confirmBtn1).not.toBeDisabled();
  });

  it('月4回加算の注意メッセージが表示される', () => {
    renderWithRouter(<BriefingActionList alerts={[makeTodayAlert()]} />);

    expect(screen.getByTestId('absence-workflow-subtitle')).toHaveTextContent(
      '月4回まで加算対象',
    );
  });

  it('🌆 夕方確認を押すと出欠ページに遷移する（evening section）', () => {
    renderWithRouter(<BriefingActionList alerts={[makeTodayAlert()]} />);

    const row = screen.getByTestId('alert-action-row-U001');
    const eveningBtn = within(row).getByText('🌆 夕方確認');
    fireEvent.click(eveningBtn);

    // Navigation happens — no snackbar
    expect(screen.queryByText(/夕方確認済み/)).not.toBeInTheDocument();
  });

  it('両方完了済みユーザーは行がストライクスルーになる', () => {
    const alert = makeTodayAlert({
      items: [
        { userId: 'U099', userName: '完了 太郎', morningContacted: true, eveningChecked: true },
      ],
    });
    renderWithRouter(<BriefingActionList alerts={[alert]} />);

    const row = screen.getByTestId('alert-action-row-U099');
    const nameEl = within(row).getByText('完了 太郎');
    expect(nameEl).toHaveStyle({ textDecoration: 'line-through' });
  });
});
