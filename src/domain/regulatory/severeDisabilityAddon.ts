/**
 * 重度障害者支援加算（Ⅱ）（Ⅲ）— 判定ロジック
 *
 * 生活介護における重度障害者支援加算の判定を pure functions で記述する。
 * 外部状態に依存しないため、単体テストで完全にカバーできる。
 *
 * ## 判定構造
 *
 * ```
 * Tier2: 障害支援区分 ≥ 6 かつ 行動関連項目 ≥ 10
 * Tier3: 障害支援区分 ≥ 4 かつ 行動関連項目 ≥ 10
 *
 * SubTier:
 *   basic: 行動関連項目 10〜17
 *   upper: 行動関連項目 ≥ 18
 * ```
 *
 * @see docs/design/severe-disability-addon-design.md
 * @see src/domain/regulatory/staffQualificationProfile.ts
 * @see src/domain/regulatory/userRegulatoryProfile.ts
 */
import type { StaffQualificationProfile } from './staffQualificationProfile';

// ─────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────

/** 加算 Tier 判定に使用する定数 */
export const ADDON_THRESHOLDS = {
  /** 加算（Ⅱ）の最低障害支援区分 */
  TIER2_MIN_SUPPORT_LEVEL: 6,
  /** 加算（Ⅲ）の最低障害支援区分 */
  TIER3_MIN_SUPPORT_LEVEL: 4,
  /** 基本要件の行動関連項目最低点 */
  MIN_BEHAVIOR_SCORE: 10,
  /** 上位区分の行動関連項目最低点 */
  UPPER_TIER_BEHAVIOR_SCORE: 18,
  /** 基礎研修修了者の最低比率 */
  BASIC_TRAINING_MIN_RATIO: 0.20,
  /** 3か月見直しの最大日数 */
  QUARTERLY_REVIEW_MAX_DAYS: 90,
} as const;

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

/** 加算 Tier */
export type AddOnTier = 'tier2' | 'tier3';

/** Sub-tier: 基本 / 上位 */
export type SubTier = 'basic' | 'upper';

/** 利用者の加算適格判定結果 */
export interface UserEligibilityResult {
  /** 加算（Ⅱ）の対象か */
  tier2: boolean;
  /** 加算（Ⅲ）の対象か（区分4以上） */
  tier3: boolean;
  /** 上位区分（行動関連項目18点以上）か */
  isUpperTier: boolean;
}

/** 基礎研修比率判定結果 */
export interface BasicTrainingRatioResult {
  /** 比率（0.0 〜 1.0） */
  ratio: number;
  /** 20% 以上を充足しているか */
  fulfilled: boolean;
}

/** 作成者要件判定結果 */
export interface AuthoringRequirementResult {
  /** 要件を充足しているか */
  fulfilled: boolean;
  /** 判定理由 */
  reason: string;
}

/** 加算判定の包括結果 */
export interface AddOnEligibilityResult {
  /** 判定対象の加算 Tier */
  tier: AddOnTier;
  /** 判定対象の Sub-tier */
  subTier: SubTier;
  /** 加算を算定できるか */
  eligible: boolean;
  /** 個別要件の充足状況 */
  checks: {
    /** 利用者対象要件 */
    userEligibility: boolean;
    /** 基礎研修比率 */
    basicTrainingRatio: BasicTrainingRatioResult;
    /** 作成者要件 */
    authoringRequirement: AuthoringRequirementResult;
    /** 週次観察 */
    weeklyObservation: boolean;
    /** 3か月見直し */
    quarterlyReview: boolean;
  };
  /** 未充足の項目一覧 */
  unmetRequirements: string[];
}

// ─────────────────────────────────────────────
// 判定関数
// ─────────────────────────────────────────────

/**
 * 対象利用者の加算適格判定
 *
 * @param supportLevel 障害支援区分（文字列 "1"〜"6"）
 * @param behaviorScore 行動関連項目合計点
 */
export function checkUserEligibility(
  supportLevel: string | null | undefined,
  behaviorScore: number | null | undefined,
): UserEligibilityResult {
  const level = parseSupportLevel(supportLevel);
  const score = behaviorScore ?? 0;

  const meetsScore = score >= ADDON_THRESHOLDS.MIN_BEHAVIOR_SCORE;

  return {
    tier2: meetsScore && level >= ADDON_THRESHOLDS.TIER2_MIN_SUPPORT_LEVEL,
    tier3: meetsScore && level >= ADDON_THRESHOLDS.TIER3_MIN_SUPPORT_LEVEL,
    isUpperTier: score >= ADDON_THRESHOLDS.UPPER_TIER_BEHAVIOR_SCORE,
  };
}

/**
 * 基礎研修修了者比率の判定
 *
 * **重要**: 実人数で算出する。常勤換算ではない。非常勤も含む。
 *
 * @param totalLifeSupportStaff 生活支援員の実人数（常勤+非常勤）
 * @param basicTrainingCompletedCount 基礎研修修了者数
 */
export function checkBasicTrainingRatio(
  totalLifeSupportStaff: number,
  basicTrainingCompletedCount: number,
): BasicTrainingRatioResult {
  if (totalLifeSupportStaff <= 0) {
    return { ratio: 0, fulfilled: false };
  }

  const ratio = basicTrainingCompletedCount / totalLifeSupportStaff;

  return {
    ratio,
    fulfilled: ratio >= ADDON_THRESHOLDS.BASIC_TRAINING_MIN_RATIO,
  };
}

/**
 * 支援計画シート作成者要件の判定
 *
 * - basic (基本): 実践研修修了者 が作成
 * - upper (上位): 中核的人材修了者、
 *   または中核的人材から助言・指導を受けた実践研修修了者が作成
 *
 * @param subTier 基本 or 上位
 * @param authorProfile 作成者の資格プロファイル
 * @param hasCorePersonAdvice 中核的人材から助言を受けたか
 *
 * @remarks
 * 将来拡張: `adviceSourceObservationId?: string` で助言記録の参照元を
 * 保持する余地あり。P4 の WeeklyObservationRecord と接続予定。
 */
export function checkAuthoringRequirement(
  subTier: SubTier,
  authorProfile: StaffQualificationProfile,
  hasCorePersonAdvice: boolean,
  // 将来: adviceSourceObservationId?: string
): AuthoringRequirementResult {
  // 中核的人材は basic / upper どちらでもOK
  if (authorProfile.hasCorePersonTraining) {
    return {
      fulfilled: true,
      reason: '中核的人材養成研修修了者が作成',
    };
  }

  if (subTier === 'basic') {
    // 基本区分: 実践研修修了者であればOK
    if (authorProfile.hasPracticalTraining) {
      return {
        fulfilled: true,
        reason: '実践研修修了者が作成（基本区分）',
      };
    }
    return {
      fulfilled: false,
      reason: '作成者が実践研修を未修了（基本区分には実践研修修了が必要）',
    };
  }

  // 上位区分: 中核的人材の助言を受けた実践研修修了者
  if (authorProfile.hasPracticalTraining && hasCorePersonAdvice) {
    return {
      fulfilled: true,
      reason: '中核的人材の助言を受けた実践研修修了者が作成（上位区分）',
    };
  }

  if (authorProfile.hasPracticalTraining && !hasCorePersonAdvice) {
    return {
      fulfilled: false,
      reason: '実践研修修了者だが中核的人材の助言未受領（上位区分には助言が必要）',
    };
  }

  return {
    fulfilled: false,
    reason: '作成者の資格要件を満たさない（上位区分には中核的人材または助言を受けた実践研修修了者が必要）',
  };
}

/**
 * 3か月見直しの充足判定
 *
 * **供給元**: `PlanningSheetReassessment.reassessedAt`（支援計画シート再評価の実施日）
 *
 * ⚠️ ISP の `MonitoringRecord.monitoringDate` を使ってはならない。
 * ISP モニタリングと支援計画シート再評価は目的・周期が異なるため、
 * 別記録として管理する。
 *
 * @param lastReviewDate 最終再評価日（ISO 8601）— PlanningSheetReassessment.reassessedAt
 * @param referenceDate 判定基準日（ISO 8601）。省略時は現在日。
 *
 * @see src/domain/isp/planningSheetReassessment.ts — PlanningSheetReassessment
 * @see src/domain/isp/types.ts — MonitoringRecord（ISP側。こちらは使わない）
 */
export function checkQuarterlyReview(
  lastReviewDate: string | null | undefined,
  referenceDate?: string,
): { fulfilled: boolean; daysSinceLastReview: number | null } {
  if (!lastReviewDate) {
    return { fulfilled: false, daysSinceLastReview: null };
  }

  const last = new Date(lastReviewDate);
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const diffMs = ref.getTime() - last.getTime();
  const daysSinceLastReview = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    fulfilled: daysSinceLastReview <= ADDON_THRESHOLDS.QUARTERLY_REVIEW_MAX_DAYS,
    daysSinceLastReview,
  };
}

/**
 * 包括的な加算判定
 *
 * 全要件を一括で判定し、充足/未充足を明示したレポートを返す。
 */
export function evaluateSevereDisabilityAddOn(params: {
  tier: AddOnTier;
  user: { supportLevel: string | null; behaviorScore: number | null };
  staffRatio: { total: number; basicTrainingCount: number };
  author: StaffQualificationProfile;
  hasCorePersonAdvice: boolean;
  weeklyObservationFulfilled: boolean;
  /** 最終再評価日 — PlanningSheetReassessment.reassessedAt から供給 */
  lastReviewDate: string | null;
  referenceDate?: string;
}): AddOnEligibilityResult {
  const {
    tier, user, staffRatio, author,
    hasCorePersonAdvice, weeklyObservationFulfilled,
    lastReviewDate, referenceDate,
  } = params;

  // 1) 利用者対象判定
  const eligibility = checkUserEligibility(user.supportLevel, user.behaviorScore);
  const userEligible = tier === 'tier2' ? eligibility.tier2 : eligibility.tier3;
  const subTier: SubTier = eligibility.isUpperTier ? 'upper' : 'basic';

  // 2) 基礎研修比率
  const ratioResult = checkBasicTrainingRatio(staffRatio.total, staffRatio.basicTrainingCount);

  // 3) 作成者要件
  const authorResult = checkAuthoringRequirement(subTier, author, hasCorePersonAdvice);

  // 4) 3か月見直し
  const reviewResult = checkQuarterlyReview(lastReviewDate, referenceDate);

  // 未充足要件の収集
  const unmetRequirements: string[] = [];
  if (!userEligible) unmetRequirements.push('対象利用者要件');
  if (!ratioResult.fulfilled) unmetRequirements.push('基礎研修修了者比率（20%以上）');
  if (!authorResult.fulfilled) unmetRequirements.push(`作成者要件: ${authorResult.reason}`);
  if (!weeklyObservationFulfilled) unmetRequirements.push('週次観察（週1回以上）');
  if (!reviewResult.fulfilled) unmetRequirements.push('3か月見直し');

  return {
    tier,
    subTier,
    eligible: unmetRequirements.length === 0,
    checks: {
      userEligibility: userEligible,
      basicTrainingRatio: ratioResult,
      authoringRequirement: authorResult,
      weeklyObservation: weeklyObservationFulfilled,
      quarterlyReview: reviewResult.fulfilled,
    },
    unmetRequirements,
  };
}

// ─────────────────────────────────────────────
// 内部ヘルパー
// ─────────────────────────────────────────────

/**
 * 障害支援区分（文字列）を数値に変換する
 * 無効値は 0 を返す（どの要件も満たさない）
 */
function parseSupportLevel(level: string | null | undefined): number {
  if (level == null) return 0;
  const num = parseInt(level, 10);
  return isNaN(num) ? 0 : num;
}
