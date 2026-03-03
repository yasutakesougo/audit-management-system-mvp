/**
 * weekViewHelpers.ts — Pure date/time helper functions extracted from WeekView.tsx
 *
 * Extracted to keep WeekView.tsx within the 600-line contract guard limit.
 * All functions are stateless and side-effect free.
 */
import type { SchedItem } from '../data';
import { SERVICE_TYPE_META, type ServiceTypeKey } from '../serviceTypeMetadata';

// ---------------------------------------------------------------------------
// Week range helpers
// ---------------------------------------------------------------------------

export const startOfWeek = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const diff = (day + 6) % 7; // Monday start
  next.setDate(next.getDate() - diff);
  return next;
};

export const endOfWeek = (start: Date): Date => {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
};

// ---------------------------------------------------------------------------
// Date/time formatting
// ---------------------------------------------------------------------------

export const formatTime = (iso: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/**
 * Extract date key (YYYY-MM-DD) in site timezone
 * Fixes UTC offset bug: JST 07:00-08:59 schedules were appearing in previous day column
 */
export const dayKeyInTz = (date: Date, tz = 'Asia/Tokyo'): string => {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(date);
};

/**
 * Parse ISO-like string to Date, handling both UTC (with Z) and local formats
 */
export const parseAsDate = (isoLike: string): Date => {
  const t = Date.parse(isoLike);
  return Number.isNaN(t) ? new Date(isoLike) : new Date(t);
};

/**
 * Extract hour and minute in site timezone (for time slot filtering)
 * Fixes display bug: UTC 21:00 was showing as 21:00 instead of JST 06:00
 */
export const getTimeInTz = (isoString: string, tz = 'Asia/Tokyo'): { hour: number; minute: number } => {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return { hour, minute };
};

export const _formatEventTimeRange = (startIso: string, endIso?: string | null): string => {
  const start = formatTime(startIso);
  if (!endIso) {
    return start;
  }
  return `${start} – ${formatTime(endIso)}`;
};

export const _buildWeekEventAriaLabel = (
  item: SchedItem & { staffNames?: string[]; location?: string },
  timeRange: string,
  statusLabel?: string,
): string => {
  const itemAny = item as Record<string, unknown>;
  const service = item.subType ?? item.serviceType ?? '';
  const person = item.personName ?? '';
  const staffNamesRaw = itemAny.staffNames as string[] | undefined;
  const staffNames = Array.isArray(staffNamesRaw) ? staffNamesRaw.filter(Boolean).join('、') : '';
  const location = item.locationName ?? (itemAny.location as string | undefined) ?? '';
  const reason = item.statusReason?.trim() ?? '';

  const segments = [
    timeRange,
    item.title,
    service ? `サービス ${service}` : '',
    person ? `利用者 ${person}` : '',
    staffNames ? `担当 ${staffNames}` : '',
    location ? `場所 ${location}` : '',
    statusLabel ? `状態 ${statusLabel}` : '',
    reason ? `メモ ${reason}` : '',
  ];

  return segments.filter(Boolean).join(' ');
};

// ---------------------------------------------------------------------------
// Formatters (cached Intl instances)
// ---------------------------------------------------------------------------

export const dayFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

export const rangeFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
});

export const toDateIsoLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ---------------------------------------------------------------------------
// Service type helpers
// ---------------------------------------------------------------------------

export type WeekServiceFilter = ServiceTypeKey | 'unset';

export const mapServiceTypeToThemeKey = (value?: WeekServiceFilter | null): WeekServiceFilter => value ?? 'unset';

export const getServiceTypeMeta = (value?: WeekServiceFilter | null) =>
  value && value !== 'unset' ? SERVICE_TYPE_META[value] : undefined;

// ---------------------------------------------------------------------------
// Time Grid Constants & generators
// ---------------------------------------------------------------------------

export const TIME_START = 6;      // 06:00
export const TIME_END = 22;       // 22:00
export const _SLOT_MINUTES = 30;

export const _generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let h = TIME_START; h < TIME_END; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
};

export const _getLocalTimeLabel = (iso: string): string => {
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};
