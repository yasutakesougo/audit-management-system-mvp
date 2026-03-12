/**
 * resolvePhase — Pure function to determine the current operational phase
 *
 * #822 useTimeSlot — Phase 2 時間帯連動 #1
 *
 * NOTE: Named `DayPhase` instead of `TimeSlot` to avoid collision with
 * the existing `TimeSlot` type in `src/domain/support/step-templates.ts`
 * which represents concrete schedule slots like '09:30-10:30'.
 * `DayPhase` represents the high-level operational phase of the day.
 */

// ─── Types ───────────────────────────────────────────────────────────────

/** Operational phase of the day */
export type DayPhase = 'morning' | 'midday' | 'evening';

// ─── Constants ───────────────────────────────────────────────────────────

/** Phase boundary hours (inclusive start) */
export const PHASE_BOUNDARIES = {
  midday: 11,  // 11:00–15:59
  evening: 16, // 16:00–23:59 (19:01+ も evening — 班長判断)
} as const;

// ─── Pure Function ───────────────────────────────────────────────────────

/**
 * Resolve operational phase from hour of day.
 *
 * | hour   | phase    | 説明                         |
 * |--------|----------|------------------------------|
 * | 0–6    | morning  | 深夜・早朝 → morning 扱い    |
 * | 7–10   | morning  | 朝の運用                     |
 * | 11–15  | midday   | 昼の運用                     |
 * | 16–23  | evening  | 夕方（19:01+ 含む、班長判断） |
 *
 * @param hour - Hour of day (0–23)
 * @returns DayPhase
 *
 * 将来拡張メモ: mode: 'auto' | 'manual' で手動フェーズ切替に対応
 */
export function resolvePhase(hour: number): DayPhase {
  if (hour >= PHASE_BOUNDARIES.midday && hour < PHASE_BOUNDARIES.evening) {
    return 'midday';
  }
  if (hour >= PHASE_BOUNDARIES.evening) {
    return 'evening';
  }
  return 'morning';
}
