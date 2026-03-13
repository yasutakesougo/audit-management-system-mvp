/**
 * buildSevereAddonFindingActions — 加算系 finding の遷移先を解決する
 *
 * ## 遷移マッピング
 *
 * | finding type                          | 遷移先                                       |
 * |---------------------------------------|----------------------------------------------|
 * | severe_addon_tier2_candidate          | /support-plan-guide (支援計画確認)             |
 * | severe_addon_tier3_candidate          | /support-plan-guide (支援計画確認)             |
 * | basic_training_ratio_insufficient     | /regulatory/staff (職員資格管理)               |
 * | planning_sheet_reassessment_overdue   | /support-plan-guide (再評価) + 分析確認        |
 * | weekly_observation_shortage           | /support-plan-guide (週次観察) + 分析確認      |
 */

import type { SevereAddonFinding } from './severeAddonFindings';
import { buildIcebergPdcaUrl } from '@/app/links/navigationLinks';

export type AddonFindingActionKind = 'plan' | 'review' | 'evidence' | 'staff';

export interface AddonFindingAction {
  label: string;
  url: string;
  kind: AddonFindingActionKind;
}

/**
 * 加算系 finding に対応するアクション導線を返す
 */
export function buildSevereAddonFindingActions(finding: SevereAddonFinding): AddonFindingAction[] {
  const actions: AddonFindingAction[] = [];
  const userId = finding.userId;

  // 事業所全体の finding (__facility__) にはユーザー単位の遷移先はない
  const isFacilityLevel = userId === '__facility__';

  const supportPlanUrl = isFacilityLevel
    ? '/support-plan-guide'
    : `/support-plan-guide?userId=${encodeURIComponent(userId)}`;

  const icebergUrl = isFacilityLevel
    ? undefined
    : buildIcebergPdcaUrl(userId, { source: 'regulatory-addon' });

  switch (finding.type) {
    case 'severe_addon_tier2_candidate':
    case 'severe_addon_tier3_candidate':
      actions.push({
        label: '支援計画を確認',
        url: supportPlanUrl,
        kind: 'plan',
      });
      if (icebergUrl) {
        actions.push({
          label: '分析を確認',
          url: icebergUrl,
          kind: 'evidence',
        });
      }
      break;

    case 'basic_training_ratio_insufficient':
      actions.push({
        label: '職員資格を確認',
        url: '/regulatory/staff',
        kind: 'staff',
      });
      break;

    case 'planning_sheet_reassessment_overdue':
      actions.push({
        label: '再評価を開始',
        url: `${supportPlanUrl}&tab=reassessment`,
        kind: 'review',
      });
      if (icebergUrl) {
        actions.push({
          label: '分析を確認',
          url: icebergUrl,
          kind: 'evidence',
        });
      }
      break;

    case 'weekly_observation_shortage':
      actions.push({
        label: '観察記録を入力',
        url: `${supportPlanUrl}&tab=observation`,
        kind: 'review',
      });
      if (icebergUrl) {
        actions.push({
          label: '分析を確認',
          url: icebergUrl,
          kind: 'evidence',
        });
      }
      break;
  }

  return actions;
}
