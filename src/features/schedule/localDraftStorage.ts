import { assignLocalDateKey } from '@/features/schedule/dateutils.local';
import type { Schedule as TimelineSchedule } from '@/features/schedule/types';

const STORAGE_KEY = 'schedule.localDrafts.v1';

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const sanitizeDraft = (value: unknown): TimelineSchedule | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Partial<TimelineSchedule>;
  if (typeof record.id !== 'string' || typeof record.start !== 'string' || typeof record.end !== 'string') {
    return null;
  }
  const normalized = assignLocalDateKey({
    ...(record as TimelineSchedule),
  });
  return normalized;
};

const dedupeById = (drafts: TimelineSchedule[]): TimelineSchedule[] => {
  const seen = new Map<string, TimelineSchedule>();
  for (const draft of drafts) {
    seen.set(draft.id, draft);
  }
  return Array.from(seen.values());
};

export const loadLocalDrafts = (): TimelineSchedule[] => {
  if (!isBrowser()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const drafts = parsed
      .map(sanitizeDraft)
      .filter((draft): draft is TimelineSchedule => Boolean(draft));
    return dedupeById(drafts);
  } catch (error) {
    console.warn('[schedule] Failed to read local draft schedules:', error);
    return [];
  }
};

export const saveLocalDrafts = (drafts: TimelineSchedule[]): void => {
  if (!isBrowser()) {
    return;
  }
  try {
    if (!drafts.length) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload = JSON.stringify(dedupeById(drafts));
    window.localStorage.setItem(STORAGE_KEY, payload);
  } catch (error) {
    console.warn('[schedule] Failed to persist local draft schedules:', error);
  }
};

export const clearLocalDrafts = (): void => {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[schedule] Failed to clear local draft schedules:', error);
  }
};
