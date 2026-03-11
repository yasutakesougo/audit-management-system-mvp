/**
 * dayViewHelpers.ts — Pure date/time helper functions extracted from DayView.tsx
 *
 * Extracted to keep DayView.tsx within the 600-line contract guard limit.
 * All functions are stateless and side-effect free.
 */

// ---------------------------------------------------------------------------
// Date string helpers
// ---------------------------------------------------------------------------

/**
 * Convert an ISO datetime string to a local YYYY-MM-DD date string.
 * Falls back to slicing the raw string if the value is not parseable.
 */
export const toLocalDateIso = (value?: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

/**
 * Format an ISO date string into a Japanese day label: "YYYY年M月D日（曜）"
 */
export const formatDayLabel = (iso: string): string => {
  const date = new Date(iso);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()] ?? '';
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  return `${fmt.format(date)}（${weekday}）`;
};

/**
 * Format a time range as "HH:MM" or "HH:MM〜HH:MM".
 */
export const formatTimeRange = (fromIso: string, toIso?: string): string => {
  const from = new Date(fromIso);
  const to = toIso ? new Date(toIso) : null;
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (!to) {
    return fmt.format(from);
  }

  return `${fmt.format(from)}〜${fmt.format(to)}`;
};

// ---------------------------------------------------------------------------
// Date boundary helpers
// ---------------------------------------------------------------------------

/**
 * Return a new Date set to the start of the given day (00:00:00.000).
 */
export const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Return a new Date set to the end of the given day (24:00:00.000 = next midnight).
 */
export const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(24, 0, 0, 0);
  return d;
};
