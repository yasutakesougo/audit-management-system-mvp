/**
 * computeCtaKpiDiff — 2期間の KPI 差分を算出する pure function
 *
 * 入力: current / previous の DashboardKpis
 * 出力: 各 KPI の差分と傾向 (up / down / flat)
 *
 * @see computeCtaKpis.ts — 単期間計算
 */

import type { DashboardKpis } from './computeCtaKpis';

// ── Types ───────────────────────────────────────────────────────────────────

export type Trend = 'up' | 'down' | 'flat';

/** 単一 KPI の前期間比較 */
export type KpiDiff = {
  current: number;
  previous: number;
  diff: number;        // current - previous (絶対値差分)
  diffFormatted: string; // "+5%" / "-3%" / "±0%"
  trend: Trend;
};

/** KPI 閾値アラート */
export type KpiAlert = {
  id: string;
  severity: 'warning' | 'critical';
  label: string;
  message: string;
  value: number;
  threshold: number;
};

/** ダッシュボード差分全体 */
export type DashboardKpiDiffs = {
  heroRate: KpiDiff;
  queueRate: KpiDiff;
  completionRate: KpiDiff;
  totalCtaClicks: KpiDiff;
  alerts: KpiAlert[];
};

// ── Alert Thresholds ────────────────────────────────────────────────────────

export type AlertThresholds = {
  /** Hero 利用率がこれを下回ると warning */
  heroRateMin: number;
  /** Queue 利用率がこれを上回ると warning */
  queueRateMax: number;
  /** 完了率がこれを下回ると critical */
  completionRateMin: number;
  /** Landing→CTA 転換率がこれを下回ると warning */
  ctaConversionMin: number;
};

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  heroRateMin: 70,
  queueRateMax: 40,
  completionRateMin: 50,
  ctaConversionMin: 30,
};

// ── Core Computation ────────────────────────────────────────────────────────

function computeDiff(current: number, previous: number, isPercentage: boolean): KpiDiff {
  const raw = current - previous;

  let trend: Trend;
  if (raw > 0) trend = 'up';
  else if (raw < 0) trend = 'down';
  else trend = 'flat';

  let diffFormatted: string;
  if (isPercentage) {
    if (raw > 0) diffFormatted = `↑ +${raw}%`;
    else if (raw < 0) diffFormatted = `↓ ${raw}%`;
    else diffFormatted = '→ ±0%';
  } else {
    if (raw > 0) diffFormatted = `↑ +${raw}`;
    else if (raw < 0) diffFormatted = `↓ ${raw}`;
    else diffFormatted = '→ ±0';
  }

  return { current, previous, diff: raw, diffFormatted, trend };
}

function computeAlerts(kpis: DashboardKpis, thresholds: AlertThresholds): KpiAlert[] {
  const alerts: KpiAlert[] = [];
  const { heroQueueRatio, funnel, totalCtaClicks, totalLandings } = kpis;

  // Hero 利用率 < threshold
  if (heroQueueRatio.heroRate < thresholds.heroRateMin && (heroQueueRatio.heroCount + heroQueueRatio.queueCount) > 0) {
    alerts.push({
      id: 'hero-rate-low',
      severity: 'warning',
      label: 'Hero 利用率低下',
      message: `Hero 利用率が ${heroQueueRatio.heroRate}% です（閾値: ${thresholds.heroRateMin}%）。Hero CTA のコピーや配置を見直してください。`,
      value: heroQueueRatio.heroRate,
      threshold: thresholds.heroRateMin,
    });
  }

  // Queue 利用率 > threshold
  if (heroQueueRatio.queueRate > thresholds.queueRateMax && (heroQueueRatio.heroCount + heroQueueRatio.queueCount) > 0) {
    alerts.push({
      id: 'queue-rate-high',
      severity: 'warning',
      label: 'Queue 偏重',
      message: `Queue 利用率が ${heroQueueRatio.queueRate}% です（閾値: ${thresholds.queueRateMax}%）。Hero が弱い可能性があります。`,
      value: heroQueueRatio.queueRate,
      threshold: thresholds.queueRateMax,
    });
  }

  // 完了率 < threshold
  const completionRate = funnel[2]?.rate ?? 0;
  if (completionRate < thresholds.completionRateMin && totalCtaClicks > 0) {
    alerts.push({
      id: 'completion-low',
      severity: 'critical',
      label: '完了率低下',
      message: `CTA→完了の転換率が ${completionRate}% です（閾値: ${thresholds.completionRateMin}%）。完了アクションへの導線を確認してください。`,
      value: completionRate,
      threshold: thresholds.completionRateMin,
    });
  }

  // Landing→CTA 転換率が極端に低い
  const ctaConversion = totalLandings > 0 ? Math.round((totalCtaClicks / totalLandings) * 100) : 0;
  if (ctaConversion < thresholds.ctaConversionMin && totalLandings >= 5) {
    alerts.push({
      id: 'cta-conversion-low',
      severity: 'warning',
      label: 'CTA 転換率低下',
      message: `Landing→CTA 転換率が ${ctaConversion}% です（閾値: ${thresholds.ctaConversionMin}%）。${totalLandings}回の Landing に対して ${totalCtaClicks}回のクリックしかありません。`,
      value: ctaConversion,
      threshold: thresholds.ctaConversionMin,
    });
  }

  return alerts;
}

/**
 * 2期間の KPI から差分とアラートを算出する
 */
export function computeCtaKpiDiff(
  current: DashboardKpis,
  previous: DashboardKpis | null,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): DashboardKpiDiffs {
  const prev = previous ?? {
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
  };

  const currentCompletionRate = current.funnel[2]?.rate ?? 0;
  const prevCompletionRate = prev.funnel[2]?.rate ?? 0;

  return {
    heroRate: computeDiff(current.heroQueueRatio.heroRate, prev.heroQueueRatio.heroRate, true),
    queueRate: computeDiff(current.heroQueueRatio.queueRate, prev.heroQueueRatio.queueRate, true),
    completionRate: computeDiff(currentCompletionRate, prevCompletionRate, true),
    totalCtaClicks: computeDiff(current.totalCtaClicks, prev.totalCtaClicks, false),
    alerts: computeAlerts(current, thresholds),
  };
}
