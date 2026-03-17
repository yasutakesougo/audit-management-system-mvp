/**
 * NextActionPanel コンポーネントテスト (P5-A)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { NextActionPanel } from '../NextActionPanel';
import type { NextActionPanelProps } from '../NextActionPanel';
import type { PlannerInsightItem, PlannerInsights } from '../../../domain/plannerInsights';

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
// テスト
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

  // ── ナビゲーション ──

  it('アクション行クリックで onNavigate(tab) を呼ぶ', () => {
    const { onNavigate } = renderPanel({
      actions: [makeAction({ tab: 'smart' })],
    });

    fireEvent.click(screen.getByTestId('next-action-row-pendingSuggestions'));

    expect(onNavigate).toHaveBeenCalledWith('smart');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('Enter キーで onNavigate(tab) を呼ぶ', () => {
    const { onNavigate } = renderPanel({
      actions: [makeAction({ tab: 'excellence' })],
    });

    fireEvent.keyDown(screen.getByTestId('next-action-row-pendingSuggestions'), { key: 'Enter' });

    expect(onNavigate).toHaveBeenCalledWith('excellence');
  });

  it('Space キーで onNavigate(tab) を呼ぶ', () => {
    const { onNavigate } = renderPanel({
      actions: [makeAction({ tab: 'compliance' })],
    });

    fireEvent.keyDown(screen.getByTestId('next-action-row-pendingSuggestions'), { key: ' ' });

    expect(onNavigate).toHaveBeenCalledWith('compliance');
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
