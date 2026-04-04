import type { SpDailyItem } from '@/domain/daily/spMap';
import type { DailyRecordItem } from '@/features/daily/domain/legacy/DailyRecordRepository';
import { DailyRecordItemSchema } from '@/features/daily/domain/schema';
import { DAILY_RECORD_FIELDS, type RawSharePointItem } from '../constants';

/**
 * Zod based parse of SharePoint item
 */
export const parseSpItem = (item: RawSharePointItem | null): DailyRecordItem | null => {
  if (!item) return null;

  // Map physical SharePoint names to logical names before validation
  const logicalItem = {
    ...item,
    UserRowsJSON: item[DAILY_RECORD_FIELDS.userRowsJSON as keyof RawSharePointItem],
  };

  const result = DailyRecordItemSchema.safeParse(logicalItem);
  if (!result.success) {
    console.error('[SharePointDailyRecordRepository] Failed to validate item', {
      itemId: item.Id,
      errors: result.error.flatten().fieldErrors,
    });
    return null;
  }
  return result.data;
};

/**
 * Normalizes dates to YYYY-MM-DD
 */
export const normalizeDateToYmd = (raw: unknown): string | null => {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  return null;
};

/**
 * Merges special notes with a newline
 */
export const mergeSpecialNotes = (current: string, incoming: string): string => {
  if (!incoming.trim()) return current;
  if (!current.trim()) return incoming;
  if (current.includes(incoming)) return current;
  return `${current}\n${incoming}`;
};

/**
 * Normalizes a list row for DailyMap ingestion
 */
export function normalizeRowForDailyMap(item: Record<string, unknown>, dateField: string): SpDailyItem {
    const normalized: SpDailyItem = { ...item };

    if (!normalized.cr013_date && normalized.cr013_recorddate) {
      normalized.cr013_date = normalized.cr013_recorddate;
    }
    if (!normalized.cr013_date && normalized[dateField]) {
      normalized.cr013_date = normalized[dateField];
    }
    if (!normalized.cr013_personId && (item.UserCode || item.UserID)) {
        normalized.cr013_personId = (item.UserCode ?? item.UserID) as string;
    }
    if (!normalized.cr013_personId && normalized.cr013_usercode) {
      normalized.cr013_personId = normalized.cr013_usercode;
    }
    if (!normalized.cr013_payload && typeof item.cr013_specialnote === 'string' && (item.cr013_specialnote as string).trim()) {
      normalized.cr013_payload = JSON.stringify({ specialNotes: (item.cr013_specialnote as string).trim() });
    }
    if (!normalized.cr013_kind) {
      normalized.cr013_kind = 'A';
    }
    if (!normalized.cr013_status) {
      normalized.cr013_status = '完了';
    }

    return normalized;
}

export const EMPTY_PROBLEM_BEHAVIOR = {
  selfHarm: false,
  otherInjury: false,
  loudVoice: false,
  pica: false,
  other: false,
};
