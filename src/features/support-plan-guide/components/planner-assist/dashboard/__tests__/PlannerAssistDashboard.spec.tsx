import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PlannerAssistDashboard } from '../PlannerAssistDashboard';
import type { PlannerAssistMetricsSummary } from '../../../../domain/plannerAssistMetrics';

// ────────────────────────────────────────────
// モックデータ
// ────────────────────────────────────────────

const emptyMetrics: PlannerAssistMetricsSummary = {
  firstNavigation: {
    monitoring: 0,
    planning: 0,
    assessment: 0,
    other: 0,
  },
  actionClickRate: {
    totalSessions: 0,
    clicksPerSession: 0,
    totalClicks: 0,
    byCategory: {},
  },
  navigationLatency: {
    latencies: [],
    medianMs: 0,
    meanMs: 0,
    p90Ms: 0,
  },
  adoptionUplift: {
    beforeRate: 0,
    afterRate: 0,
    sampleCount: 0,
    uplift: 0,
    insufficient: true,
  },
};

const fullMetrics: PlannerAssistMetricsSummary = {
  firstNavigation: {
    monitoring: 42,
    planning: 31,
    assessment: 19,
    other: 8,
  },
  actionClickRate: {
    totalSessions: 10,
    clicksPerSession: 1.5,
    totalClicks: 15,
    byCategory: {
      smart: 10,
      monitoring: 5,
    },
  },
  navigationLatency: {
    latencies: Array(20).fill(1000), // length 20
    medianMs: 1230,
    meanMs: 1540,
    p90Ms: 3250,
  },
  adoptionUplift: {
    beforeRate: 0.5,
    afterRate: 0.75,
    sampleCount: 10,
    uplift: 0.25,
    insufficient: false, // データ十分
  },
};


// ────────────────────────────────────────────
// テスト
// ────────────────────────────────────────────

describe('PlannerAssistDashboard', () => {
  it('metrics が null の場合は空状態メッセージを表示する', () => {
    render(<PlannerAssistDashboard metrics={null} />);
    expect(screen.getByText('集計データがありません')).toBeInTheDocument();
  });

  it('データソース0件の場合は各カードがデータなし状態を表示する', () => {
    render(<PlannerAssistDashboard metrics={emptyMetrics} />);

    // 4つのカードすべてに「データなし」が出るはず (FirstNav, ActionClick, Latency)
    // Uplift は「データ不足 (Insufficient)」になる
    const noDatas = screen.getAllByText('データなし');
    expect(noDatas.length).toBe(3);

    expect(screen.getByTestId('uplift-insufficient-badge')).toBeInTheDocument();
  });

  it('フルデータの場合は各カードのフォーマットが正しく描画される', () => {
    render(<PlannerAssistDashboard metrics={fullMetrics} />);

    // --- FirstNavigation ---
    expect(screen.getByTestId('first-nav-rate-monitoring').textContent).toBe('42.0%'); // 42/100
    expect(screen.getByTestId('first-nav-rate-planning').textContent).toBe('31.0%');
    expect(screen.getByTestId('first-nav-rate-assessment').textContent).toBe('19.0%');
    expect(screen.getByTestId('first-nav-rate-other').textContent).toBe('8.0%');

    // --- ActionClickRate ---
    expect(screen.getByText('平均クリック数: 1.5 / セッション')).toBeInTheDocument();
    expect(screen.getByTestId('click-rate-smart').textContent).toBe('10回 (66.7%)');
    expect(screen.getByTestId('click-rate-monitoring').textContent).toBe('5回 (33.3%)');

    // --- NavigationLatency ---
    expect(screen.getByTestId('latency-median').textContent).toBe('1.23s');
    expect(screen.getByTestId('latency-mean').textContent).toBe('1.54s');
    expect(screen.getByTestId('latency-p90').textContent).toBe('3.25s');

    // --- AdoptionUplift ---
    expect(screen.queryByTestId('uplift-insufficient-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('uplift-value').textContent).toBe('+25.0pt');
    expect(screen.getByTestId('uplift-before').textContent).toBe('50.0%');
    expect(screen.getByTestId('uplift-after').textContent).toBe('75.0%');
  });

  it('AdoptionUplift が insufficient の場合は数値がハイフンとなり警告バッジが出る', () => {
    const insufficientMetrics: PlannerAssistMetricsSummary = {
      ...fullMetrics,
      adoptionUplift: {
        beforeRate: 0.5,
        afterRate: 1.0,   // これだけ見ると良い結果だが
        sampleCount: 2,   // MIN_UPLIFT_SAMPLES 未満
        uplift: 0.5,
        insufficient: true, // サンプル不足
      },
    };

    render(<PlannerAssistDashboard metrics={insufficientMetrics} />);

    expect(screen.getByTestId('uplift-insufficient-badge')).toBeInTheDocument();
    expect(screen.getByTestId('uplift-value').textContent).toBe('-');
    expect(screen.getByTestId('uplift-before').textContent).toBe('50.0%');
    expect(screen.getByTestId('uplift-after').textContent).toBe('-');
  });
});
