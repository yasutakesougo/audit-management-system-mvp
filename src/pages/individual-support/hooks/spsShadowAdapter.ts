import type { PlanningSheetStatus, SupportPlanningSheet } from '@/domain/isp/schema';
import type {
  SPSHistoryEntry,
  SPSStatus,
  SupportPlanSheet,
} from '@/features/ibd/core/ibdTypes';
import { calculateNextReviewDueDate } from '@/features/ibd/core/ibdTypes';

function tokenizeText(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|。|、|,|，/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function parseOptionalNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toSpsStatus(status: PlanningSheetStatus): SPSStatus {
  switch (status) {
    case 'active':
      return 'confirmed';
    case 'archived':
      return 'expired';
    default:
      return 'draft';
  }
}

function toRevisionReason(status: PlanningSheetStatus): string {
  switch (status) {
    case 'active':
      return '現行版として昇格';
    case 'archived':
      return '旧版としてアーカイブ';
    case 'revision_pending':
      return '改訂待ちとして保存';
    case 'review':
      return 'レビュー待ちとして保存';
    case 'draft':
    default:
      return '改訂ドラフトを保存';
  }
}

export function toShadowSps(
  sheet: SupportPlanningSheet,
  fallbackUserId: number,
): SupportPlanSheet {
  const observable = tokenizeText(sheet.observationFacts);
  const underlying = tokenizeText(sheet.interpretationHypothesis);
  const environmental = tokenizeText(
    sheet.environmentalAdjustments || sheet.supportPolicy,
  );
  const positive = sheet.planning.supportPriorities.length > 0
    ? sheet.planning.supportPriorities
    : tokenizeText(sheet.supportIssues);

  return {
    id: sheet.id,
    userId: fallbackUserId,
    version: `v${sheet.version}`,
    createdAt: sheet.createdAt,
    updatedAt: sheet.updatedAt,
    nextReviewDueDate: sheet.nextReviewAt ?? calculateNextReviewDueDate(sheet.updatedAt),
    status: toSpsStatus(sheet.status),
    confirmedBy: parseOptionalNumber(sheet.authoredByStaffId),
    confirmedAt:
      sheet.status === 'active'
        ? sheet.appliedFrom ?? sheet.reviewedAt ?? sheet.updatedAt
        : null,
    icebergModel: {
      observableBehaviors: observable.length > 0 ? observable : ['行動観察データ収集中'],
      underlyingFactors: underlying.length > 0 ? underlying : ['背景要因の分析中'],
      environmentalAdjustments:
        environmental.length > 0 ? environmental : ['環境調整の検討中'],
    },
    positiveConditions:
      positive.length > 0 ? positive : ['穏やかな環境', '馴染みのスタッフ'],
  };
}

export function buildShadowSpsHistory(
  series: SupportPlanningSheet[],
  currentSheetId: string,
  fallbackUserId: number,
): SPSHistoryEntry[] {
  return [...series]
    .filter((sheet) => sheet.id !== currentSheetId)
    .sort((a, b) => b.version - a.version)
    .map((sheet) => ({
      id: `history-${currentSheetId}-${sheet.id}`,
      spsId: currentSheetId,
      userId: fallbackUserId,
      version: `v${sheet.version}`,
      snapshotAt: sheet.updatedAt,
      revisedBy: parseOptionalNumber(sheet.updatedBy),
      revisionReason: toRevisionReason(sheet.status),
      changesSummary: `版 v${sheet.version}（${sheet.status}）`,
      snapshot: toShadowSps(sheet, fallbackUserId),
    }));
}
