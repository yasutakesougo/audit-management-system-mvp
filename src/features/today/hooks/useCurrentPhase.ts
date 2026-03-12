/**
 * useCurrentPhase — React hook wrapping resolvePhase
 *
 * #822 useTimeSlot — Phase 2 時間帯連動 #1
 *
 * Returns the current operational DayPhase based on the system clock.
 *
 * NOTE: No interval/timer — the phase is resolved once per render.
 * Page navigations and re-mounts naturally refresh the value.
 * If real-time transitions are needed later, add a useEffect + setInterval.
 *
 * 将来拡張メモ: mode: 'auto' | 'manual' で手動フェーズ切替に対応
 */

import { resolvePhase, type DayPhase } from '../lib/resolvePhase';

export { type DayPhase } from '../lib/resolvePhase';

export function useCurrentPhase(): DayPhase {
  const now = new Date();
  return resolvePhase(now.getHours());
}
