import type { ProcedureItem } from '@/features/daily/stores/procedureStore';
import type { ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import { normalizeScheduleItemId } from '@/features/daily/utils/normalizeScheduleItemId';

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
  recordKeys.add(String(record.scheduleItemId));

  const recordTrailingMatch = String(record.scheduleItemId).match(/\d+$/);
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
  const recordScheduleItemIdStr = String(record.scheduleItemId ?? '');
  // Support 0-based and 1-based index mismatch robustly only when the record scheduleItemId is a pure numeric string
  if (/^\d+$/.test(recordScheduleItemIdStr)) {
    const recordNum = parseInt(recordScheduleItemIdStr, 10);
    if (slot.rowNo === recordNum + 1) {
      return true;
    }
  }
  // Also check if slotId trailing digit has index shift (e.g. slotId ends with 'base-1' and record.scheduleItemId is '0')
  const slotId = slot.id || '';
  const slotTrailingMatch = slotId.match(/\d+$/);
  if (slotTrailingMatch && /^\d+$/.test(recordScheduleItemIdStr)) {
    const slotVal = parseInt(slotTrailingMatch[0], 10);
    const recordVal = parseInt(recordScheduleItemIdStr, 10);
    if (slotVal === recordVal + 1) {
      return true;
    }
  }
  return false;
}

/**
 * Centralized matching logic for mapping execution records to procedure slots.
 * Ensures strict matches are preferred, shifted matches are fallbacks, and
 * each record is mapped to at most one slot using reference-based consumed tracking.
 */
export function matchExecutionRecordsToProcedures(
  slots: ProcedureItem[],
  records: ExecutionRecord[]
): Array<ExecutionRecord | undefined> {
  // 1. Normalize procedure slots (assign rowNo = index + 1 if rowNo is missing)
  const normalizedSlots = slots.map((slot, index) => ({
    ...slot,
    rowNo: slot.rowNo !== undefined && slot.rowNo !== null ? Number(slot.rowNo) : index + 1,
    id: slot.id ? String(slot.id) : undefined,
  }));

  // Track consumed records using object reference Set
  const consumed = new Set<ExecutionRecord>();
  const strictMatchMap = new Map<ProcedureItem, ExecutionRecord>();

  // Phase 1: Strictly match slots first
  normalizedSlots.forEach((slot) => {
    const strictMatch = records.find(
      (r) => !consumed.has(r) && isStrictSameProcedureSlot(slot, r)
    );
    if (strictMatch) {
      strictMatchMap.set(slot, strictMatch);
      consumed.add(strictMatch);
    }
  });

  // Phase 2: Shifted match fallback for remaining unconsumed slots
  return normalizedSlots.map((slot) => {
    let matchedRecord = strictMatchMap.get(slot);

    if (!matchedRecord) {
      matchedRecord = records.find(
        (r) => !consumed.has(r) && isShiftedProcedureSlot(slot, r)
      );
      if (matchedRecord) {
        consumed.add(matchedRecord);
      }
    }

    return matchedRecord;
  });
}
