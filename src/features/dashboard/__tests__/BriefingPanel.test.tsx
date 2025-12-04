import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BriefingPanel, { BriefingPanelProps } from '../BriefingPanel';

describe('BriefingPanel', () => {
  const mockProps: BriefingPanelProps = {
    mode: 'morning',
    now: new Date('2024-01-15T09:00:00'),
    safety: {
      icon: '🛡️',
      status: '安全',
      conflictCount: 2,
      avg7days: 1.5,
      trendEmoji: '📈',
      trendLabel: '上昇傾向',
      peakTimeSlot: '10:00-12:00',
      peakFrequency: 3,
      managementComment: 'おおむね良好',
      isStable: true,
    },
    dailyStatuses: [
      { label: '通所記録', completed: 8, planned: 10 },
      { label: '日誌記録', completed: 12, planned: 15 },
    ],
    priorityUsers: [
      {
        id: 1,
        name: 'テスト太郎',
        reason: 'フォロー必要',
        memo: 'テストメモ',
        priority: 'high',
      },
    ],
    handoffSummary: {
      total: 5,
      alertCount: 1,
      actionCount: 2,
    },
  };

  it('朝会モードで適切に表示される', () => {
    render(<BriefingPanel {...mockProps} />);

    expect(screen.getByText('朝会')).toBeInTheDocument();
    expect(screen.getByText('今日1日の安全運行と支援の質をそろえましょう。')).toBeInTheDocument();
  });

  it('夕会モードで適切に表示される', () => {
    render(
      <BriefingPanel
        {...mockProps}
        mode="evening"
      />
    );

    expect(screen.getByText('夕会')).toBeInTheDocument();
    expect(screen.getByText('1日の振り返りと、明日への申し送り整理に集中しましょう。')).toBeInTheDocument();
  });

  it('Safety HUDサマリーが表示される', () => {
    const { container } = render(<BriefingPanel {...mockProps} />);

    expect(container.querySelector('[data-testid="dashboard-briefing-panel"]')).toBeInTheDocument();
    const safetySummary = screen.getAllByTestId('briefing-safety-summary')[0];
    expect(within(safetySummary).getAllByText('🛡️ Safety HUD サマリー')[0]).toBeInTheDocument();
    expect(safetySummary).toHaveTextContent(/予定の重なり:\s*2\s*件/);
    expect(safetySummary).toHaveTextContent(/トレンド:\s*📈\s*上昇傾向/);
  });

  it('記録進捗サマリーが表示される', () => {
    const { container } = render(<BriefingPanel {...mockProps} />);

    expect(container.querySelector('[data-testid="dashboard-briefing-panel"]')).toBeInTheDocument();
    const statusList = screen.getAllByTestId('briefing-daily-status-list')[0];
    expect(within(statusList).getAllByText('📝 記録進捗サマリー')[0]).toBeInTheDocument();
    expect(within(statusList).getAllByText('通所記録').length).toBeGreaterThan(0);
    expect(within(statusList).getAllByText('日誌記録').length).toBeGreaterThan(0);
    expect(within(statusList).getByText('完了 8/10（80%）')).toBeInTheDocument();
  });

  it('重点フォロー対象者が表示される', () => {
    const { container } = render(<BriefingPanel {...mockProps} />);

    expect(container.querySelector('[data-testid="dashboard-briefing-panel"]')).toBeInTheDocument();
    const priorityPanel = screen.getAllByTestId('briefing-priority-users')[0];
    expect(within(priorityPanel).getAllByText('🎯 今日の重点フォロー')[0]).toBeInTheDocument();
    expect(within(priorityPanel).getAllByText('1. テスト太郎').length).toBeGreaterThan(0);
    expect(within(priorityPanel).getByText('フォロー必要')).toBeInTheDocument();
    expect(within(priorityPanel).getByText('📝 テストメモ')).toBeInTheDocument();
  });

  it('申し送りサマリーが表示される', () => {
    const { container } = render(<BriefingPanel {...mockProps} />);

    expect(container.querySelector('[data-testid="dashboard-briefing-panel"]')).toBeInTheDocument();
    const handoffPanel = screen.getAllByTestId('briefing-handoff-summary')[0];
    expect(within(handoffPanel).getAllByText('📋 申し送りサマリー')[0]).toBeInTheDocument();
    expect(handoffPanel).toHaveTextContent(/総件数:\s*5\s*件/);
    expect(within(handoffPanel).getByText('注意: 1件')).toBeInTheDocument();
    expect(within(handoffPanel).getByText('対応中: 2件')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-handoff-summary-total')).toHaveTextContent('総件数: 5 件');
    expect(screen.getByTestId('dashboard-handoff-summary-alert')).toHaveTextContent('注意: 1件');
    expect(screen.getByTestId('dashboard-handoff-summary-action')).toHaveTextContent('対応中: 2件');
  });

  it('重点フォロー対象者がいない場合の表示', () => {
    render(
      <BriefingPanel
        {...mockProps}
        priorityUsers={[]}
      />
    );

    expect(screen.getByText('特に重点フォローに指定された利用者はいません。')).toBeInTheDocument();
  });

  it('申し送りサマリーがない場合の表示', () => {
    render(
      <BriefingPanel
        {...mockProps}
        handoffSummary={undefined}
      />
    );

    expect(screen.getByText('申し送りサマリー情報がありません。')).toBeInTheDocument();
  });

  it('testid が設定されている', () => {
    const { container } = render(<BriefingPanel {...mockProps} />);
    const briefingPanels = container.querySelectorAll('[data-testid="dashboard-briefing-panel"]');
    expect(briefingPanels.length).toBeGreaterThan(0);
  });
});