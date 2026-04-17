/**
 * useMeetingEvidenceDraft — モニタリング会議ドラフト自動引用 hook
 *
 * 4つのデータソースを収集し、純関数 `buildMeetingEvidenceDraft()` に渡す。
 *
 * ── ソース ──
 * 1. daily   → getDailyTableRecords + buildMonitoringDailySummary
 * 2. alert   → getABCRecordsForUser + buildUserAlerts
 * 3. abc     → 同上の ABCRecord[] + summarizeABCPatterns
 * 4. strategy → 同上の ABCRecord[] + summarizeStrategyUsage
 *
 * ── 設計 ──
 * - ABC取得は 1回で 3ソース（alert / abc / strategy）を使い回す
 * - 各ソースの部分失敗は null 扱いで全体を落とさない
 * - useMemo で再計算を最小限にする
 *
 * @module features/monitoring/hooks/useMeetingEvidenceDraft
 */

import { useMemo } from 'react';

import { getDailyTableRecords } from '@/features/daily/repositories/sharepoint/dailyTableRepository';
import {
  buildMonitoringDailySummary,
  type DailyMonitoringSummary,
} from '../domain/monitoringDailyAnalytics';
import { getABCRecordsForUser } from '@/features/ibd/core/ibdStore';
import { buildUserAlerts, type UserAlert } from '@/features/today/domain/buildUserAlerts';
import {
  getMeetingEvidenceDraft,
  getABCPatternSummary,
  getStrategyUsageSummary,
  type MeetingEvidenceDraft,
  type ABCPatternSummary,
  type StrategyUsageSummary,
} from '@/app/services/bridgeProxy';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const DEFAULT_LOOKBACK_DAYS = 60;

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface UseMeetingEvidenceDraftResult {
  /** 会議ドラフト（全ソース空の場合は sourceCount: 0 のオブジェクト） */
  draft: MeetingEvidenceDraft;
  /** 日次記録サマリー（個別参照用） */
  dailySummary: DailyMonitoringSummary | null;
  /** アラート一覧（個別参照用） */
  alerts: UserAlert[];
  /** ABC パターン（個別参照用） */
  abcPatterns: ABCPatternSummary | null;
  /** 戦略実績（個別参照用） */
  strategyUsage: StrategyUsageSummary | null;
  /** 元データの件数 */
  dailyRecordCount: number;
  /** ABC レコード件数 */
  abcRecordCount: number;
}

// ─────────────────────────────────────────────────────────
// 内部ヘルパー
// ─────────────────────────────────────────────────────────

function computeDateRange(lookbackDays: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - lookbackDays);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/**
 * 安全に関数を呼び出し、失敗時は fallback を返す
 */
function safeCall<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────

/**
 * モニタリング会議ドラフト自動引用 hook
 *
 * @param userId       - 対象利用者 ID
 * @param userName     - 利用者名（ドラフトヘッダーに使用）
 * @param lookbackDays - 遡り日数（デフォルト: 60）
 */
export function useMeetingEvidenceDraft(
  userId: string,
  userName: string,
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
): UseMeetingEvidenceDraftResult {
  return useMemo(() => {
    const emptyResult: UseMeetingEvidenceDraftResult = {
      draft: { sections: [], fullText: '', sourceCount: 0 },
      dailySummary: null,
      alerts: [],
      abcPatterns: null,
      strategyUsage: null,
      dailyRecordCount: 0,
      abcRecordCount: 0,
    };

    if (!userId) return emptyResult;

    const range = computeDateRange(lookbackDays);

    // ── 1. Daily 日次記録 ──
    const dailyRecords = safeCall(
      () => getDailyTableRecords(userId, range),
      [],
    );
    const dailySummary = safeCall<DailyMonitoringSummary | null>(
      () => (dailyRecords.length > 0 ? buildMonitoringDailySummary(dailyRecords) : null),
      null,
    );

    // ── 2–4. ABC レコード（1回取得、3ソースで使い回す） ──
    const abcRecords = safeCall(
      () => getABCRecordsForUser(userId),
      [],
    );

    // 2. Alerts
    const alerts = safeCall<UserAlert[]>(
      () => {
        if (abcRecords.length === 0) return [];
        const result = buildUserAlerts(abcRecords);
        return result.byUser.get(userId) ?? [];
      },
      [],
    );

    // 3. ABC パターン
    const abcPatterns = safeCall<ABCPatternSummary | null>(
      () => getABCPatternSummary(abcRecords),
      null,
    );

    // 4. 戦略実績
    const strategyUsage = safeCall<StrategyUsageSummary | null>(
      () => getStrategyUsageSummary(abcRecords),
      null,
    );

    // ── 統合 ──
    const draft = getMeetingEvidenceDraft({
      userName,
      from: range.from,
      to: range.to,
      dailySummary,
      alerts,
      abcPatterns,
      strategyUsage,
    });

    return {
      draft,
      dailySummary,
      alerts,
      abcPatterns,
      strategyUsage,
      dailyRecordCount: dailyRecords.length,
      abcRecordCount: abcRecords.length,
    };
  }, [userId, userName, lookbackDays]);
}
