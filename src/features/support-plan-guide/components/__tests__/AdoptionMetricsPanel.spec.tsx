/**
 * @fileoverview AdoptionMetricsPanel のテスト
 *
 * Issue #11: Adoption Metrics
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import type { AdoptionMetrics } from '@/features/daily/domain/legacy/adoptionMetrics';
import type { UseAdoptionMetricsReturn } from '../../hooks/useAdoptionMetrics';

// ─── mock ────────────────────────────────────────────────

const mockReturn: UseAdoptionMetricsReturn = {
  metrics: null,
  isLoading: false,
  error: null,
};

vi.mock('../../hooks/useAdoptionMetrics', () => ({
  useAdoptionMetrics: () => mockReturn,
}));

import AdoptionMetricsPanel from '../tabs/AdoptionMetricsPanel';

// ─── ヘルパー ────────────────────────────────────────────

function makeMetrics(overrides: Partial<AdoptionMetrics> = {}): AdoptionMetrics {
  return {
    period: { startDate: '2026-02-12', endDate: '2026-03-14' },
    actionedCount: 10,
    acceptCount: 6,
    dismissCount: 4,
    acceptRate: 60,
    dismissRate: 40,
    ispImportCount: 3,
    ispImportRate: 50,
    byRule: [
      { rulePrefix: 'highCoOccurrence', label: '高併発率', acceptCount: 4, dismissCount: 2, acceptRate: 66.7 },
      { rulePrefix: 'slotBias', label: '時間帯偏り', acceptCount: 2, dismissCount: 2, acceptRate: 50 },
    ],
    ...overrides,
  };
}

function renderPanel(userId = 'user-01') {
  return render(
    <AdoptionMetricsPanel
      userId={userId}
      improvementIdeas="テスト"
    />,
  );
}

// ─── テスト ──────────────────────────────────────────────

describe('AdoptionMetricsPanel', () => {
  beforeEach(() => {
    mockReturn.metrics = null;
    mockReturn.isLoading = false;
    mockReturn.error = null;
  });

  it('Loading 中は取得中テキストを表示する', () => {
    mockReturn.isLoading = true;
    renderPanel();
    expect(screen.getByText('採用状況を取得中…')).toBeDefined();
  });

  it('エラー時にエラーメッセージを表示する', () => {
    mockReturn.error = 'SP接続エラー';
    renderPanel();
    expect(screen.getByText(/SP接続エラー/)).toBeDefined();
  });

  it('metrics が null のときはパネルを表示しない', () => {
    mockReturn.metrics = null;
    const { container } = renderPanel();
    expect(container.querySelector('[data-testid="adoption-metrics-panel"]')).toBeNull();
  });

  it('actionedCount = 0 のときはパネルを表示しない', () => {
    mockReturn.metrics = makeMetrics({ actionedCount: 0, acceptCount: 0, dismissCount: 0 });
    const { container } = renderPanel();
    expect(container.querySelector('[data-testid="adoption-metrics-panel"]')).toBeNull();
  });

  it('accept / dismiss / ISP反映の件数を表示する', () => {
    mockReturn.metrics = makeMetrics();
    renderPanel();

    expect(screen.getByText('採用 6件')).toBeDefined();
    expect(screen.getByText('却下 4件')).toBeDefined();
    expect(screen.getByText('個別支援計画反映 3件')).toBeDefined();
  });

  it('採用率をパーセント表示する', () => {
    mockReturn.metrics = makeMetrics({ acceptRate: 60 });
    renderPanel();
    expect(screen.getByText(/60%/)).toBeDefined();
  });

  it('ISP候補反映率を表示する', () => {
    mockReturn.metrics = makeMetrics({ ispImportRate: 50 });
    renderPanel();
    expect(screen.getByText('50%')).toBeDefined();
  });

  it('acceptCount = 0 のとき ISP反映率バーを表示しない', () => {
    mockReturn.metrics = makeMetrics({
      acceptCount: 0,
      dismissCount: 5,
      actionedCount: 5,
      acceptRate: 0,
      ispImportCount: 0,
      ispImportRate: 0,
    });
    renderPanel();
    expect(screen.queryByText('ISP候補反映率')).toBeNull();
  });

  it('ルール別展開トグルが動作する', () => {
    mockReturn.metrics = makeMetrics();
    renderPanel();

    // ルール数表示が出ている
    expect(screen.getByText(/2ルール/)).toBeDefined();

    // トグルクリック
    const toggle = screen.getByTestId('rule-expand-toggle');
    fireEvent.click(toggle);

    // 展開後にルール別の採用率数値が表示される
    expect(screen.getByText(/66\.7%/)).toBeDefined();
  });

  it('acceptRate >= 70 で 🟢 を表示する', () => {
    mockReturn.metrics = makeMetrics({ acceptRate: 80 });
    renderPanel();
    expect(screen.getByText(/🟢/)).toBeDefined();
  });

  it('acceptRate 30-69 で 🟡 を表示する', () => {
    mockReturn.metrics = makeMetrics({ acceptRate: 50 });
    renderPanel();
    expect(screen.getByText(/🟡/)).toBeDefined();
  });

  it('acceptRate < 30 で 🔴 を表示する', () => {
    mockReturn.metrics = makeMetrics({ acceptRate: 20 });
    renderPanel();
    expect(screen.getByText(/🔴/)).toBeDefined();
  });

  it('低採用率ルールに ⚠️ を表示する', () => {
    mockReturn.metrics = makeMetrics({
      byRule: [
        { rulePrefix: 'tagDensityGap', label: 'タグ密度差', acceptCount: 0, dismissCount: 5, acceptRate: 0 },
      ],
    });
    renderPanel();

    // 展開する
    fireEvent.click(screen.getByTestId('rule-expand-toggle'));

    expect(screen.getByText(/⚠️.*タグ密度差/)).toBeDefined();
  });
});
