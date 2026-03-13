/**
 * getCurrentPhaseFromConfig — 設定配列から現在のフェーズを判定する
 *
 * 設計方針:
 *   - 時刻文字列 "HH:mm" は内部で分単位整数に変換して比較
 *   - 日またぎフェーズ（endTime < startTime）に対応
 *   - 設定配列が空、またはどのフェーズにも該当しない場合は undefined を返す
 *   - 純粋関数 — 副作用なし
 */

import type {
  OperationFlowPhaseConfig,
  OperationFlowPhaseKey,
} from './operationFlowTypes';

// ────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────

/**
 * "HH:mm" → 0:00 からの経過分数に変換する
 *
 * @example parseTimeToMinutes("08:30") // 510
 * @example parseTimeToMinutes("17:00") // 1020
 *
 * @throws RangeError 形式不正の場合
 */
export function parseTimeToMinutes(time: string): number {
  const parts = time.split(':');
  if (parts.length !== 2) {
    throw new RangeError(`Invalid time format: "${time}" (expected "HH:mm")`);
  }

  const h = Number(parts[0]);
  const m = Number(parts[1]);

  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new RangeError(`Invalid time value: "${time}" (h=${h}, m=${m})`);
  }

  return h * 60 + m;
}

// ────────────────────────────────────────
// コア判定
// ────────────────────────────────────────

/**
 * 指定時刻がフェーズの時間範囲に含まれるかを判定する
 *
 * ルール:
 *   - start <= end  : start ≦ t < end  （通常）
 *   - start > end   : t >= start ∨ t < end （日またぎ）
 */
function isTimeInRange(
  minutesSinceMidnight: number,
  startMinutes: number,
  endMinutes: number,
): boolean {
  if (startMinutes <= endMinutes) {
    // 通常: 08:30(510)–09:00(540) → 510 ≦ t < 540
    return minutesSinceMidnight >= startMinutes && minutesSinceMidnight < endMinutes;
  }
  // 日またぎ: 18:00(1080)–08:30(510) → t ≧ 1080 ∨ t < 510
  return minutesSinceMidnight >= startMinutes || minutesSinceMidnight < endMinutes;
}

/**
 * 設定配列と時刻から現在のフェーズキーを返す
 *
 * @param now    - 判定対象の日時
 * @param config - フェーズ設定の配列
 * @returns 該当するフェーズキー。該当なしの場合は undefined
 *
 * 設定配列は sortOrder 順に走査し、最初に該当したフェーズを返す。
 */
export function getCurrentPhaseFromConfig(
  now: Date,
  config: readonly OperationFlowPhaseConfig[],
): OperationFlowPhaseKey | undefined {
  const h = now.getHours();
  const m = now.getMinutes();
  const t = h * 60 + m;

  // sortOrder 順にソートしてから走査（元配列を壊さない）
  const sorted = [...config].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const phase of sorted) {
    const start = parseTimeToMinutes(phase.startTime);
    const end = parseTimeToMinutes(phase.endTime);

    if (isTimeInRange(t, start, end)) {
      return phase.phaseKey;
    }
  }

  return undefined;
}

/**
 * 設定配列から指定フェーズの設定を取得する
 *
 * @param phaseKey - 取得対象のフェーズキー
 * @param config   - フェーズ設定の配列
 * @returns 該当するフェーズ設定。見つからない場合は undefined
 */
export function getPhaseConfig(
  phaseKey: OperationFlowPhaseKey,
  config: readonly OperationFlowPhaseConfig[],
): OperationFlowPhaseConfig | undefined {
  return config.find((c) => c.phaseKey === phaseKey);
}
