/**
 * phaseConfigBridge — 9分割設定値を既存6分割 OperationalPhase に橋渡し
 *
 * 目的:
 *   - getCurrentPhaseFromConfig() が返す OperationFlowPhaseKey (9分割) を
 *     既存コードが期待する OperationalPhase (6分割) にマッピングする
 *   - 設定配列から primaryScreen を取得する
 *   - 既存フェーズラベルも設定値ベースに切り替えられる
 *
 * 設計方針:
 *   - 旧 OperationalPhase 型を完全に残し、下流を壊さない
 *   - 設定未ロード時のフォールバックはこのモジュール外で保証する
 *
 * @module features/operationFlow/domain/phaseConfigBridge
 */

import type { OperationalPhase, PrimaryScreen as LegacyPrimaryScreen } from '@/shared/domain/operationalPhase';
import { getCurrentPhase as getLegacyPhase, getPhaseLabel as getLegacyLabel, getPrimaryScreen as getLegacyPrimaryScreen } from '@/shared/domain/operationalPhase';
import { getCurrentPhaseFromConfig, getPhaseConfig } from './getCurrentPhaseFromConfig';
import type { OperationFlowPhaseConfig, OperationFlowPhaseKey, PrimaryScreen as ConfigPrimaryScreen } from './operationFlowTypes';

// ────────────────────────────────────────
// 9分割 → 6分割 マッピング
// ────────────────────────────────────────

/**
 * 9分割キーを旧6分割 OperationalPhase にマッピングする
 *
 * マッピング根拠 (operationFlowTypes.ts のコメントと同一):
 *   staff_prep          → preparation
 *   morning_briefing    → morning-meeting
 *   arrival_intake      → am-operation
 *   am_activity         → am-operation
 *   pm_activity         → pm-operation
 *   departure_support   → evening-closing
 *   record_wrapup       → record-review
 *   evening_briefing    → record-review
 *   after_hours_review  → record-review
 */
const PHASE_KEY_TO_LEGACY: Record<OperationFlowPhaseKey, OperationalPhase> = {
  staff_prep:         'preparation',
  morning_briefing:   'morning-meeting',
  arrival_intake:     'am-operation',
  am_activity:        'am-operation',
  pm_activity:        'pm-operation',
  departure_support:  'evening-closing',
  record_wrapup:      'record-review',
  evening_briefing:   'record-review',
  after_hours_review: 'record-review',
};

export function toLegacyPhase(key: OperationFlowPhaseKey): OperationalPhase {
  return PHASE_KEY_TO_LEGACY[key];
}

// ────────────────────────────────────────
// 設定ベース PrimaryScreen → Legacy PrimaryScreen 変換
// ────────────────────────────────────────

/**
 * 設定値の PrimaryScreen を旧 PrimaryScreen 型に変換
 *
 * 9分割では /daily/attendance が存在するが、旧型にはないので /daily にマッピング
 */
export function toLegacyPrimaryScreen(screen: ConfigPrimaryScreen): LegacyPrimaryScreen {
  if (screen === '/daily/attendance') return '/daily';
  return screen as LegacyPrimaryScreen;
}

// ────────────────────────────────────────
// 統合判定 API
// ────────────────────────────────────────

export interface ConfigBasedPhaseResult {
  /** 旧6分割フェーズ（UI互換用） */
  operationalPhase: OperationalPhase;
  /** 旧6分割のラベル */
  phaseLabel: string;
  /** 旧 PrimaryScreen（/today | /daily | /handoff-timeline | /dashboard） */
  legacyPrimaryScreen: LegacyPrimaryScreen;
  /** 設定値ベースの PrimaryScreen（/daily/attendance を含む） */
  configPrimaryScreen: ConfigPrimaryScreen;
  /** 設定値ベースのラベル */
  configLabel: string;
  /** /today が主役の時間帯かどうか */
  isTodayPrimary: boolean;
  /** 設定値から判定できたかどうか (false = レガシーフォールバック) */
  fromConfig: boolean;
}

/**
 * 設定配列から現在フェーズを判定し、旧6分割互換の結果を返す
 *
 * 設定からフェーズが特定できない場合（設定穴・深夜帯など）は
 * 旧 getCurrentPhase() にフォールバックする。
 *
 * @param now    - 判定対象時刻
 * @param config - フェーズ設定配列
 * @returns 旧互換 + 設定値ベースの複合結果
 */
export function resolvePhaseFromConfig(
  now: Date,
  config: readonly OperationFlowPhaseConfig[],
): ConfigBasedPhaseResult {
  const phaseKey = getCurrentPhaseFromConfig(now, config);

  if (phaseKey != null) {
    const phaseConfig = getPhaseConfig(phaseKey, config);
    const operationalPhase = toLegacyPhase(phaseKey);
    const phaseLabel = getLegacyLabel(operationalPhase);
    const configPrimaryScreen = phaseConfig?.primaryScreen ?? '/today';
    const legacyPrimaryScreen = toLegacyPrimaryScreen(configPrimaryScreen);
    const configLabel = phaseConfig?.label ?? phaseLabel;

    return {
      operationalPhase,
      phaseLabel,
      legacyPrimaryScreen,
      configPrimaryScreen,
      configLabel,
      isTodayPrimary: legacyPrimaryScreen === '/today',
      fromConfig: true,
    };
  }

  // フォールバック: 旧ロジック
  const legacyPhase = getLegacyPhase(now);
  const legacyLabel = getLegacyLabel(legacyPhase);
  const legacyScreen = getLegacyPrimaryScreen(legacyPhase);

  return {
    operationalPhase: legacyPhase,
    phaseLabel: legacyLabel,
    legacyPrimaryScreen: legacyScreen,
    configPrimaryScreen: legacyScreen,
    configLabel: legacyLabel,
    isTodayPrimary: legacyScreen === '/today',
    fromConfig: false,
  };
}
