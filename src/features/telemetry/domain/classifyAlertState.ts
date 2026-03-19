/**
 * classifyAlertState — アラートの継続状態を分類する pure function
 *
 * 現在の alerts と前期間の alerts を比較し、各 alert が
 * 新規 / 継続 / 改善 / 悪化 のどれかを判定する。
 *
 * @see computeCtaKpiDiff.ts — KpiAlert 型
 */

import type { KpiAlert } from './computeCtaKpiDiff';

// ── Types ───────────────────────────────────────────────────────────────────

export type AlertState = 'new' | 'continuing' | 'improving' | 'worsening';

export type ClassifiedAlert = {
  alert: KpiAlert;
  state: AlertState;
  /** 前期間の値（存在する場合） */
  previousValue: number | null;
  /** 値の変化量（current - previous） */
  delta: number | null;
};

// ── State Labels ────────────────────────────────────────────────────────────

export const ALERT_STATE_LABELS: Record<AlertState, string> = {
  new: '🆕 新規',
  continuing: '🔄 継続',
  improving: '📈 改善傾向',
  worsening: '📉 悪化傾向',
};

export const ALERT_STATE_COLORS: Record<AlertState, string> = {
  new: '#3b82f6',
  continuing: '#94a3b8',
  improving: '#10b981',
  worsening: '#ef4444',
};

// ── Core Function ───────────────────────────────────────────────────────────

/**
 * 現在の alerts と前期間の alerts を比較して状態を分類する
 *
 * 判定ロジック:
 * - 前期間に同じ ID がない → new
 * - 前期間に同じ ID があり、値が改善方向 → improving
 * - 前期間に同じ ID があり、値が悪化方向 → worsening
 * - 前期間に同じ ID があり、値が同じ → continuing
 *
 * 改善/悪化の方向性:
 * - `*-low` 系: 値が上がる = 改善
 * - `*-high` 系: 値が下がる = 改善
 */
export function classifyAlertStates(
  currentAlerts: KpiAlert[],
  previousAlerts: KpiAlert[],
): ClassifiedAlert[] {
  const prevMap = new Map<string, KpiAlert>();
  for (const a of previousAlerts) {
    prevMap.set(a.id, a);
  }

  return currentAlerts.map((alert) => {
    const prev = prevMap.get(alert.id);

    if (!prev) {
      return {
        alert,
        state: 'new' as AlertState,
        previousValue: null,
        delta: null,
      };
    }

    const delta = alert.value - prev.value;
    const isHighAlert = alert.id.includes('-high');

    // high 系: 値が下がる = 改善 / 上がる = 悪化
    // low 系: 値が上がる = 改善 / 下がる = 悪化
    let state: AlertState;
    if (delta === 0) {
      state = 'continuing';
    } else if (isHighAlert) {
      state = delta < 0 ? 'improving' : 'worsening';
    } else {
      state = delta > 0 ? 'improving' : 'worsening';
    }

    return {
      alert,
      state,
      previousValue: prev.value,
      delta,
    };
  });
}
