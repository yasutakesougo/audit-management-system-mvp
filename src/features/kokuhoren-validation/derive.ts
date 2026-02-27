/**
 * 国保連プリバリデーション — 派生値算出
 *
 * 純粋関数。HHMM から滞在時間と算定時間コードを算出。
 * 生活介護 様式71 の時間区分に対応。
 */
import type { DailyProvisionEntry, DerivedProvisionEntry, TimeCode } from './types';

/**
 * HHMM → 分（0:00基準） に変換
 * 例: 930 → 570, 1530 → 930
 */
export function hhmmToMinutes(hhmm: number): number {
  const hh = Math.floor(hhmm / 100);
  const mm = hhmm % 100;
  return hh * 60 + mm;
}

/**
 * 開始/終了 から滞在時間（分）を算出
 * 不完全な場合は null
 */
export function calcDurationMinutes(
  startHHMM: number | null | undefined,
  endHHMM: number | null | undefined,
): number | null {
  if (startHHMM == null || endHHMM == null) return null;
  const startMin = hhmmToMinutes(startHHMM);
  const endMin = hhmmToMinutes(endHHMM);
  if (endMin <= startMin) return null; // 不正（開始≧終了）
  return endMin - startMin;
}

/**
 * 滞在時間（分）→ 算定時間コード（生活介護）
 *
 * | コード | 時間帯        |
 * |--------|---------------|
 * | 01     | 〜2h (〜120)  |
 * | 02     | 2h〜3h        |
 * | 03     | 3h〜4h        |
 * | 04     | 4h〜5h        |
 * | 05     | 5h〜6h        |
 * | 06     | 6h〜7h        |
 * | 07     | 7h〜8h        |
 * | 08     | 8h〜          |
 */
export function durationToTimeCode(durationMinutes: number | null): TimeCode {
  if (durationMinutes == null || durationMinutes <= 0) return null;

  if (durationMinutes <= 120) return '01';
  if (durationMinutes <= 180) return '02';
  if (durationMinutes <= 240) return '03';
  if (durationMinutes <= 300) return '04';
  if (durationMinutes <= 360) return '05';
  if (durationMinutes <= 420) return '06';
  if (durationMinutes <= 480) return '07';
  return '08'; // 8h〜
}

/**
 * DailyProvisionEntry に派生値を付与
 */
export function deriveProvisionEntry(entry: DailyProvisionEntry): DerivedProvisionEntry {
  const durationMinutes = calcDurationMinutes(entry.startHHMM, entry.endHHMM);
  const timeCode = durationToTimeCode(durationMinutes);

  return {
    ...entry,
    durationMinutes,
    timeCode,
  };
}

/**
 * 滞在時間が極端（短すぎ or 長すぎ）かどうか
 */
export function isDurationExtreme(durationMinutes: number | null): boolean {
  if (durationMinutes == null) return false;
  return durationMinutes < 30 || durationMinutes > 720; // 30分未満 or 12h超
}

/**
 * 「提供」以外のレコードに時間/加算が含まれているか
 */
export function hasDataOnNonProvided(entry: DailyProvisionEntry): boolean {
  if (entry.status === '提供') return false;

  const hasTime = entry.startHHMM != null || entry.endHHMM != null;
  const hasAddons = !!(
    entry.hasTransport ||
    entry.hasMeal ||
    entry.hasBath ||
    entry.hasExtended
  );
  // hasAbsentSupport は欠席でもあり得るので除外

  return hasTime || hasAddons;
}
