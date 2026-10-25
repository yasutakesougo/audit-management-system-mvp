import { normalizeScheduleItemId } from './normalizeScheduleItemId';

export const normalizeExecutionDate = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw;
};

export const normalizeExecutionUserId = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim().length > 0 ? value : '';
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  return '';
};

export const getUserIdAliases = (_userId: string): string[] => [];

export const buildExecutionUserIdCandidates = (...values: unknown[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (val: unknown) => {
    if (typeof val === 'string') {
      if (val.trim().length === 0 || seen.has(val)) return;
      seen.add(val);
      out.push(val);
      return;
    }
    if (typeof val === 'number' && Number.isSafeInteger(val) && val > 0) {
      const str = String(val);
      if (seen.has(str)) return;
      seen.add(str);
      out.push(str);
      return;
    }
  };

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) push(item);
    } else {
      push(value);
    }
  }

  return out;
};

export const extractProcedureRowKey = (value: unknown): string => {
  const normalized = normalizeScheduleItemId(value);
  if (!normalized) return '';
  if (/^\d+$/.test(normalized)) return String(Number.parseInt(normalized, 10));

  const match = normalized.match(/(?:^|[-_])(row|base|procedure|slot|step)[-_]?(\d+)$/i);
  if (match) return String(Number.parseInt(match[2], 10));

  // Planning-sheet derived procedure IDs can be source-scoped, e.g.
  // "official-<sheetId>-1". The final small numeric segment is the rowNo.
  const tailNumber = normalized.match(/[-_](\d{1,2})$/);
  if (!tailNumber) return '';
  const rowNo = Number.parseInt(tailNumber[1], 10);
  return rowNo >= 0 && rowNo <= 99 ? String(rowNo) : '';
};

export { normalizeScheduleItemId };
