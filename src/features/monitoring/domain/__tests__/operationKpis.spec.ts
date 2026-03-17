/**
 * @fileoverview 運用 KPI エンジンの単体テスト
 * @description MVP-015: computeOperationKpis と個別関数のテスト
 */
import { describe, it, expect } from 'vitest';
import {
  computeRecordCompletionKpi,
  computeHandoffPendingKpi,
  computePlanUnarrangedKpi,
  computeExceptionScoreKpi,
  computeOperationKpis,
  extractKpiAlerts,
} from '../operationKpis';

// ─── computeRecordCompletionKpi ──────────────────────────────────

describe('computeRecordCompletionKpi', () => {
  it('全員入力済みなら 100% / good', () => {
    const r = computeRecordCompletionKpi({ totalUsers: 10, completedToday: 10 });
    expect(r.value).toBe(100);
    expect(r.status).toBe('good');
  });

  it('90% 以上は good', () => {
    const r = computeRecordCompletionKpi({ totalUsers: 10, completedToday: 9 });
    expect(r.status).toBe('good');
  });

  it('70-89% は warning', () => {
    const r = computeRecordCompletionKpi({ totalUsers: 10, completedToday: 7 });
    expect(r.status).toBe('warning');
  });

  it('70% 未満は critical', () => {
    const r = computeRecordCompletionKpi({ totalUsers: 10, completedToday: 5 });
    expect(r.status).toBe('critical');
  });

  it('対象者 0 人は 100% good (問題なし)', () => {
    const r = computeRecordCompletionKpi({ totalUsers: 0, completedToday: 0 });
    expect(r.value).toBe(100);
    expect(r.status).toBe('good');
  });

  it('displayValue に % が含まれる', () => {
    const r = computeRecordCompletionKpi({ totalUsers: 4, completedToday: 3 });
    expect(r.displayValue).toContain('%');
  });
});

// ─── computeHandoffPendingKpi ────────────────────────────────────

describe('computeHandoffPendingKpi', () => {
  it('滞留 0 件なら good', () => {
    const r = computeHandoffPendingKpi({ totalHandoffs: 10, pendingCriticalCount: 0 });
    expect(r.status).toBe('good');
  });

  it('滞留が 1 件以上あれば warning 以上', () => {
    const r = computeHandoffPendingKpi({ totalHandoffs: 10, pendingCriticalCount: 2 });
    expect(r.status).not.toBe('good'); // 2/10 = 20% > 0
  });

  it('滞留率 30% は warning', () => {
    const r = computeHandoffPendingKpi({ totalHandoffs: 10, pendingCriticalCount: 3 });
    expect(r.status).toBe('warning'); // 3/10 = 30%, ≤20 なら warning
  });

  it('申し送り 0 件は good (対象なし)', () => {
    const r = computeHandoffPendingKpi({ totalHandoffs: 0, pendingCriticalCount: 0 });
    expect(r.status).toBe('good');
  });
});

// ─── computePlanUnarrangedKpi ────────────────────────────────────

describe('computePlanUnarrangedKpi', () => {
  it('未整備 0 人は good', () => {
    const r = computePlanUnarrangedKpi({ totalUsers: 10, unarrangedCount: 0 });
    expect(r.status).toBe('good');
  });

  it('1 人でも未整備なら warning 以上', () => {
    const r = computePlanUnarrangedKpi({ totalUsers: 10, unarrangedCount: 1 });
    expect(r.status).not.toBe('good'); // 1/10 = 10% > 0 → warning
  });

  it('未整備率 20% は critical', () => {
    const r = computePlanUnarrangedKpi({ totalUsers: 10, unarrangedCount: 2 });
    expect(r.status).toBe('critical'); // 2/10 = 20%, > 15% → critical
  });

  it('全員未整備は critical', () => {
    const r = computePlanUnarrangedKpi({ totalUsers: 5, unarrangedCount: 5 });
    expect(r.status).toBe('critical');
  });
});

// ─── computeExceptionScoreKpi ────────────────────────────────────

describe('computeExceptionScoreKpi', () => {
  it('例外 0 件はスコア 0 / good', () => {
    const r = computeExceptionScoreKpi({ criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 });
    expect(r.value).toBe(0);
    expect(r.status).toBe('good');
  });

  it('critical は 5pt 加重', () => {
    const r = computeExceptionScoreKpi({ criticalCount: 2, highCount: 0, mediumCount: 0, lowCount: 0 });
    expect(r.value).toBe(10); // 2 * 5
    expect(r.status).toBe('good'); // ≤10
  });

  it('スコア 11〜30 は warning', () => {
    const r = computeExceptionScoreKpi({ criticalCount: 3, highCount: 2, mediumCount: 0, lowCount: 0 });
    // 3*5 + 2*3 = 21
    expect(r.value).toBe(21);
    expect(r.status).toBe('warning');
  });

  it('スコア 31 以上は critical', () => {
    const r = computeExceptionScoreKpi({ criticalCount: 7, highCount: 0, mediumCount: 0, lowCount: 0 });
    expect(r.status).toBe('critical');
  });

  it('スコアは最大 100 にキャップされる', () => {
    const r = computeExceptionScoreKpi({ criticalCount: 30, highCount: 30, mediumCount: 30, lowCount: 30 });
    expect(r.value).toBeLessThanOrEqual(100);
  });
});

// ─── computeOperationKpis ────────────────────────────────────────

describe('computeOperationKpis', () => {
  it('全 5 KPI が返る', () => {
    const kpis = computeOperationKpis({
      record: { totalUsers: 10, completedToday: 10 },
      handoff: { totalHandoffs: 5, pendingCriticalCount: 0 },
      plan: { totalUsers: 10, unarrangedCount: 0 },
      exception: { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
    });
    expect(kpis.recordCompletionRate).toBeDefined();
    expect(kpis.handoffPendingRate).toBeDefined();
    expect(kpis.planUnarrangedRate).toBeDefined();
    expect(kpis.exceptionScore).toBeDefined();
    expect(kpis.overallHealthScore).toBeDefined();
  });

  it('全指標が良好なら overallHealthScore は good', () => {
    const kpis = computeOperationKpis({
      record: { totalUsers: 10, completedToday: 10 },
      handoff: { totalHandoffs: 10, pendingCriticalCount: 0 },
      plan: { totalUsers: 10, unarrangedCount: 0 },
      exception: { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
    });
    expect(kpis.overallHealthScore.status).toBe('good');
    expect(kpis.overallHealthScore.value).toBeGreaterThanOrEqual(80);
  });

  it('record 0% + critical 10件 なら overallHealth は critical', () => {
    const kpis = computeOperationKpis({
      record: { totalUsers: 10, completedToday: 0 },
      handoff: { totalHandoffs: 10, pendingCriticalCount: 10 },
      plan: { totalUsers: 10, unarrangedCount: 10 },
      exception: { criticalCount: 10, highCount: 0, mediumCount: 0, lowCount: 0 },
    });
    expect(kpis.overallHealthScore.status).toBe('critical');
  });
});

// ─── extractKpiAlerts ────────────────────────────────────────────

describe('extractKpiAlerts', () => {
  it('全 good なら空配列', () => {
    const kpis = computeOperationKpis({
      record: { totalUsers: 10, completedToday: 10 },
      handoff: { totalHandoffs: 5, pendingCriticalCount: 0 },
      plan: { totalUsers: 10, unarrangedCount: 0 },
      exception: { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
    });
    expect(extractKpiAlerts(kpis)).toHaveLength(0);
  });

  it('warning・critical な KPI を抽出する', () => {
    const kpis = computeOperationKpis({
      record: { totalUsers: 10, completedToday: 5 }, // critical
      handoff: { totalHandoffs: 10, pendingCriticalCount: 0 },
      plan: { totalUsers: 10, unarrangedCount: 0 },
      exception: { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
    });
    const alerts = extractKpiAlerts(kpis);
    expect(alerts.some((a) => a.key === 'record-completion')).toBe(true);
  });
});
