import type { ProcedureItem } from '@/features/daily/stores/procedureStore';
import type { ExecutionRecord } from '@/features/daily/domain/legacy/executionRecordTypes';

export interface DailyProcedureFlowStep {
  rowNo: number;
  time: string;
  activity: string;
  activityDetail?: string;
  instructionDetail?: string;
  isKey: boolean;
  block: string;
  record?: {
    status: ExecutionRecord['status'];
    memo: string;
    recordedAt?: string;
    recordedBy?: string;
  };
}

/**
 * Builds a sequential list of all procedure slots for a day,
 * matching them with execution records if they exist.
 */
export function buildDailyProcedureFlowPreview(
  slots: ProcedureItem[],
  records: ExecutionRecord[]
): DailyProcedureFlowStep[] {
  // Sort slots by rowNo to guarantee chronological sequence
  const sortedSlots = [...slots].sort((a, b) => (a.rowNo ?? 0) - (b.rowNo ?? 0));

  return sortedSlots.map(slot => {
    const rowNo = slot.rowNo ?? 0;
    // Match record with slot: compare stringified rowNo with scheduleItemId
    const matchedRecord = records.find(r => {
      const recordSlotId = r.scheduleItemId;
      return recordSlotId === String(rowNo) || recordSlotId === slot.id;
    });

    return {
      rowNo,
      time: slot.time,
      activity: slot.activity,
      activityDetail: slot.activityDetail,
      instructionDetail: slot.instructionDetail,
      isKey: slot.isKey || false,
      block: slot.block || 'morning',
      record: matchedRecord ? {
        status: matchedRecord.status,
        memo: matchedRecord.memo,
        recordedAt: matchedRecord.recordedAt,
        recordedBy: matchedRecord.recordedBy,
      } : undefined,
    };
  });
}
