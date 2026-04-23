import type { UpdateScheduleEventInput } from '@/features/schedules/data/port';
import type { TransportAssignmentSaveStatus } from '@/features/transport-assignments/hooks/useTransportAssignmentSave';
import type { TransportAssignment } from '@/features/schedules/domain/assignment';

const JST_TZ = 'Asia/Tokyo';
const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_LOOKBACK_WEEKS = 8;

export type WeekDateOption = {
  date: string;
  label: string;
};

export type WeekBulkApplyState = {
  assignments: TransportAssignment[];
  payloads: UpdateScheduleEventInput[];
  summary: Array<{ date: string; count: number }>;
  signals: any[];
};

export function toJstDateKey(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: JST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function toJstWeekdayLabel(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: JST_TZ,
    weekday: 'short',
  }).format(date);
}

export function toJstNoon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00+09:00`);
}

export function shiftDateInJst(dateKey: string, days: number): string {
  const base = toJstNoon(dateKey);
  return toJstDateKey(new Date(base.getTime() + (days * DAY_MS)));
}

export function getWeekStartDate(dateKey: string): string {
  const base = toJstNoon(dateKey);
  const day = base.getUTCDay(); // 0: Sun ... 6: Sat (stable for JST noon)
  const diff = (day + 6) % 7; // Monday start
  return toJstDateKey(new Date(base.getTime() - (diff * DAY_MS)));
}

export function buildWeekDateOptions(weekStart: string): WeekDateOption[] {
  return Array.from({ length: 5 }, (_, index) => {
    const date = shiftDateInJst(weekStart, index);
    const weekday = toJstWeekdayLabel(toJstNoon(date));
    return {
      date,
      label: `${weekday} ${date.slice(5).replace('-', '/')}`,
    };
  });
}

export function formatWeekRange(weekStart: string): string {
  const weekEnd = shiftDateInJst(weekStart, 4);
  return `${weekStart.slice(5).replace('-', '/')} - ${weekEnd.slice(5).replace('-', '/')}`;
}

export function buildDateRange(weekStart: string, lookbackWeeks = 0): { from: string; to: string } {
  const rangeStart = shiftDateInJst(weekStart, -(lookbackWeeks * 7));
  const weekEnd = shiftDateInJst(weekStart, 4);
  return {
    from: `${rangeStart}T00:00:00+09:00`,
    to: `${weekEnd}T23:59:59+09:00`,
  };
}

export function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatSavedAt(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function isOnTargetDate(start: string | undefined, targetDate: string): boolean {
  if (!start) return false;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return false;
  return toJstDateKey(date) === targetDate;
}

export function normalizeToWeekdayDate(dateKey: string): string {
  const day = toJstNoon(dateKey).getUTCDay();
  if (day === 0) return shiftDateInJst(dateKey, 1);
  if (day === 6) return shiftDateInJst(dateKey, -1);
  return dateKey;
}

export function buildWeekBulkSummaryLabel(
  weekBulkApplyState: WeekBulkApplyState | null,
  weekDateOptions: readonly WeekDateOption[],
): string {
  if (!weekBulkApplyState) return '';

  const weekdayByDate = new Map(
    weekDateOptions.map((option) => [option.date, option.label.split(' ')[0] ?? option.date] as const),
  );

  return weekBulkApplyState.summary
    .map((item) => {
      const weekday = weekdayByDate.get(item.date) ?? item.date;
      return item.count > 0 ? `${weekday} ${item.count}件` : `${weekday} 変更なし`;
    })
    .join(' / ');
}

export function getSaveStatusText(input: {
  saveStatus: TransportAssignmentSaveStatus;
  dirty: boolean;
  lastSavedAt: string | null;
}): string {
  if (input.saveStatus === 'saving') {
    return '保存中...';
  }
  if (input.dirty) {
    return '未保存の変更があります';
  }
  if (input.saveStatus === 'success') {
    return `保存済み (${formatSavedAt(input.lastSavedAt)})`;
  }
  return '変更なし';
}
