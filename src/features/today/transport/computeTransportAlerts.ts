/**
 * computeTransportAlerts — Transport KPI からアラートを生成する pure function
 *
 * 入力: TransportKpis + 時刻コンテキスト
 * 出力: KpiAlert[] (既存 telemetry domain の型を再利用)
 *
 * 設計原則:
 *   KPI = facts (何件起きたか) → computeTransportKpis.ts
 *   Alert = judgment (問題かどうか) → ここ
 *
 * @see transport_telemetry_design.md
 */
import type { KpiAlert } from '@/features/telemetry/domain/computeCtaKpiDiff';
import type { TransportKpis } from './computeTransportKpis';

// ── Alert Thresholds ────────────────────────────────────────────────────────

export type TransportAlertThresholds = {
  /** sync-failed がこの件数以上で critical */
  syncFailedMax: number;
  /** low-completion 判定を開始する時刻 (24h format, e.g. 16) */
  completionCheckHour: number;
  /** completion rate がこの値未満で warning */
  completionRateMin: number;
};

export const DEFAULT_TRANSPORT_THRESHOLDS: TransportAlertThresholds = {
  syncFailedMax: 3,
  completionCheckHour: 16,
  completionRateMin: 50,
};

// ── Alert Input ─────────────────────────────────────────────────────────────

export type TransportAlertInput = {
  kpis: TransportKpis;
  /** 現在時刻 (テスト容易性のため外注入) */
  now: Date;
  thresholds?: TransportAlertThresholds;
};

// ── Core Computation ────────────────────────────────────────────────────────

/**
 * Transport KPI からアラートを生成する。
 * 閾値超過時に KpiAlert 形式で返す。
 */
export function computeTransportAlerts(input: TransportAlertInput): KpiAlert[] {
  const {
    kpis,
    now,
    thresholds = DEFAULT_TRANSPORT_THRESHOLDS,
  } = input;

  const alerts: KpiAlert[] = [];

  // ── 1. sync-failed count ≥ threshold → critical ──────────────────────────
  if (kpis.syncFailedCount >= thresholds.syncFailedMax) {
    alerts.push({
      id: 'transport-sync-fail-count',
      severity: 'critical',
      label: '送迎同期エラー多発',
      message: `AttendanceDaily への同期が ${kpis.syncFailedCount} 件失敗しています（閾値: ${thresholds.syncFailedMax} 件）。実績記録に欠損が生じている可能性があります。`,
      value: kpis.syncFailedCount,
      threshold: thresholds.syncFailedMax,
    });
  }

  // ── 2. fallback active → warning ─────────────────────────────────────────
  // 当日中に1回でもフォールバックが発動したら warning
  if (kpis.fallbackActive) {
    alerts.push({
      id: 'transport-fallback-active',
      severity: 'warning',
      label: '送迎対象者リスト未取得',
      message: `AttendanceUsers の取得に失敗し、全利用者を送迎対象として表示しています（フォールバック ${kpis.fallbackCount} 回発動）。送迎対象者リストを確認してください。`,
      value: kpis.fallbackCount,
      threshold: 1,
    });
  }

  // ── 3. stale-in-progress ≥ 1 → warning ──────────────────────────────────
  if (kpis.staleCount > 0) {
    alerts.push({
      id: 'transport-stale-count',
      severity: 'warning',
      label: '送迎長時間停滞',
      message: `30分以上「移動中」のままの送迎が ${kpis.staleCount} 件あります。ステータスの更新漏れがないか確認してください。`,
      value: kpis.staleCount,
      threshold: 1,
    });
  }

  // ── 4. low completion rate (time-gated) → warning ────────────────────────
  // completionCheckHour 以降かつ完了率が閾値未満の場合のみ
  const currentHour = now.getHours();
  if (
    currentHour >= thresholds.completionCheckHour &&
    kpis.arrivalCompletionRate !== null &&
    kpis.arrivalCompletionRate < thresholds.completionRateMin
  ) {
    alerts.push({
      id: 'transport-low-completion',
      severity: 'warning',
      label: '送迎完了率低下',
      message: `${currentHour}時時点の到着完了率が ${kpis.arrivalCompletionRate}% です（閾値: ${thresholds.completionRateMin}%）。未到着の利用者を確認してください。`,
      value: kpis.arrivalCompletionRate,
      threshold: thresholds.completionRateMin,
    });
  }

  return alerts;
}
