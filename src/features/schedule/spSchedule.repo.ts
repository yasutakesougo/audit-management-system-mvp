import { assignLocalDateKey, getLocalDateMonthKey } from '@/features/schedule/dateutils.local';
import type { Schedule as TimelineSchedule } from '@/features/schedule/types';
import type { UseSP } from '@/lib/spClient';

import { toSPPayload } from './spMappers';

const LIST_TITLE = 'Schedules_Master';

type SharePointItemLike = {
  Id?: number | string;
  id?: number | string;
  ETag?: string;
  etag?: string;
  ['@odata.etag']?: string;
  d?: {
    Id?: number | string;
    ETag?: string;
    ['@odata.etag']?: string;
  } | null;
};

const extractId = (item: SharePointItemLike | undefined): string => {
  if (!item) return '';
  const candidate = item.Id ?? item.id ?? item.d?.Id;
  if (typeof candidate === 'number') return String(candidate);
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  return '';
};

const extractEtag = (item: SharePointItemLike | undefined, fallback?: string): string => {
  if (!item) return fallback ?? '';
  const candidate = item.ETag ?? item.etag ?? item['@odata.etag'] ?? item.d?.ETag ?? item.d?.['@odata.etag'];
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }
  return fallback ?? '';
};

export const addScheduleSP = async (sp: UseSP, schedule: TimelineSchedule): Promise<TimelineSchedule> => {
  const payload = toSPPayload(schedule);
  const created = (await sp.addListItemByTitle<typeof payload, SharePointItemLike>(LIST_TITLE, payload)) ?? undefined;
  const id = extractId(created) || schedule.id;
  const etag = extractEtag(created, schedule.etag);
  return assignLocalDateKey({
    ...schedule,
    id,
    etag,
  });
};

export const updateScheduleSP = async (sp: UseSP, schedule: TimelineSchedule): Promise<TimelineSchedule> => {
  const payload = toSPPayload(schedule);
  const numericId = Number.parseInt(schedule.id, 10);
  if (!Number.isFinite(numericId)) {
    throw new Error('SharePoint スケジュールの更新には数値の ID が必要です');
  }

  await sp.updateItemByTitle(LIST_TITLE, numericId, payload, { ifMatch: schedule.etag });
  const { etag } = await sp.getItemByIdWithEtag<{ Id: number }>(LIST_TITLE, numericId, ['Id']);

  return assignLocalDateKey({
    ...schedule,
    etag: etag ?? schedule.etag ?? '',
  });
};

export const updateScheduleDatesSP = async (
  sp: UseSP,
  schedule: TimelineSchedule,
  startIso: string,
  endIso: string,
  nextDayKey: string
): Promise<{ etag: string }> => {
  const numericId = Number.parseInt(schedule.id, 10);
  if (!Number.isFinite(numericId)) {
    throw new Error('SharePoint スケジュールの日付更新には数値の ID が必要です');
  }

  const payload = {
    Start: startIso,
    End: endIso,
    DayKey: nextDayKey,
    MonthKey: getLocalDateMonthKey(startIso) || startIso.slice(0, 7),
  } satisfies Record<string, unknown>;

  await sp.updateItemByTitle(LIST_TITLE, numericId, payload, { ifMatch: schedule.etag });
  const { etag } = await sp.getItemByIdWithEtag<{ Id: number }>(LIST_TITLE, numericId, ['Id']);
  return { etag: etag ?? schedule.etag ?? '' };
};
