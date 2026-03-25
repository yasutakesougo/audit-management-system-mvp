/**
 * computeTransportKpis — Transport テレメトリイベントを集計 KPI に変換する pure function
 *
 * 入力: Firestore telemetry から取得した Transport イベント配列
 * 出力: 件数・方向別・完了率など、運用判断に必要な facts
 *
 * 設計原則:
 *   KPI = facts (何件起きたか)
 *   Alert = judgment (問題かどうか) → computeTransportAlerts.ts に委譲
 *
 * @see transport_telemetry_design.md
 */
import type { TransportTelemetryEvent } from './transportTelemetry';

// ── KPI Output Types ────────────────────────────────────────────────────────

export type TransportKpis = {
  /** 全ステータス遷移回数 */
  transitionCount: number;
  /** 迎え方向の遷移回数 */
  transitionCountTo: number;
  /** 送り方向の遷移回数 */
  transitionCountFrom: number;
  /** AttendanceDaily 同期失敗件数 */
  syncFailedCount: number;
  /** AttendanceUsers フォールバック発動件数 */
  fallbackCount: number;
  /** 当日中に1回でもフォールバックが発動したか */
  fallbackActive: boolean;
  /** stale-in-progress イベント件数 */
  staleCount: number;
  /** 到着確定件数 (toStatus === 'arrived') */
  arrivedCount: number;
  /**
   * 到着完了率 (0–100, 小数点以下四捨五入)
   * denominator が 0 の場合は null
   */
  arrivalCompletionRate: number | null;
};

// ── Empty KPIs ──────────────────────────────────────────────────────────────

export const EMPTY_TRANSPORT_KPIS: TransportKpis = {
  transitionCount: 0,
  transitionCountTo: 0,
  transitionCountFrom: 0,
  syncFailedCount: 0,
  fallbackCount: 0,
  fallbackActive: false,
  staleCount: 0,
  arrivedCount: 0,
  arrivalCompletionRate: null,
};

// ── Core Computation ────────────────────────────────────────────────────────

/**
 * Transport テレメトリイベント配列から KPI を集計する。
 *
 * @param events - Firestore telemetry から取得した Transport イベント配列
 * @param totalTransportUsers - 送迎対象者の総数（完了率の分母）。
 *                               0 または undefined の場合は arrivalCompletionRate = null。
 */
export function computeTransportKpis(
  events: TransportTelemetryEvent[],
  totalTransportUsers?: number,
): TransportKpis {
  let transitionCount = 0;
  let transitionCountTo = 0;
  let transitionCountFrom = 0;
  let syncFailedCount = 0;
  let fallbackCount = 0;
  let staleCount = 0;
  let arrivedCount = 0;

  for (const event of events) {
    switch (event.type) {
      case 'transport:status-transition':
        transitionCount++;
        if (event.direction === 'to') transitionCountTo++;
        else transitionCountFrom++;
        // 到着は toStatus で判定
        if (event.toStatus === 'arrived') arrivedCount++;
        break;

      case 'transport:sync-failed':
        syncFailedCount++;
        break;

      case 'transport:fallback-all-users':
        fallbackCount++;
        break;

      case 'transport:stale-in-progress':
        staleCount++;
        break;
    }
  }

  // 完了率計算
  const denominator = totalTransportUsers ?? 0;
  const arrivalCompletionRate =
    denominator > 0
      ? Math.round((arrivedCount / denominator) * 100)
      : null;

  return {
    transitionCount,
    transitionCountTo,
    transitionCountFrom,
    syncFailedCount,
    fallbackCount,
    fallbackActive: fallbackCount > 0,
    staleCount,
    arrivedCount,
    arrivalCompletionRate,
  };
}
