/**
 * computeAlertPersistence — 同一アラートの継続状態を算出する pure function
 *
 * current / previous の alerts を比較し、各 alert に対して
 * 初出・継続期間・連続悪化回数などの持続性情報を付与する。
 *
 * v6 初期実装では current / previous の2期間比較ベースで動作し、
 * 将来的に期間横断保存へ拡張可能な型設計とする。
 *
 * @see classifyAlertState.ts — 状態分類
 * @see computeCtaKpiDiff.ts — KpiAlert 型
 */

import type { KpiAlert } from './computeCtaKpiDiff';

// ── Types ───────────────────────────────────────────────────────────────────

export type PersistenceStatus = 'new' | 'ongoing' | 'improving' | 'worsening';

export type AlertPersistence = {
  /** alert.id をキーとして利用 */
  alertKey: string;
  /** 初出期間の開始日（ISO string）。v6 では current / previous ベース */
  firstSeenAt: string | null;
  /** 最終確認期間の開始日（ISO string） */
  lastSeenAt: string | null;
  /** 連続して出現した期間数（1 = 今期のみ、2 = 前期+今期） */
  consecutivePeriods: number;
  /** 連続して悪化した回数（0 = 悪化なし） */
  worseningStreak: number;
  /** 判定ステータス */
  status: PersistenceStatus;
  /** 前期間の値（存在する場合） */
  previousValue: number | null;
  /** 値の変化量（current - previous） */
  delta: number | null;
};

// ── Display Helpers ─────────────────────────────────────────────────────────

export const PERSISTENCE_LABELS: Record<PersistenceStatus, string> = {
  new: '🆕 新規',
  ongoing: '🔄 継続',
  improving: '📈 改善傾向',
  worsening: '📉 悪化傾向',
};

/**
 * 期間数を日本語ラベルに変換
 * @example formatDuration(1) → "今期のみ"
 * @example formatDuration(3) → "3期間継続"
 */
export function formatPersistenceDuration(consecutivePeriods: number): string {
  if (consecutivePeriods <= 1) return '今期のみ';
  return `${consecutivePeriods}期間継続`;
}

/**
 * 悪化ストリークをラベルに変換
 * @example formatWorseningStreak(0) → null
 * @example formatWorseningStreak(2) → "2期間連続悪化"
 */
export function formatWorseningStreak(streak: number): string | null {
  if (streak <= 0) return null;
  return `${streak}期間連続悪化`;
}

// ── Core Function ───────────────────────────────────────────────────────────

export type ComputeAlertPersistenceArgs = {
  currentAlerts: KpiAlert[];
  previousAlerts: KpiAlert[];
  currentPeriodStart: string;
  previousPeriodStart: string;
};

/**
 * current / previous の alert を比較し、各 alert の持続性情報を算出する
 *
 * 判定ロジック:
 * - current にのみ存在 → new (consecutivePeriods=1, worseningStreak=0)
 * - current + previous 両方に存在:
 *   - 値が改善方向 → improving (consecutivePeriods=2, worseningStreak=0)
 *   - 値が悪化方向 → worsening (consecutivePeriods=2, worseningStreak=1)
 *   - 値が同じ → ongoing (consecutivePeriods=2, worseningStreak=0)
 *
 * 改善/悪化の方向性:
 * - `*-high` 系（値が高いことが問題）: 値が下がる = 改善
 * - `*-low` / その他: 値が上がる = 改善
 */
export function computeAlertPersistence(
  args: ComputeAlertPersistenceArgs,
): AlertPersistence[] {
  const { currentAlerts, previousAlerts, currentPeriodStart, previousPeriodStart } = args;

  const prevMap = new Map<string, KpiAlert>();
  for (const a of previousAlerts) {
    prevMap.set(a.id, a);
  }

  return currentAlerts.map((alert): AlertPersistence => {
    const prev = prevMap.get(alert.id);

    if (!prev) {
      // 今期に新規出現
      return {
        alertKey: alert.id,
        firstSeenAt: currentPeriodStart,
        lastSeenAt: currentPeriodStart,
        consecutivePeriods: 1,
        worseningStreak: 0,
        status: 'new',
        previousValue: null,
        delta: null,
      };
    }

    // 前期にも存在 → 継続判定
    const delta = alert.value - prev.value;
    const isHighAlert = alert.id.includes('-high');

    let status: PersistenceStatus;
    let worseningStreak: number;

    if (delta === 0) {
      status = 'ongoing';
      worseningStreak = 0;
    } else if (isHighAlert) {
      // high 系: 値が下がる = 改善 / 上がる = 悪化
      if (delta < 0) {
        status = 'improving';
        worseningStreak = 0;
      } else {
        status = 'worsening';
        worseningStreak = 1;
      }
    } else {
      // low 系: 値が上がる = 改善 / 下がる = 悪化
      if (delta > 0) {
        status = 'improving';
        worseningStreak = 0;
      } else {
        status = 'worsening';
        worseningStreak = 1;
      }
    }

    return {
      alertKey: alert.id,
      firstSeenAt: previousPeriodStart,
      lastSeenAt: currentPeriodStart,
      consecutivePeriods: 2,
      worseningStreak,
      status,
      previousValue: prev.value,
      delta,
    };
  });
}
