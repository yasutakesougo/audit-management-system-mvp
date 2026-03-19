/**
 * buildReviewLoopSummary — 改善会議用サマリを生成する pure function
 *
 * アラート一覧と持続性情報から、会議の一次資料として読める要約を生成する。
 * 数値集計 + 主な懸念事項（topConcerns）を優先順で出力する。
 *
 * @see computeAlertPersistence.ts — AlertPersistence 型
 * @see computeCtaKpiDiff.ts — KpiAlert 型
 */

import type { KpiAlert } from './computeCtaKpiDiff';
import type { AlertPersistence, PersistenceStatus } from './computeAlertPersistence';
import { formatPersistenceDuration, formatWorseningStreak } from './computeAlertPersistence';

// ── Types ───────────────────────────────────────────────────────────────────

export type ReviewLoopSummary = {
  /** 現在のアラート総数 */
  totalCurrentAlerts: number;
  /** 新規アラート数 */
  newAlerts: number;
  /** 継続アラート数 */
  ongoingAlerts: number;
  /** 悪化傾向アラート数 */
  worseningAlerts: number;
  /** 改善傾向アラート数 */
  improvingAlerts: number;
  /** critical レベルのアラート数 */
  criticalAlerts: number;
  /** warning レベルのアラート数 */
  warningAlerts: number;
  /** 主な懸念事項（優先度順） */
  topConcerns: string[];
};

// ── Core Function ───────────────────────────────────────────────────────────

export type BuildReviewLoopSummaryArgs = {
  alerts: KpiAlert[];
  persistence: AlertPersistence[];
};

/**
 * アラートと持続性情報から改善会議用サマリを生成する
 *
 * topConcerns の優先順:
 * 1. worsening (悪化) — 最も緊急
 * 2. ongoing (長期継続) — consecutivePeriods が大きい順
 * 3. new + critical — 新規かつ深刻
 * 4. その他
 */
export function buildReviewLoopSummary(
  args: BuildReviewLoopSummaryArgs,
): ReviewLoopSummary {
  const { alerts, persistence } = args;

  // ── 持続性ステータス別集計 ──
  const statusCounts: Record<PersistenceStatus, number> = {
    new: 0,
    ongoing: 0,
    improving: 0,
    worsening: 0,
  };

  const persistenceMap = new Map<string, AlertPersistence>();
  for (const p of persistence) {
    persistenceMap.set(p.alertKey, p);
    statusCounts[p.status] += 1;
  }

  // persistence に含まれない alerts は新規扱い
  const alertsWithoutPersistence = alerts.filter(
    (a) => !persistenceMap.has(a.id),
  );
  statusCounts.new += alertsWithoutPersistence.length;

  // ── severity 別集計 ──
  let criticalAlerts = 0;
  let warningAlerts = 0;
  for (const a of alerts) {
    if (a.severity === 'critical') {
      criticalAlerts += 1;
    } else {
      warningAlerts += 1;
    }
  }

  // ── topConcerns 生成 ──
  const concerns: { priority: number; text: string }[] = [];

  for (const p of persistence) {
    const alert = alerts.find((a) => a.id === p.alertKey);
    if (!alert) continue;

    const label = alert.label;

    if (p.status === 'worsening') {
      const streak = formatWorseningStreak(p.worseningStreak);
      const text = streak
        ? `${label}が${streak}`
        : `${label}が悪化傾向`;
      concerns.push({ priority: 0, text });
    } else if (p.status === 'ongoing' && p.consecutivePeriods >= 2) {
      const duration = formatPersistenceDuration(p.consecutivePeriods);
      concerns.push({ priority: 1, text: `${label}が${duration}` });
    } else if (p.status === 'new' && alert.severity === 'critical') {
      concerns.push({ priority: 2, text: `${label}（新規 critical）` });
    }
  }

  // persistence に含まれない critical alerts も追加
  for (const a of alertsWithoutPersistence) {
    if (a.severity === 'critical') {
      concerns.push({ priority: 2, text: `${a.label}（新規 critical）` });
    }
  }

  // 優先度順 → 同一優先度内は出現順維持
  concerns.sort((a, b) => a.priority - b.priority);

  // 最大5件に制限
  const topConcerns = concerns.slice(0, 5).map((c) => c.text);

  return {
    totalCurrentAlerts: alerts.length,
    newAlerts: statusCounts.new,
    ongoingAlerts: statusCounts.ongoing,
    worseningAlerts: statusCounts.worsening,
    improvingAlerts: statusCounts.improving,
    criticalAlerts,
    warningAlerts,
    topConcerns,
  };
}
