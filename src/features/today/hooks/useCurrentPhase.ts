/**
 * useCurrentPhase — React hook wrapping resolvePhase + OperationalPhase
 *
 * #822 useTimeSlot — Phase 2 時間帯連動 #1
 *
 * Returns both the legacy DayPhase and the shared OperationalPhase
 * based on the system clock.
 *
 * Phase 3 (設定値ベース判定):
 *   - useOperationFlowConfig() で設定配列を取得
 *   - resolvePhaseFromConfig() で設定値から判定
 *   - 設定ロード前 / 設定穴は旧 getCurrentPhase() にフォールバック
 *
 * NOTE: No interval/timer — the phase is resolved once per render.
 * Page navigations and re-mounts naturally refresh the value.
 * If real-time transitions are needed later, add a useEffect + setInterval.
 *
 * 将来拡張メモ: mode: 'auto' | 'manual' で手動フェーズ切替に対応
 */

import type { OperationalPhase, PrimaryScreen } from '@/shared/domain/operationalPhase';
import { resolvePhaseFromConfig } from '@/features/operationFlow/domain/phaseConfigBridge';
import { useOperationFlowConfig } from '@/features/operationFlow/hooks/useOperationFlowConfig';
import { resolvePhase, type DayPhase } from '../lib/resolvePhase';

export { type DayPhase } from '../lib/resolvePhase';
export { type OperationalPhase } from '@/shared/domain/operationalPhase';

/** useCurrentPhase の戻り値（後方互換 + OperationalPhase 拡張） */
export type CurrentPhaseResult = {
  /** Legacy 3分割フェーズ（morning / midday / evening） */
  dayPhase: DayPhase;
  /** 共通6分割フェーズ（OperationalPhase） */
  operationalPhase: OperationalPhase;
  /** OperationalPhase の日本語ラベル */
  phaseLabel: string;
  /** 現フェーズの主役画面パス */
  primaryScreen: PrimaryScreen;
  /** /today が主役の時間帯かどうか */
  isTodayPrimary: boolean;
  /** 設定値から判定できたか（false = レガシーフォールバック） */
  fromConfig: boolean;
};

/**
 * 互換API: DayPhase のみを返す（既存コード向け）
 */
export function useCurrentPhase(): DayPhase {
  const now = new Date();
  return resolvePhase(now.getHours());
}

/**
 * 拡張API: DayPhase + OperationalPhase を返す
 *
 * 設定配列が読み込まれていれば設定値ベースで判定し、
 * 未ロード/エラー時は旧ハードコード判定にフォールバック。
 */
export function useCurrentPhaseExtended(): CurrentPhaseResult {
  const { config } = useOperationFlowConfig();
  const now = new Date();
  const dayPhase = resolvePhase(now.getHours());

  const resolved = resolvePhaseFromConfig(now, config);

  return {
    dayPhase,
    operationalPhase: resolved.operationalPhase,
    phaseLabel: resolved.phaseLabel,
    primaryScreen: resolved.legacyPrimaryScreen,
    isTodayPrimary: resolved.isTodayPrimary,
    fromConfig: resolved.fromConfig,
  };
}
