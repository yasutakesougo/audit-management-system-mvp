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

import {
  isStrictSameProcedureSlot,
  isShiftedProcedureSlot,
  matchExecutionRecordsToProcedures,
} from './executionRecordMatching';

export { isStrictSameProcedureSlot, isShiftedProcedureSlot };

export function isSameProcedureSlot(slot: ProcedureItem, record: ExecutionRecord): boolean {
  return isStrictSameProcedureSlot(slot, record) || isShiftedProcedureSlot(slot, record);
}

function extractTime(dateTimeStr?: string): string {
  if (!dateTimeStr) return '--:--';
  // Try ISO time extraction timezone-agnostically first, e.g., '2024-01-01T09:45:00Z' -> '09:45'
  const isoTimeMatch = dateTimeStr.match(/T(\d{2}):(\d{2})/);
  if (isoTimeMatch) {
    return `${isoTimeMatch[1]}:${isoTimeMatch[2]}`;
  }
  const timeMatch = dateTimeStr.match(/(\d{2}):(\d{2})/);
  if (timeMatch) return timeMatch[0];
  return '--:--';
}


/**
 * Builds a sequential list of all procedure slots for a day,
 * matching them with execution records if they exist.
 */
export function buildDailyProcedureFlowPreview(
  slots: ProcedureItem[],
  records: ExecutionRecord[]
): DailyProcedureFlowStep[] {
  if (!slots || slots.length === 0) {
    // Generate fallback steps from records so the timeline is never blank
    const sortedRecords = [...records].sort((a, b) => {
      const timeA = a.recordedAt || '';
      const timeB = b.recordedAt || '';
      return timeA.localeCompare(timeB);
    });

    return sortedRecords.map((record, index) => {
      const rowNoStr = record.scheduleItemId.match(/\d+$/)?.[0];
      const rowNo = rowNoStr ? parseInt(rowNoStr, 10) : index + 1;
      const time = extractTime(record.recordedAt);

      // Infer block from hours
      let block = 'morning';
      const hoursMatch = time.match(/^(\d{2}):/);
      if (hoursMatch) {
        const hours = parseInt(hoursMatch[1], 10);
        if (hours >= 18) block = 'night';
        else if (hours >= 16) block = 'evening';
        else if (hours >= 12) block = 'afternoon';
      }

      return {
        rowNo,
        time,
        activity: `記録 ${rowNo} (${record.scheduleItemId})`,
        activityDetail: `保存済みの支援記録データから自動表示されています。`,
        isKey: false,
        block,
        record: {
          status: record.status,
          memo: record.memo,
          recordedAt: record.recordedAt,
          recordedBy: record.recordedBy,
        },
      };
    });
  }

  // Sort slots by rowNo to guarantee chronological sequence
  const sortedSlots = [...slots].sort((a, b) => (a.rowNo ?? 0) - (b.rowNo ?? 0));

  const matchedRecords = matchExecutionRecordsToProcedures(sortedSlots, records);
  return sortedSlots.map((slot, index) => {
    const matchedRecord = matchedRecords[index];
    const rowNo = slot.rowNo !== undefined && slot.rowNo !== null ? Number(slot.rowNo) : index + 1;

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

