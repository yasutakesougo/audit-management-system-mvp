/**
 * 重度障害者支援加算 — 監査 finding 生成
 *
 * Phase 1/2 で実装した判定ロジックを利用して、RegulatoryDashboard 用の
 * AuditFinding を生成する。
 *
 * ## 生成する finding 種別
 *
 * | 種別                                  | 重要度 | 意味                                         |
 * |---------------------------------------|--------|----------------------------------------------|
 * | `severe_addon_tier2_candidate`        | low    | 加算（Ⅱ）候補（算定できる可能性あり）        |
 * | `severe_addon_tier3_candidate`        | low    | 加算（Ⅲ）候補                                |
 * | `basic_training_ratio_insufficient`   | medium | 基礎研修修了者比率 20% 未満                  |
 * | `planning_sheet_reassessment_overdue` | high   | 支援計画シートの3か月再評価超過              |
 * | `weekly_observation_shortage`         | medium | 週次観察が不足している                        |
 * | `authoring_requirement_unmet`         | high   | 支援計画シート作成者が実践研修未修了          |
 * | `assignment_without_required_qualification` | medium | 加算対象者に必要資格のない職員が配置     |
 *
 * @see severeDisabilityAddon.ts — 判定ロジック
 * @see planningSheetReassessment.ts — 再評価型
 */

import {
  checkUserEligibility,
  checkBasicTrainingRatio,
  type UserEligibilityResult,
} from './severeDisabilityAddon';
import {
  isQuarterlyReassessmentOverdue,
  DEFAULT_REASSESSMENT_CYCLE_DAYS,
} from '@/domain/isp/planningSheetReassessment';
import type { AuditFindingDomain } from './auditChecks';

// ─────────────────────────────────────────────
// 加算系 AuditFinding 型
// ─────────────────────────────────────────────

/**
 * 加算系の finding 種別
 *
 * 既存の `AuditFindingType` に対して「追加」として扱う。
 * 型を union するか、string literal で拡張する。
 */
export type SevereAddonFindingType =
  | 'severe_addon_tier2_candidate'
  | 'severe_addon_tier3_candidate'
  | 'basic_training_ratio_insufficient'
  | 'planning_sheet_reassessment_overdue'
  | 'weekly_observation_shortage'
  | 'authoring_requirement_unmet'
  | 'assignment_without_required_qualification';

export const SEVERE_ADDON_FINDING_TYPE_LABELS: Record<SevereAddonFindingType, string> = {
  severe_addon_tier2_candidate: '加算（Ⅱ）候補',
  severe_addon_tier3_candidate: '加算（Ⅲ）候補',
  basic_training_ratio_insufficient: '基礎研修比率不足',
  planning_sheet_reassessment_overdue: '再評価超過',
  weekly_observation_shortage: '週次観察不足',
  authoring_requirement_unmet: '作成者要件不備',
  assignment_without_required_qualification: '資格なし配置',
} as const;

export type SevereAddonFindingSeverity = 'high' | 'medium' | 'low';

export interface SevereAddonFinding {
  id: string;
  type: SevereAddonFindingType;
  severity: SevereAddonFindingSeverity;
  domain: AuditFindingDomain;
  userId: string;
  userName?: string;
  planningSheetId?: string;
  message: string;
  overdueDays?: number;
  dueDate?: string;
  detectedAt: string;
}

// ─────────────────────────────────────────────
// サマリー型
// ─────────────────────────────────────────────

export interface SevereAddonSummary {
  /** 加算（Ⅱ）候補の利用者数 */
  tier2CandidateCount: number;
  /** 加算（Ⅲ）候補の利用者数 */
  tier3CandidateCount: number;
  /** 上位区分候補の利用者数 */
  upperTierCandidateCount: number;
  /** 基礎研修比率不足件数 */
  trainingRatioInsufficientCount: number;
  /** 週次観察不足件数 */
  weeklyObservationShortageCount: number;
  /** 3か月再評価超過件数 */
  reassessmentOverdueCount: number;
  /** 作成者要件不備件数 */
  authoringRequirementUnmetCount: number;
  /** 資格なし配置件数 */
  assignmentWithoutQualificationCount: number;
  /** 全 finding 数 */
  totalFindings: number;
  /** 領域ごとの集計 */
  byDomain: Record<AuditFindingDomain, number>;
}

// ─────────────────────────────────────────────
// 入力型
// ─────────────────────────────────────────────

/** 加算判定に必要な利用者単位の入力 */
export interface SevereAddonCheckInput {
  userId: string;
  userName?: string;
  /** 障害支援区分（"1"〜"6"） */
  supportLevel: string | null;
  /** 行動関連項目合計点 */
  behaviorScore: number | null;
  /** 支援計画シート ID（複数可） */
  planningSheetIds: string[];
}

/** 事業所全体の入力 */
export interface SevereAddonBulkInput {
  /** 対象利用者一覧 */
  users: SevereAddonCheckInput[];
  /** 生活支援員の実人数 */
  totalLifeSupportStaff: number;
  /** 基礎研修修了者数 */
  basicTrainingCompletedCount: number;
  /** 週次観察が実施されていない利用者 ID 一覧 */
  usersWithoutWeeklyObservation: string[];
  /** 最終再評価日マップ（userId → lastReassessmentAt） */
  lastReassessmentMap: Map<string, string | null>;
  /** 支援計画シート作成者が実践研修未修了の利用者 ID 一覧 */
  usersWithoutAuthoringQualification?: string[];
  /** 加算対象者に必要資格のない職員が配置されている利用者 ID 一覧 */
  usersWithoutAssignmentQualification?: string[];
  /** 基準日 */
  today: string;
  /** 再評価周期（省略時は90日） */
  reassessmentCycleDays?: number;
}

// ─────────────────────────────────────────────
// Finding 生成
// ─────────────────────────────────────────────

let _addonFindingCounter = 0;
function nextAddonFindingId(): string {
  _addonFindingCounter += 1;
  return `addon-finding-${_addonFindingCounter}`;
}

/** テスト用カウンタリセット */
export function _resetAddonFindingCounter(): void {
  _addonFindingCounter = 0;
}

/**
 * 事業所全体の加算系 findings を生成する
 */
export function buildSevereAddonFindings(input: SevereAddonBulkInput): SevereAddonFinding[] {
  const {
    users,
    totalLifeSupportStaff,
    basicTrainingCompletedCount,
    usersWithoutWeeklyObservation,
    lastReassessmentMap,
    usersWithoutAuthoringQualification = [],
    usersWithoutAssignmentQualification = [],
    today,
    reassessmentCycleDays = DEFAULT_REASSESSMENT_CYCLE_DAYS,
  } = input;

  const findings: SevereAddonFinding[] = [];

  // 1. 基礎研修比率チェック（事業所全体で1回）
  const ratioResult = checkBasicTrainingRatio(totalLifeSupportStaff, basicTrainingCompletedCount);
  if (!ratioResult.fulfilled) {
    findings.push({
      id: nextAddonFindingId(),
      type: 'basic_training_ratio_insufficient',
      severity: 'medium',
      domain: 'sheet',
      userId: '__facility__',
      message: `基礎研修修了比率 ${(ratioResult.ratio * 100).toFixed(1)}%（${basicTrainingCompletedCount}/${totalLifeSupportStaff}人）— 20%以上が必要`,
      detectedAt: today,
    });
  }

  // 2. 利用者ごとのチェック
  for (const user of users) {
    const eligibility = checkUserEligibility(user.supportLevel, user.behaviorScore);

    // 加算候補
    if (eligibility.tier2) {
      findings.push({
        id: nextAddonFindingId(),
        type: 'severe_addon_tier2_candidate',
        severity: 'low',
        domain: 'sheet',
        userId: user.userId,
        userName: user.userName,
        message: `加算（Ⅱ）候補: 区分${user.supportLevel}・行動${user.behaviorScore}点${eligibility.isUpperTier ? '（上位区分）' : ''}`,
        detectedAt: today,
      });
    } else if (eligibility.tier3) {
      findings.push({
        id: nextAddonFindingId(),
        type: 'severe_addon_tier3_candidate',
        severity: 'low',
        domain: 'sheet',
        userId: user.userId,
        userName: user.userName,
        message: `加算（Ⅲ）候補: 区分${user.supportLevel}・行動${user.behaviorScore}点${eligibility.isUpperTier ? '（上位区分）' : ''}`,
        detectedAt: today,
      });
    }

    // 候補でない利用者はそれ以降のチェック不要
    if (!eligibility.tier2 && !eligibility.tier3) continue;

    // 3. 週次観察不足
    if (usersWithoutWeeklyObservation.includes(user.userId)) {
      findings.push({
        id: nextAddonFindingId(),
        type: 'weekly_observation_shortage',
        severity: 'medium',
        domain: 'sheet',
        userId: user.userId,
        userName: user.userName,
        message: `週次観察が不足しています（原則 週1回以上の観察が必要）`,
        detectedAt: today,
      });
    }

    // 4. 3か月再評価超過
    const lastReassessmentAt = lastReassessmentMap.get(user.userId) ?? null;
    const reassessmentResult = isQuarterlyReassessmentOverdue(
      lastReassessmentAt,
      reassessmentCycleDays,
      today,
    );

    if (reassessmentResult.overdue) {
      const daysSinceMessage = reassessmentResult.daysSince !== null
        ? `最終再評価から${reassessmentResult.daysSince}日経過`
        : '再評価未実施';

      findings.push({
        id: nextAddonFindingId(),
        type: 'planning_sheet_reassessment_overdue',
        severity: 'high',
        domain: 'sheet',
        userId: user.userId,
        userName: user.userName,
        message: `支援計画シートの3か月再評価が超過: ${daysSinceMessage}`,
        overdueDays: reassessmentResult.daysSince
          ? -(reassessmentResult.daysSince - reassessmentCycleDays)
          : undefined,
        detectedAt: today,
      });
    }

    // 5. 作成者要件不備
    if (usersWithoutAuthoringQualification.includes(user.userId)) {
      findings.push({
        id: nextAddonFindingId(),
        type: 'authoring_requirement_unmet',
        severity: 'high',
        domain: 'sheet',
        userId: user.userId,
        userName: user.userName,
        message: `支援計画シート作成者が実践研修未修了です`,
        detectedAt: today,
        planningSheetId: user.planningSheetIds[0],
      });
    }

    // 6. 資格なし配置
    if (usersWithoutAssignmentQualification.includes(user.userId)) {
      findings.push({
        id: nextAddonFindingId(),
        type: 'assignment_without_required_qualification',
        severity: 'medium',
        domain: 'sheet',
        userId: user.userId,
        userName: user.userName,
        message: `加算対象者に必要資格のない職員が配置されています`,
        detectedAt: today,
      });
    }
  }

  return findings;
}

/**
 * 加算系 findings のサマリーを生成する
 */
export function summarizeSevereAddonFindings(
  findings: SevereAddonFinding[],
  eligibilityResults?: Map<string, UserEligibilityResult>,
): SevereAddonSummary {
  let tier2CandidateCount = 0;
  let tier3CandidateCount = 0;
  let upperTierCandidateCount = 0;
  let trainingRatioInsufficientCount = 0;
  let weeklyObservationShortageCount = 0;
  let reassessmentOverdueCount = 0;
  let authoringRequirementUnmetCount = 0;
  let assignmentWithoutQualificationCount = 0;

  for (const f of findings) {
    switch (f.type) {
      case 'severe_addon_tier2_candidate':
        tier2CandidateCount++;
        break;
      case 'severe_addon_tier3_candidate':
        tier3CandidateCount++;
        break;
      case 'basic_training_ratio_insufficient':
        trainingRatioInsufficientCount++;
        break;
      case 'planning_sheet_reassessment_overdue':
        reassessmentOverdueCount++;
        break;
      case 'weekly_observation_shortage':
        weeklyObservationShortageCount++;
        break;
      case 'authoring_requirement_unmet':
        authoringRequirementUnmetCount++;
        break;
      case 'assignment_without_required_qualification':
        assignmentWithoutQualificationCount++;
        break;
    }
  }

  // 上位区分は findings からメッセージ解析するよりも、結果マップがあれば使う
  if (eligibilityResults) {
    for (const r of eligibilityResults.values()) {
      if (r.isUpperTier && (r.tier2 || r.tier3)) upperTierCandidateCount++;
    }
  }

  return {
    tier2CandidateCount,
    tier3CandidateCount,
    upperTierCandidateCount,
    trainingRatioInsufficientCount,
    weeklyObservationShortageCount,
    reassessmentOverdueCount,
    authoringRequirementUnmetCount,
    assignmentWithoutQualificationCount,
    totalFindings: findings.length,
    byDomain: {
      isp: 0,
      sheet: findings.length,
    },
  };
}
