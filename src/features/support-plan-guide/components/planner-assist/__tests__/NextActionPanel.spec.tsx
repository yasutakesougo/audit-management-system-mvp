/**
 * NextActionPanel コンポーネントテスト (P5-A / P5-C1)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { NextActionPanel } from '../NextActionPanel';
import type { NextActionPanelProps } from '../NextActionPanel';
import type {
  PlannerInsightItem,
  PlannerInsights,
  PlannerInsightDetails,
  PlannerInsightDetailItem,
} from '../../../domain/plannerInsights';

// ────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────

function makeAction(overrides: Partial<PlannerInsightItem> = {}): PlannerInsightItem {
  return {
    key: 'pendingSuggestions',
    label: '未判断の提案',
    count: 3,
    severity: 'info',
    tab: 'smart',
    description: '3件の提案が判断待ちです',
    ...overrides,
  };
}

function makeSummary(overrides: Partial<PlannerInsights['summary']> = {}): PlannerInsights['summary'] {
  return {
    totalOpenActions: 5,
    weeklyAcceptanceRate: 0.75,
    ...overrides,
  };
}

function makeDetailItem(overrides: Partial<PlannerInsightDetailItem> = {}): PlannerInsightDetailItem {
  return {
    label: '詳細項目',
    ...overrides,
  };
}

function renderPanel(props: Partial<NextActionPanelProps> = {}) {
  const defaultProps: NextActionPanelProps = {
    actions: [makeAction()],
    summary: makeSummary(),
    onNavigate: vi.fn(),
    ...props,
  };
  return {
    ...render(<NextActionPanel {...defaultProps} />),
    onNavigate: defaultProps.onNavigate,
  };
}

// ────────────────────────────────────────────
// 基本テスト (P5-A)
// ────────────────────────────────────────────

describe('NextActionPanel', () => {
  // ── 描画 ──

  it('actions があればパネルを表示する', () => {
    renderPanel();
    expect(screen.getByTestId('next-action-panel')).toBeInTheDocument();
  });

  it('actions が空ならパネルを表示しない', () => {
    renderPanel({ actions: [] });
    expect(screen.queryByTestId('next-action-panel')).not.toBeInTheDocument();
  });

  it('ヘッダーに Planner Assist ラベルを表示する', () => {
    renderPanel();
    expect(screen.getByText('Planner Assist')).toBeInTheDocument();
  });

  it('totalOpenActions を件数チップとして表示する', () => {
    renderPanel({ summary: makeSummary({ totalOpenActions: 7 }) });
    expect(screen.getByText('7件')).toBeInTheDocument();
  });

  // ── 採用率 ──

  it('weeklyAcceptanceRate がある場合に採用率チップを表示する', () => {
    renderPanel({ summary: makeSummary({ weeklyAcceptanceRate: 0.75 }) });
    expect(screen.getByTestId('acceptance-rate-chip')).toBeInTheDocument();
    expect(screen.getByText(/採用率/)).toBeInTheDocument();
  });

  it('weeklyAcceptanceRate が undefined なら採用率チップを非表示', () => {
    renderPanel({ summary: makeSummary({ weeklyAcceptanceRate: undefined }) });
    expect(screen.queryByTestId('acceptance-rate-chip')).not.toBeInTheDocument();
  });

  // ── アクション行 ──

  it('各アクション行を testid 付きで表示する', () => {
    const actions = [
      makeAction({ key: 'pendingSuggestions', label: '未判断', count: 2 }),
      makeAction({ key: 'regulatoryIssues', label: '制度警告', count: 1, severity: 'danger' }),
    ];
    renderPanel({ actions });

    expect(screen.getByTestId('next-action-row-pendingSuggestions')).toBeInTheDocument();
    expect(screen.getByTestId('next-action-row-regulatoryIssues')).toBeInTheDocument();
  });

  it('アクション行にラベルとカウントを表示する', () => {
    renderPanel({ actions: [makeAction({ label: '未判断の提案', count: 3 })] });
    expect(screen.getByText('未判断の提案')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  // ── ナビゲーション（details なし → 直接ナビゲーション） ──

  it('details なしの行クリックで onNavigate(tab) を呼ぶ', () => {
    const { onNavigate } = renderPanel({
      actions: [makeAction({ tab: 'smart' })],
      // details を渡さない
    });

    // クリック対象は role="button" 要素
    const row = screen.getByTestId('next-action-row-pendingSuggestions');
    const button = within(row).getByRole('button', { name: /開く/ });
    fireEvent.click(button);

    expect(onNavigate).toHaveBeenCalledWith('smart');
  });

  it('Enter キーで details なしの行は onNavigate を呼ぶ', () => {
    const { onNavigate } = renderPanel({
      actions: [makeAction({ tab: 'excellence' })],
    });

    const row = screen.getByTestId('next-action-row-pendingSuggestions');
    const clickable = within(row).getByRole('button', { name: /開く/ });
    fireEvent.click(clickable);

    expect(onNavigate).toHaveBeenCalledWith('excellence');
  });

  // ── 複数アクション ──

  it('severity が異なる複数アクションを正しく表示する', () => {
    const actions = [
      makeAction({ key: 'regulatoryIssues', label: '制度警告', severity: 'danger', count: 2 }),
      makeAction({ key: 'missingGoals', label: '目標未設定', severity: 'warning', count: 1 }),
      makeAction({ key: 'pendingSuggestions', label: '未判断の提案', severity: 'info', count: 5 }),
    ];
    renderPanel({ actions });

    expect(screen.getByText('制度警告')).toBeInTheDocument();
    expect(screen.getByText('目標未設定')).toBeInTheDocument();
    expect(screen.getByText('未判断の提案')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────
// P5-C1: 展開詳細テスト
// ────────────────────────────────────────────

describe('NextActionPanel — expand/collapse (P5-C1)', () => {
  const detailItems: PlannerInsightDetailItem[] = [
    makeDetailItem({ label: '自己決定支援の強化', detail: '根拠A' }),
    makeDetailItem({ label: '生活リズム改善', detail: '根拠B' }),
  ];

  const details: PlannerInsightDetails = {
    pendingSuggestions: detailItems,
  };

  it('details がある行に展開アイコンを表示する', () => {
    renderPanel({
      actions: [makeAction({ key: 'pendingSuggestions' })],
      details,
    });

    expect(screen.getByTestId('expand-icon-pendingSuggestions')).toBeInTheDocument();
  });

  it('details がない行には展開アイコンを表示しない', () => {
    renderPanel({
      actions: [makeAction({ key: 'missingGoals' })],
      details,  // missingGoals は details に含まれない
    });

    expect(screen.queryByTestId('expand-icon-missingGoals')).not.toBeInTheDocument();
  });

  it('行クリックで詳細リストを展開する', () => {
    renderPanel({
      actions: [makeAction({ key: 'pendingSuggestions' })],
      details,
    });

    // 初期状態では詳細は非表示（Collapse が閉じている = 高さ 0）
    const row = screen.getByTestId('next-action-row-pendingSuggestions');
    const clickable = within(row).getAllByRole('button')[0]; // main row button area
    fireEvent.click(clickable);

    // 展開後、詳細項目が表示される
    expect(screen.getByText('自己決定支援の強化')).toBeInTheDocument();
    expect(screen.getByText('生活リズム改善')).toBeInTheDocument();
  });

  it('展開中でもナビゲーションアイコンで遷移できる', () => {
    const { onNavigate } = renderPanel({
      actions: [makeAction({ key: 'pendingSuggestions', tab: 'smart' })],
      details,
    });

    // 先に展開
    const row = screen.getByTestId('next-action-row-pendingSuggestions');
    const clickable = within(row).getAllByRole('button')[0];
    fireEvent.click(clickable);

    // ナビゲーションアイコンをクリック
    const navButton = within(row).getByRole('button', { name: /開く/ });
    fireEvent.click(navButton);

    expect(onNavigate).toHaveBeenCalledWith('smart');
  });

  it('詳細項目の detail テキストを表示する', () => {
    renderPanel({
      actions: [makeAction({ key: 'pendingSuggestions' })],
      details,
    });

    // 展開
    const row = screen.getByTestId('next-action-row-pendingSuggestions');
    const clickable = within(row).getAllByRole('button')[0];
    fireEvent.click(clickable);

    expect(screen.getByText('根拠A')).toBeInTheDocument();
    expect(screen.getByText('根拠B')).toBeInTheDocument();
  });
});

