import { updateScheduleDatesSP } from '@/features/schedule/spSchedule.repo';
import type { Schedule as TimelineSchedule } from '@/features/schedule/types';
import type { UseSP } from '@/lib/spClient';

type UpdateResult = { ok: true; etag: string } | { ok: false; error: unknown };

type UpdateDatesWithRetryParams = {
  sp: UseSP;
  current: TimelineSchedule;
  moved: TimelineSchedule;
  listTitle?: string;
};

const SCHEDULE_LIST_TITLE = 'Schedules_Master';

const isPreconditionFailure = (error: unknown): boolean => {
  const status = (error as { status?: unknown })?.status;
  const code = (error as { code?: unknown })?.code;
  return Boolean(String(status ?? code).includes('412'));
};

const resolveDayKey = (schedule: TimelineSchedule): string | undefined => schedule.dayKey;

const resolveNumericId = (schedule: TimelineSchedule): number | null => {
  const numeric = Number.parseInt(schedule.id, 10);
  return Number.isFinite(numeric) ? numeric : null;
};

export async function updateDatesWithRetry({ sp, current, moved, listTitle = SCHEDULE_LIST_TITLE }: UpdateDatesWithRetryParams): Promise<UpdateResult> {
  const dayKey = resolveDayKey(moved) ?? resolveDayKey(current);
  if (!dayKey) {
    return { ok: false, error: new Error('予定の保存に必要な日付キーが取得できませんでした。') };
  }

  try {
    const response = await updateScheduleDatesSP(sp, current, moved.start, moved.end, dayKey);
    return { ok: true, etag: response.etag };
  } catch (error) {
    if (!isPreconditionFailure(error)) {
      return { ok: false, error };
    }

    const numericId = resolveNumericId(current);
    if (numericId == null) {
      return { ok: false, error };
    }

    try {
      const { etag } = await sp.getItemByIdWithEtag<{ Id: number }>(listTitle, numericId, ['Id']);
      const refreshed: TimelineSchedule = { ...current, etag: etag ?? current.etag ?? '' };
      const retryResponse = await updateScheduleDatesSP(sp, refreshed, moved.start, moved.end, dayKey);
      return { ok: true, etag: retryResponse.etag };
    } catch (retryError) {
      return { ok: false, error: retryError };
    }
  }
}
