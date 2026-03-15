// ---------------------------------------------------------------------------
// useProactiveSPSAlerts — 行動データ × SPS期限のクロス分析フック
//
// ibdStore（SPS期限）+ behaviorStore（行動事象）+ users（IBDフラグ）を結合し、
// プロアクティブなアラートを生成する。
// ---------------------------------------------------------------------------
import { useMemo } from 'react';

import { getLatestSPS } from './ibdStore';
import { daysUntilSPSReview } from './ibdTypes';
import {
    DEFAULT_THRESHOLDS,
    generateProactiveAlerts,
    type AlertThresholds,
    type IncidentSummary,
    type ProactiveAlert,
} from './proactiveSPSAlerts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IBDUserForAlert {
  /** ユーザーID（文字列） */
  UserID: string;
  /** 表示名 */
  FullName: string;
  /** ユーザーID（数値 — SPS検索用） */
  Id?: number;
}

export interface ProactiveSPSAlertsSummary {
  alerts: ProactiveAlert[];
  urgentCount: number;
  watchCount: number;
  hasAlerts: boolean;
}

// ---------------------------------------------------------------------------
// Behavior Incident Counter (Pure)
// ---------------------------------------------------------------------------

interface BehaviorLike {
  intensity: number;
  recordedAt: string;
}

/**
 * 直近N日間の事象カウントを計算する（純関数）
 */
export function countRecentIncidents(
  records: BehaviorLike[],
  lookbackDays: number,
  intensityThreshold: number,
  today?: Date,
): { incidentCount: number; highIntensityCount: number } {
  const now = today ?? new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  let incidentCount = 0;
  let highIntensityCount = 0;

  for (const r of records) {
    const recordDate = new Date(r.recordedAt);
    if (recordDate >= cutoff && recordDate <= now) {
      incidentCount++;
      if (r.intensity >= intensityThreshold) {
        highIntensityCount++;
      }
    }
  }

  return { incidentCount, highIntensityCount };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * 行動分析対象者の行動事象とSPS期限をクロスしてプロアクティブアラートを生成する。
 *
 * ⚠️ MVP実装: behaviorRecords は呼び出し側から注入する設計。
 * 将来的に useBehaviorStore.fetchForAnalysis() を内部で呼ぶことも可能。
 *
 * @param ibdUsers 行動分析対象ユーザーリスト
 * @param behaviorRecordsByUser ユーザーID → 行動記録配列のマップ
 * @param thresholds アラート閾値設定
 */
export function useProactiveSPSAlerts(
  ibdUsers: IBDUserForAlert[],
  behaviorRecordsByUser: Record<string, BehaviorLike[]> = {},
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): ProactiveSPSAlertsSummary {
  return useMemo(() => {
    const summaries: IncidentSummary[] = ibdUsers.map((user) => {
      const records = behaviorRecordsByUser[user.UserID] ?? [];
      const { incidentCount, highIntensityCount } = countRecentIncidents(
        records,
        thresholds.lookbackDays,
        thresholds.intensityThreshold,
      );

      // SPS期限を取得（数値IDがある場合）
      let daysRemaining: number | null = null;
      if (user.Id) {
        const latestSPS = getLatestSPS(user.Id);
        if (latestSPS) {
          daysRemaining = daysUntilSPSReview(latestSPS.nextReviewDueDate);
        }
      }

      return {
        userId: user.UserID,
        userName: user.FullName,
        incidentCount,
        highIntensityCount,
        daysUntilSPSReview: daysRemaining,
      };
    });

    const alerts = generateProactiveAlerts(summaries, thresholds);

    return {
      alerts,
      urgentCount: alerts.filter((a) => a.level === 'urgent').length,
      watchCount: alerts.filter((a) => a.level === 'watch').length,
      hasAlerts: alerts.length > 0,
    };
  }, [ibdUsers, behaviorRecordsByUser, thresholds]);
}
