/**
 * buildFindingActionUrl — 監査 finding から遷移先 URL を解決する
 *
 * finding の type に応じて最適な遷移先を返す。
 *
 * 遷移マッピング:
 *   planning_sheet_missing     → /support-plan-guide (支援計画シート作成)
 *   author_qualification_missing → /support-plan-guide (作成者資格確認)
 *   review_overdue             → /support-plan-guide (見直し)
 *                              → /analysis/iceberg-pdca (分析根拠)
 *   procedure_record_gap       → /daily/support (実施記録入力)
 *                              → /support-plan-guide (支援計画確認)
 *                              → /analysis/iceberg-pdca (分析根拠)
 *   delivery_missing           → /support-plan-guide (交付実施)
 *   add_on_candidate           → /support-plan-guide (加算確認)
 *                              → /analysis/iceberg-pdca (分析根拠)
 */
import type { AuditFinding } from '@/domain/regulatory';
import { buildDailySupportUrl } from '@/app/links/buildDailySupportUrl';
import { buildIcebergPdcaUrl } from '@/app/links/navigationLinks';

export type FindingActionKind = 'plan' | 'execute' | 'review' | 'evidence';

export type FindingAction = {
  label: string;
  url: string;
  /** アクションの種類 */
  kind: FindingActionKind;
};

/**
 * finding に対応するアクション導線を返す。
 * 単一の finding に対して複数のアクションを返すこともある。
 *
 * evidence 系アクションは「なぜこの課題か」「どの分析に基づくか」を
 * 辿るための導線で、Iceberg PDCA ページへ遷移する。
 */
export function buildFindingActions(finding: AuditFinding): FindingAction[] {
  const actions: FindingAction[] = [];
  const userId = finding.userId;
  const supportPlanUrl = `/support-plan-guide?userId=${encodeURIComponent(userId)}`;
  const directSheetUrl = finding.planningSheetId
    ? `/support-planning-sheet/${encodeURIComponent(finding.planningSheetId)}`
    : supportPlanUrl;
  const icebergUrl = buildIcebergPdcaUrl(userId, { source: 'regulatory-dashboard' });

  switch (finding.type) {
    case 'planning_sheet_missing':
      actions.push({
        label: '支援計画を作成',
        url: supportPlanUrl,
        kind: 'plan',
      });
      break;

    case 'author_qualification_missing':
      if (finding.planningSheetId) {
        actions.push({
          label: '修正画面を開く',
          url: directSheetUrl,
          kind: 'review',
        });
      }
      break;

    case 'review_overdue':
      actions.push({
        label: '見直しを開始',
        url: supportPlanUrl,
        kind: 'review',
      });
      // 見直し判断の根拠として Iceberg 分析を参照
      actions.push({
        label: '分析を確認',
        url: icebergUrl,
        kind: 'evidence',
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
        url: supportPlanUrl,
        kind: 'plan',
      });
      // 記録空白の背景分析を確認
      actions.push({
        label: '分析を確認',
        url: icebergUrl,
        kind: 'evidence',
      });
      break;

    case 'delivery_missing':
      actions.push({
        label: '交付画面を開く',
        url: directSheetUrl,
        kind: 'review',
      });
      break;

    case 'add_on_candidate':
      actions.push({
        label: '算定状況を確認',
        url: directSheetUrl,
        kind: 'review',
      });
      // 加算の根拠となる分析を確認
      actions.push({
        label: '分析を確認',
        url: icebergUrl,
        kind: 'evidence',
      });
      break;

    case 'monitoring_meeting_missing':
    case 'monitoring_meeting_unfinalized':
    case 'monitoring_qualification_missing':
    case 'monitoring_overdue':
      actions.push({
        label: 'モニタリング記録',
        url: `/monitoring-meeting/${encodeURIComponent(userId)}`,
        kind: 'review',
      });
      break;
  }

  return actions;
}
