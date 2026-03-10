/**
 * DailyForm — Types and pure helper functions
 */
import type { DailyStatus, DailyUpsert, SpDailyItem } from '@/types';
import { DAILY_STATUS_OPTIONS } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DailyFormMode = 'create' | 'edit';

export type DailyFormInitial = {
  id?: number;
  title?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  staffId?: number | null;
  userId?: number | null;
  notes?: string | null;
  mealLog?: string | null;
  behaviorLog?: string | null;
  status?: string | null;
  etag?: string | null;
};

export type DailyFormProps = {
  mode: DailyFormMode;
  initial?: DailyFormInitial;
  onDone?: (result: SpDailyItem) => void;
  prefillNotice?: string;
  prefillError?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export const toMinutes = (hhmm?: string | null) => {
  if (!hhmm) return null;
  const match = hhmm.match(/^([0-1]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const sanitizeStatus = (value: string | null | undefined): DailyStatus | null => {
  if (!value) return null;
  return DAILY_STATUS_OPTIONS.includes(value as DailyStatus) ? (value as DailyStatus) : null;
};

export const parseLookupId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const toFormState = (source?: DailyFormInitial): DailyUpsert => ({
  title: source?.title ?? '',
  date: source?.date ?? '',
  startTime: source?.startTime ?? '',
  endTime: source?.endTime ?? '',
  location: source?.location ?? '',
  staffId: source?.staffId ?? null,
  userId: source?.userId ?? null,
  notes: source?.notes ?? '',
  mealLog: source?.mealLog ?? '',
  behaviorLog: source?.behaviorLog ?? '',
  status: sanitizeStatus(source?.status),
});

export const toInitialFromItem = (item: SpDailyItem, etag?: string | null): DailyFormInitial => {
  const record = item as unknown as Record<string, unknown>;
  return {
    id: typeof item.Id === 'number' ? item.Id : undefined,
    title: item.Title ?? '',
    date: item.Date ?? null,
    startTime: item.StartTime ?? null,
    endTime: item.EndTime ?? null,
    location: item.Location ?? null,
    staffId: parseLookupId(item.StaffIdId ?? record.StaffId),
    userId: parseLookupId(item.UserIdId ?? record.UserId),
    notes: item.Notes ?? null,
    mealLog: item.MealLog ?? null,
    behaviorLog: item.BehaviorLog ?? null,
    status: typeof item.Status === 'string' ? item.Status : null,
    etag: typeof etag === 'string'
      ? etag
      : typeof record['__etag'] === 'string'
        ? (record['__etag'] as string)
        : null,
  };
};
