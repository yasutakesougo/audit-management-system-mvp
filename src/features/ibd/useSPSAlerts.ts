// ---------------------------------------------------------------------------
// useSPSAlerts — ダッシュボード用 SPS 更新アラートフック
// ---------------------------------------------------------------------------
import { useMemo } from 'react';

import type { SPSAlert } from './ibdStore';
import { getExpiringSPSAlerts, getSupervisionCounter } from './ibdStore';

export interface SPSAlertsSummary {
  /** 全アラート（期限順） */
  alerts: SPSAlert[];
  /** 期限超過（error）の件数 */
  overdueCount: number;
  /** 14日以内（warning）の件数 */
  warningCount: number;
  /** アラート有無 */
  hasAlerts: boolean;
  /** 最もクリティカルなアラートレベル */
  worstLevel: 'ok' | 'warning' | 'error';
}

/**
 * SPS 更新アラート情報を取得するフック
 *
 * @param daysThreshold アラート表示対象の残日数閾値（デフォルト: 30日）
 * @param today テスト用の日付指定
 */
export function useSPSAlerts(daysThreshold = 30, today?: string): SPSAlertsSummary {
  return useMemo(() => {
    const alerts = getExpiringSPSAlerts(daysThreshold, today);
    const overdueCount = alerts.filter((a) => a.level === 'error').length;
    const warningCount = alerts.filter((a) => a.level === 'warning').length;

    let worstLevel: 'ok' | 'warning' | 'error' = 'ok';
    if (overdueCount > 0) worstLevel = 'error';
    else if (warningCount > 0) worstLevel = 'warning';

    return {
      alerts,
      overdueCount,
      warningCount,
      hasAlerts: alerts.length > 0,
      worstLevel,
    };
  }, [daysThreshold, today]);
}

/**
 * 特定利用者の観察義務アラートを取得するフック
 */
export function useSupervisionAlert(userId: number) {
  return useMemo(() => {
    const counter = getSupervisionCounter(userId);
    const needsObservation = counter.supportCount >= 2;
    const isWarning = counter.supportCount >= 1;

    return {
      ...counter,
      needsObservation,
      isWarning,
      message: needsObservation
        ? `観察義務超過: ${counter.supportCount}回の支援が未観察です`
        : isWarning
          ? `次回支援前に観察推奨（${counter.supportCount}回未観察）`
          : '',
    };
  }, [userId]);
}
