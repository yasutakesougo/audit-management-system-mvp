// ---------------------------------------------------------------------------
// safetyLevel.ts — 安全管理の総合レベル判定
//
// useSafetyOperationsSummary.ts から切り出した純関数。
// 5つのサマリを受け取り「overallLevel」と「actionRequiredCount」を算出する。
//
// 判定ルール（優先順位 critical > warning > good）:
//   critical:
//     - インシデントの未対応フォローアップ > 0
//     - 身体拘束の未承認件数 > 0
//     - 身体拘束の三要件未充足件数 > 0
//   warning:
//     - 委員会の四半期要件未達（年4回未満）
//     - 指針の必須項目未充足
//     - 研修の年2回要件未達
//   good:
//     - すべての critical / warning 条件が false
//
// 法的根拠:
//   - 身体拘束等適正化のための指針（厚労省通知）
//   - 指定障害福祉サービス基準省令 (年4回委員会・年2回研修)
// ---------------------------------------------------------------------------

import type { IncidentSummary } from '@/domain/support/incidentRepository';
import type { RestraintSummary } from '@/domain/safety/physicalRestraint';
import type { CommitteeSummary } from '@/domain/safety/complianceCommittee';
import type { GuidelineSummary } from '@/domain/safety/guidelineVersion';
import type { TrainingSummary } from '@/domain/safety/trainingRecord';

export type OverallLevel = 'good' | 'warning' | 'critical';

export type SafetyLevelInput = {
  incident: Pick<IncidentSummary, 'pendingFollowUp'>;
  restraint: Pick<RestraintSummary, 'pendingApproval' | 'incompleteRequirements'>;
  committee: Pick<CommitteeSummary, 'meetsQuarterlyRequirement'>;
  guideline: Pick<GuidelineSummary, 'allItemsFulfilled'>;
  training: Pick<TrainingSummary, 'meetsBiannualRequirement'>;
};

/**
 * 5つのサマリから全体の適正化レベルを算出する。
 *
 * critical が warning より優先される。
 * いずれの条件も false なら 'good' を返す。
 */
export function computeOverallLevel(input: SafetyLevelInput): OverallLevel {
  const hasCritical =
    input.incident.pendingFollowUp > 0 ||
    input.restraint.pendingApproval > 0 ||
    input.restraint.incompleteRequirements > 0;

  if (hasCritical) return 'critical';

  const hasWarning =
    !input.committee.meetsQuarterlyRequirement ||
    !input.guideline.allItemsFulfilled ||
    !input.training.meetsBiannualRequirement;

  if (hasWarning) return 'warning';

  return 'good';
}

/**
 * 要対応事項の総数を算出する。
 *
 * - 委員会要件未達: +1
 * - 指針必須項目未充足: +1
 * - 研修要件未達: +1
 * - 身体拘束 未承認件数: 件数分加算
 * - 身体拘束 三要件未充足: 件数分加算
 * - インシデント 未対応フォローアップ: 件数分加算
 */
export function computeActionRequiredCount(input: SafetyLevelInput): number {
  let count = 0;
  if (!input.committee.meetsQuarterlyRequirement) count++;
  if (!input.guideline.allItemsFulfilled) count++;
  if (!input.training.meetsBiannualRequirement) count++;
  count += input.restraint.pendingApproval;
  count += input.restraint.incompleteRequirements;
  count += input.incident.pendingFollowUp;
  return count;
}
