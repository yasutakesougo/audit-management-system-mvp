import { describe, expect, it } from 'vitest';
import {
  computeCtaKpiDiff,
  DEFAULT_THRESHOLDS,
  type AlertThresholds,
} from '../computeCtaKpiDiff';
import type { DashboardKpis, FunnelStep } from '../computeCtaKpis';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeKpis(overrides: Partial<DashboardKpis> = {}): DashboardKpis {
  return {
    totalEvents: 0,
    totalCtaClicks: 0,
    totalLandings: 0,
    heroQueueRatio: { heroCount: 0, queueCount: 0, heroRate: 0, queueRate: 0 },
    screenKpis: [],
    flowDistribution: [],
    funnel: [
      { label: 'ランディング', count: 0, rate: 100 },
      { label: 'CTAクリック', count: 0, rate: 0 },
      { label: '完了', count: 0, rate: 0 },
    ],
    hourlyDistribution: [],
    ...overrides,
  };
}

function withFunnel(landing: number, cta: number, done: number): { funnel: FunnelStep[] } {
  return {
    funnel: [
      { label: 'ランディング', count: landing, rate: 100 },
      { label: 'CTAクリック', count: cta, rate: landing > 0 ? Math.round((cta / landing) * 100) : 0 },
      { label: '完了', count: done, rate: cta > 0 ? Math.round((done / cta) * 100) : 0 },
    ],
  };
}

// ── Diff Tests ──────────────────────────────────────────────────────────────

describe('computeCtaKpiDiff', () => {
  describe('diff calculation', () => {
    it('Hero利用率が上がった場合 ↑ を返す', () => {
      const current = makeKpis({
        heroQueueRatio: { heroCount: 8, queueCount: 2, heroRate: 80, queueRate: 20 },
      });
      const previous = makeKpis({
        heroQueueRatio: { heroCount: 7, queueCount: 3, heroRate: 70, queueRate: 30 },
      });
      const result = computeCtaKpiDiff(current, previous);
      expect(result.heroRate.trend).toBe('up');
      expect(result.heroRate.diff).toBe(10);
      expect(result.heroRate.diffFormatted).toBe('↑ +10%');
    });

    it('Queue利用率が下がった場合 ↓ を返す', () => {
      const current = makeKpis({
        heroQueueRatio: { heroCount: 8, queueCount: 2, heroRate: 80, queueRate: 20 },
      });
      const previous = makeKpis({
        heroQueueRatio: { heroCount: 7, queueCount: 3, heroRate: 70, queueRate: 30 },
      });
      const result = computeCtaKpiDiff(current, previous);
      expect(result.queueRate.trend).toBe('down');
      expect(result.queueRate.diff).toBe(-10);
      expect(result.queueRate.diffFormatted).toBe('↓ -10%');
    });

    it('変化なしの場合 flat と ±0% を返す', () => {
      const kpis = makeKpis({
        heroQueueRatio: { heroCount: 5, queueCount: 5, heroRate: 50, queueRate: 50 },
      });
      const result = computeCtaKpiDiff(kpis, kpis);
      expect(result.heroRate.trend).toBe('flat');
      expect(result.heroRate.diffFormatted).toBe('→ ±0%');
    });

    it('CTA総数の差分は数値（非パーセンテージ）で返す', () => {
      const current = makeKpis({ totalCtaClicks: 42 });
      const previous = makeKpis({ totalCtaClicks: 35 });
      const result = computeCtaKpiDiff(current, previous);
      expect(result.totalCtaClicks.diff).toBe(7);
      expect(result.totalCtaClicks.diffFormatted).toBe('↑ +7');
    });

    it('完了率の差分を正しく計算する', () => {
      const current = makeKpis({ ...withFunnel(100, 80, 60) });
      const previous = makeKpis({ ...withFunnel(100, 80, 40) });
      const result = computeCtaKpiDiff(current, previous);
      expect(result.completionRate.current).toBe(75);  // 60/80
      expect(result.completionRate.previous).toBe(50);  // 40/80
      expect(result.completionRate.trend).toBe('up');
    });

    it('previous が null の場合、前期間 0 として計算する', () => {
      const current = makeKpis({
        heroQueueRatio: { heroCount: 10, queueCount: 2, heroRate: 83, queueRate: 17 },
        totalCtaClicks: 12,
      });
      const result = computeCtaKpiDiff(current, null);
      expect(result.heroRate.previous).toBe(0);
      expect(result.heroRate.diff).toBe(83);
      expect(result.totalCtaClicks.diff).toBe(12);
    });
  });

  // ── Alert Tests ───────────────────────────────────────────────────────────

  describe('alerts', () => {
    it('Hero利用率が閾値を下回るとwarningを返す', () => {
      const kpis = makeKpis({
        heroQueueRatio: { heroCount: 6, queueCount: 4, heroRate: 60, queueRate: 40 },
      });
      const result = computeCtaKpiDiff(kpis, null);
      const alert = result.alerts.find(a => a.id === 'hero-rate-low');
      expect(alert).toBeDefined();
      expect(alert!.severity).toBe('warning');
      expect(alert!.value).toBe(60);
    });

    it('Queue利用率が閾値を超えるとwarningを返す', () => {
      const kpis = makeKpis({
        heroQueueRatio: { heroCount: 5, queueCount: 5, heroRate: 50, queueRate: 50 },
      });
      const result = computeCtaKpiDiff(kpis, null);
      const alert = result.alerts.find(a => a.id === 'queue-rate-high');
      expect(alert).toBeDefined();
      expect(alert!.severity).toBe('warning');
    });

    it('完了率が閾値を下回るとcriticalを返す', () => {
      const kpis = makeKpis({
        totalCtaClicks: 10,
        ...withFunnel(20, 10, 3),
      });
      const result = computeCtaKpiDiff(kpis, null);
      const alert = result.alerts.find(a => a.id === 'completion-low');
      expect(alert).toBeDefined();
      expect(alert!.severity).toBe('critical');
    });

    it('Landing→CTA転換率が低いとwarningを返す', () => {
      const kpis = makeKpis({
        totalLandings: 20,
        totalCtaClicks: 3,
        ...withFunnel(20, 3, 2),
      });
      const result = computeCtaKpiDiff(kpis, null);
      const alert = result.alerts.find(a => a.id === 'cta-conversion-low');
      expect(alert).toBeDefined();
      expect(alert!.message).toContain('20回');
    });

    it('全指標が閾値を満たしていればアラートなし', () => {
      const kpis = makeKpis({
        totalLandings: 20,
        totalCtaClicks: 15,
        heroQueueRatio: { heroCount: 12, queueCount: 3, heroRate: 80, queueRate: 20 },
        ...withFunnel(20, 15, 10),
      });
      const result = computeCtaKpiDiff(kpis, null);
      expect(result.alerts).toEqual([]);
    });

    it('CTAデータがない場合はアラートを出さない', () => {
      const kpis = makeKpis(); // all zeros
      const result = computeCtaKpiDiff(kpis, null);
      expect(result.alerts).toEqual([]);
    });

    it('カスタム閾値を受け付ける', () => {
      const kpis = makeKpis({
        heroQueueRatio: { heroCount: 8, queueCount: 2, heroRate: 80, queueRate: 20 },
      });
      const strict: AlertThresholds = { ...DEFAULT_THRESHOLDS, heroRateMin: 90 };
      const result = computeCtaKpiDiff(kpis, null, strict);
      const alert = result.alerts.find(a => a.id === 'hero-rate-low');
      expect(alert).toBeDefined();
      expect(alert!.threshold).toBe(90);
    });

    it('Landing数が5未満のときCTA転換率アラートは出さない（サンプル不足）', () => {
      const kpis = makeKpis({
        totalLandings: 3,
        totalCtaClicks: 0,
        ...withFunnel(3, 0, 0),
      });
      const result = computeCtaKpiDiff(kpis, null);
      const alert = result.alerts.find(a => a.id === 'cta-conversion-low');
      expect(alert).toBeUndefined();
    });
  });
});
