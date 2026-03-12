/**
 * buildFindingActionUrl — 監査 finding から遷移先 URL を解決する
 *
 * finding の type に応じて最適な遷移先を返す。
 *
 * 遷移マッピング:
 *   planning_sheet_missing     → /support-plan-guide (支援計画シート作成)
 *   author_qualification_missing → /support-plan-guide (作成者資格確認)
 *   review_overdue             → /support-plan-guide (見直し)
 *   procedure_record_gap       → /daily/support (実施記録入力)
 *   delivery_missing           → /support-plan-guide (交付実施)
 *   add_on_candidate           → /admin/regulatory-dashboard (加算確認)
 */
import type { AuditFinding } from '@/domain/regulatory';
import { buildDailySupportUrl } from '@/app/links/buildDailySupportUrl';

export type FindingAction = {
  label: string;
  url: string;
  /** アクションの種類 */
  kind: 'plan' | 'execute' | 'review';
};

/**
 * finding に対応するアクション導線を返す。
 * 単一の finding に対して複数のアクションを返すこともある。
 */
export function buildFindingActions(finding: AuditFinding): FindingAction[] {
  const actions: FindingAction[] = [];
  const userId = finding.userId;

  switch (finding.type) {
    case 'planning_sheet_missing':
      actions.push({
        label: '支援計画を作成',
        url: `/support-plan-guide?userId=${encodeURIComponent(userId)}`,
        kind: 'plan',
      });
      break;

    case 'author_qualification_missing':
      if (finding.planningSheetId) {
        actions.push({
          label: '支援計画を確認',
          url: `/support-plan-guide?userId=${encodeURIComponent(userId)}`,
          kind: 'review',
        });
      }
      break;

    case 'review_overdue':
      actions.push({
        label: '見直しを開始',
        url: `/support-plan-guide?userId=${encodeURIComponent(userId)}`,
        kind: 'review',
      });
      break;

    case 'procedure_record_gap':
      actions.push({
        label: '時間割を開く',
        url: buildDailySupportUrl(userId, finding.planningSheetId),
        kind: 'execute',
      });
      actions.push({
        label: '支援計画を確認',
        url: `/support-plan-guide?userId=${encodeURIComponent(userId)}`,
        kind: 'plan',
      });
      break;

    case 'delivery_missing':
      actions.push({
        label: '支援計画を確認',
        url: `/support-plan-guide?userId=${encodeURIComponent(userId)}`,
        kind: 'review',
      });
      break;

    case 'add_on_candidate':
      actions.push({
        label: '支援計画を確認',
        url: `/support-plan-guide?userId=${encodeURIComponent(userId)}`,
        kind: 'review',
      });
      break;
  }

  return actions;
}
