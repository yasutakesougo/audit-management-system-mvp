// ---------------------------------------------------------------------------
// spsToAbcOptions — SPS手順書 → ABC入力選択肢 変換アダプタ
//
// SupportPlanSheet / SupportProcedureManual から
// 日次記録（daily/support）の入力UIに供給する選択肢を自動生成する。
// 純粋関数のため単体テストが容易。
// ---------------------------------------------------------------------------

import {
    COMMON_ANTECEDENT_TAGS,
    extractInterventionMethods,
    type SupportCategory,
    type SupportPlanSheet,
    type SupportProcedureManual,
    type SupportStrategyStage
} from '@/features/ibd/ibdTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ABCInputOptions {
  /** ABC先行事象の選択肢（IcebergModel + 共通プリセット） */
  antecedent: string[];
  /** ABC行動の選択肢（SPS場面別ターゲット行動） */
  behavior: string[];
  /** ABC結果事象の選択肢（手順書InterventionMethods由来） */
  consequence: string[];
}

export interface SPSDrivenOptions {
  /** 利用者別Mood選択肢（SPSのpositiveConditions由来 + デフォルト） */
  moodOptions: string[];
  /** ABC入力選択肢（SPS手順書由来） */
  abcOptions: ABCInputOptions;
  /** 支援段階ラベル（SPS手順書のSupportStrategyStage） */
  stageOptions: { value: SupportStrategyStage; label: string }[];
  /** カテゴリ別の色分け情報 */
  categoryHints: SupportCategory[];
}

// ---------------------------------------------------------------------------
// Default / Fallback Options
// ---------------------------------------------------------------------------

/** フォールバック用デフォルトMood選択肢 — SPSが無い利用者、またはSPS未接続時に使用 */
export const DEFAULT_MOOD_OPTIONS: readonly string[] = [
  '落ち着いている',
  '楽しそう',
  '集中している',
  '不安そう',
  'イライラ',
] as const;

/** フォールバック用デフォルトABC選択肢 — SPSが無い利用者に使用 */
export const DEFAULT_ABC_OPTIONS: ABCInputOptions = {
  antecedent: ['課題中', '要求があった', '感覚刺激', '他者との関わり'],
  behavior: ['大声を出す', '物を叩く', '自傷行為', '他害行為'],
  consequence: ['クールダウン', '要求に応えた', '無視(意図的)', '場所移動'],
} as const;

const DEFAULT_STAGE_OPTIONS: SPSDrivenOptions['stageOptions'] = [
  { value: 'proactive', label: '予防的支援' },
  { value: 'earlyResponse', label: '早期対応' },
  { value: 'crisisResponse', label: '危機対応' },
  { value: 'postCrisis', label: '事後対応' },
];

// ---------------------------------------------------------------------------
// Core: getDefaultAbcOptions
// ---------------------------------------------------------------------------

/**
 * SPS が存在しない利用者向けのデフォルト選択肢を返す。
 */
export function getDefaultSPSDrivenOptions(): SPSDrivenOptions {
  return {
    moodOptions: [...DEFAULT_MOOD_OPTIONS],
    abcOptions: { ...DEFAULT_ABC_OPTIONS },
    stageOptions: [...DEFAULT_STAGE_OPTIONS],
    categoryHints: [],
  };
}

// ---------------------------------------------------------------------------
// Core: buildAbcOptionsFromSPS
// ---------------------------------------------------------------------------

/**
 * SPS手順書 → ABC入力選択肢への変換。
 *
 * @param sps          支援計画シート（IcebergModel, positiveConditions を持つ）
 * @param manual       支援手順書（場面別手順を持つ）
 * @returns 利用者固有のABC入力選択肢
 *
 * 変換ロジック:
 *   - moodOptions: sps.positiveConditions を先頭に配置し、デフォルトの不足分を補完
 *   - antecedent: IcebergModel.observableBehaviors + COMMON_ANTECEDENT_TAGS（重複排除）
 *   - behavior:   手順書の全場面から personAction を抽出（重複排除）
 *   - consequence: extractInterventionMethods() で supporterAction を抽出（重複排除）
 *   - stageOptions: 手順書に含まれる supportStrategyStage のユニーク値
 *   - categoryHints: 手順書に含まれる supportCategory のユニーク値
 */
export function buildSPSDrivenOptions(
  sps: SupportPlanSheet,
  manual: SupportProcedureManual,
): SPSDrivenOptions {
  // --- Mood ---
  const moodSet = new Set<string>();
  // SPS positiveConditions を優先（最大5件）
  for (const cond of sps.positiveConditions.slice(0, 5)) {
    const trimmed = cond.trim();
    if (trimmed) moodSet.add(trimmed);
  }
  // デフォルトで補完（合計最大8件）
  for (const d of DEFAULT_MOOD_OPTIONS) {
    if (moodSet.size >= 8) break;
    moodSet.add(d);
  }

  // --- Antecedent (A) ---
  const antecedentSet = new Set<string>();
  // IcebergModel の表面行動 → 先行事象の手がかりとして使用
  for (const ob of sps.icebergModel.observableBehaviors) {
    const trimmed = ob.trim();
    if (trimmed) antecedentSet.add(trimmed);
  }
  // 共通プリセットで補完
  for (const tag of COMMON_ANTECEDENT_TAGS) {
    antecedentSet.add(tag);
  }

  // --- Behavior (B) ---
  const behaviorSet = new Set<string>();
  for (const scene of manual.scenes) {
    for (const step of scene.procedures) {
      const trimmed = step.personAction.trim();
      if (trimmed) behaviorSet.add(trimmed);
    }
  }
  // デフォルトで補完（SPSに手順がない場合のフォールバック）
  if (behaviorSet.size === 0) {
    DEFAULT_ABC_OPTIONS.behavior.forEach((b) => behaviorSet.add(b));
  }

  // --- Consequence (C) ---
  const interventions = extractInterventionMethods(manual.scenes);
  const consequenceSet = new Set<string>();
  for (const method of interventions) {
    const trimmed = method.label.trim();
    if (trimmed) consequenceSet.add(trimmed);
  }
  // デフォルトで補完
  if (consequenceSet.size === 0) {
    DEFAULT_ABC_OPTIONS.consequence.forEach((c) => consequenceSet.add(c));
  }

  // --- Stage Options ---
  const stageSet = new Set<SupportStrategyStage>();
  for (const scene of manual.scenes) {
    for (const step of scene.procedures) {
      stageSet.add(step.stage);
    }
  }
  const stageOptions: SPSDrivenOptions['stageOptions'] = stageSet.size > 0
    ? DEFAULT_STAGE_OPTIONS.filter((opt) => stageSet.has(opt.value))
    : [...DEFAULT_STAGE_OPTIONS];

  // --- Category Hints ---
  const categorySet = new Set<SupportCategory>();
  for (const method of interventions) {
    categorySet.add(method.category);
  }

  return {
    moodOptions: [...moodSet],
    abcOptions: {
      antecedent: [...antecedentSet],
      behavior: [...behaviorSet],
      consequence: [...consequenceSet],
    },
    stageOptions,
    categoryHints: [...categorySet],
  };
}

// ---------------------------------------------------------------------------
// Utility: mergeWithDefaults
// ---------------------------------------------------------------------------

/**
 * 部分的なSPSDrivenOptions をデフォルトで補完する。
 * SPS が一部のフィールドしか持たない場合に使用。
 */
export function mergeOptionsWithDefaults(
  partial: Partial<SPSDrivenOptions>,
): SPSDrivenOptions {
  const defaults = getDefaultSPSDrivenOptions();
  return {
    moodOptions: partial.moodOptions?.length ? partial.moodOptions : defaults.moodOptions,
    abcOptions: {
      antecedent: partial.abcOptions?.antecedent?.length
        ? partial.abcOptions.antecedent
        : defaults.abcOptions.antecedent,
      behavior: partial.abcOptions?.behavior?.length
        ? partial.abcOptions.behavior
        : defaults.abcOptions.behavior,
      consequence: partial.abcOptions?.consequence?.length
        ? partial.abcOptions.consequence
        : defaults.abcOptions.consequence,
    },
    stageOptions: partial.stageOptions?.length ? partial.stageOptions : defaults.stageOptions,
    categoryHints: partial.categoryHints ?? defaults.categoryHints,
  };
}
