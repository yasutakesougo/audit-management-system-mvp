/**
 * toProcedureRecord — 行動記録を制度三層の支援手順実施記録に変換する Adapter
 *
 * /daily/support で入力された ABCRecord を
 * ISP 三層モデルの第3層 SupportProcedureRecord の入力形式に変換する。
 *
 * これにより、日次の支援記録が監査証跡として制度記録に流れる。
 *
 * 変換マッピング:
 *   ABCRecord.userId          → ProcedureRecordInput.userId
 *   ProcedureStep.planningSheetId → ProcedureRecordInput.planningSheetId
 *   ProcedureStep.time        → ProcedureRecordInput.timeSlot
 *   ProcedureStep.activity    → ProcedureRecordInput.activity
 *   ProcedureStep.instruction → ProcedureRecordInput.procedureText
 *   ABCRecord.actualObservation → ProcedureRecordInput.userResponse
 *   ABCRecord.staffResponse   → ProcedureRecordInput.specialNotes
 *   ABCRecord.followUpNote    → ProcedureRecordInput.handoffNotes
 */
import type { ABCRecord } from '@/domain/behavior';
import type { ProcedureExecutionStatus } from '@/domain/isp/schema';
import type { ProcedureStep } from '@/features/daily/domain/legacy/ProcedureRepository';

/**
 * SupportProcedureRecord の作成入力型
 *
 * procedureRecordFormSchema と整合するが、
 * Adapter 側で組み立てるため独立した型として定義。
 */
export type ProcedureRecordInput = {
  userId: string;
  planningSheetId: string;
  ispId?: string;
  recordDate: string;
  timeSlot: string;
  activity: string;
  procedureText: string;
  executionStatus: ProcedureExecutionStatus;
  userResponse: string;
  specialNotes: string;
  handoffNotes: string;
  performedBy: string;
  performedAt: string;
  /** 導出元の手順ステップ番号（監査追跡用） */
  sourceStepOrder?: number;
};

/**
 * ABCRecord の内容から実施ステータスを推定する。
 *
 * - actualObservation がある → 'done'
 * - staffResponse だけある → 'partially_done'
 * - followUpNote に「未実施」「スキップ」を含む → 'skipped'
 * - それ以外 → 'planned'
 */
export function deriveExecutionStatus(record: ABCRecord): ProcedureExecutionStatus {
  if (record.actualObservation && record.actualObservation.trim().length > 0) {
    return 'done';
  }
  if (record.staffResponse && record.staffResponse.trim().length > 0) {
    return 'partially_done';
  }
  if (record.followUpNote) {
    const note = record.followUpNote.trim();
    if (note.includes('未実施') || note.includes('スキップ') || note.includes('skip')) {
      return 'skipped';
    }
  }
  return 'planned';
}

/**
 * ABCRecord + ProcedureStep → ProcedureRecordInput に変換する。
 *
 * @param record - 行動記録 (ABCRecord)
 * @param step - 対応する手順ステップ（planningSheetId を持つ）
 * @param performedBy - 実施者ID（スタッフ）
 * @param options - オプション（ispId, executionStatus の手動指定など）
 */
export function toProcedureRecord(
  record: ABCRecord,
  step: ProcedureStep,
  performedBy: string,
  options?: {
    ispId?: string;
    executionStatus?: ProcedureExecutionStatus;
  },
): ProcedureRecordInput | null {
  // planningSheetId がなければ変換不可（旧データ互換：無視して null を返す）
  if (!step.planningSheetId) {
    return null;
  }

  const executionStatus = options?.executionStatus ?? deriveExecutionStatus(record);

  return {
    userId: record.userId,
    planningSheetId: step.planningSheetId,
    ispId: options?.ispId,
    recordDate: record.recordedAt.slice(0, 10), // ISO datetime → date only
    timeSlot: step.time,
    activity: step.activity,
    procedureText: step.instruction,
    executionStatus,
    userResponse: record.actualObservation ?? '',
    specialNotes: record.staffResponse ?? '',
    handoffNotes: record.followUpNote ?? '',
    performedBy,
    performedAt: record.recordedAt,
    sourceStepOrder: step.sourceStepOrder,
  };
}

/**
 * planningSheetId を持つステップかどうかを判定する。
 * toProcedureRecord と合わせて使い、変換可能な記録だけを絞り込む。
 */
export function canConvertToRecord(step: ProcedureStep): boolean {
  return Boolean(step.planningSheetId && step.source === 'planning_sheet');
}
