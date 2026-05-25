import type { ProcedureItem } from '@/features/daily/stores/procedureStore';
import type { ExecutionRecord } from '@/features/daily/domain/legacy/executionRecordTypes';
import { normalizeScheduleItemId } from '@/features/daily/utils/normalizeScheduleItemId';

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
 * Robust matching helper for matching slots to execution records
 */
/**
 * Strict matching helper (exact ID or rowNo equivalence)
 */
export function isStrictSameProcedureSlot(slot: ProcedureItem, record: ExecutionRecord): boolean {
  const slotId = slot.id || '';
  const normSlotId = normalizeScheduleItemId(slotId);
  const normRecordId = normalizeScheduleItemId(record.scheduleItemId);
  if (!normSlotId || !normRecordId) return false;

  const slotKeys = new Set<string>();
  slotKeys.add(normSlotId);
  if (slot.id) slotKeys.add(slot.id);
  if (slot.rowNo !== undefined && slot.rowNo !== null) {
    slotKeys.add(String(slot.rowNo));
    slotKeys.add(normalizeScheduleItemId(String(slot.rowNo)));
  }

  const slotTrailingMatch = slotId.match(/\d+$/);
  if (slotTrailingMatch) {
    slotKeys.add(slotTrailingMatch[0]);
    slotKeys.add(normalizeScheduleItemId(slotTrailingMatch[0]));
  }

  const recordKeys = new Set<string>();
  recordKeys.add(normRecordId);
  recordKeys.add(record.scheduleItemId);

  const recordTrailingMatch = record.scheduleItemId.match(/\d+$/);
  if (recordTrailingMatch) {
    recordKeys.add(recordTrailingMatch[0]);
    recordKeys.add(normalizeScheduleItemId(recordTrailingMatch[0]));
  }

  for (const rKey of recordKeys) {
    if (slotKeys.has(rKey)) return true;
  }
  return false;
}

/**
 * Robust matching with 0-based to 1-based index shift fallback
 */
export function isShiftedProcedureSlot(slot: ProcedureItem, record: ExecutionRecord): boolean {
  // Support 0-based and 1-based index mismatch robustly only when the record scheduleItemId is a pure numeric string
  if (/^\d+$/.test(record.scheduleItemId)) {
    const recordNum = parseInt(record.scheduleItemId, 10);
    if (slot.rowNo === recordNum + 1) {
      return true;
    }
  }
  // Also check if slotId trailing digit has index shift (e.g. slotId ends with 'base-1' and record.scheduleItemId is '0')
  const slotId = slot.id || '';
  const slotTrailingMatch = slotId.match(/\d+$/);
  if (slotTrailingMatch && /^\d+$/.test(record.scheduleItemId)) {
    const slotVal = parseInt(slotTrailingMatch[0], 10);
    const recordVal = parseInt(record.scheduleItemId, 10);
    if (slotVal === recordVal + 1) {
      return true;
    }
  }
  return false;
}

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

  // Build strict matching map first to prevent cross-row mismatch pollution
  const strictlyMatchedRecordIds = new Set<string>();
  const strictMatchMap = new Map<number, ExecutionRecord>();

  sortedSlots.forEach(slot => {
    const rowNo = slot.rowNo ?? 0;
    const strictMatch = records.find(r => isStrictSameProcedureSlot(slot, r));
    if (strictMatch) {
      strictMatchMap.set(rowNo, strictMatch);
      if (strictMatch.id) {
        strictlyMatchedRecordIds.add(strictMatch.id);
      }
    }
  });

  return sortedSlots.map(slot => {
    const rowNo = slot.rowNo ?? 0;

    // 1. Prioritize strict match (already cached to prevent pollution)
    let matchedRecord = strictMatchMap.get(rowNo);

    // 2. If no strict match, fallback to index shift matching (filtering out strictly matched records)
    if (!matchedRecord) {
      matchedRecord = records.find(r =>
        (!r.id || !strictlyMatchedRecordIds.has(r.id)) && isShiftedProcedureSlot(slot, r)
      );
    }

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

