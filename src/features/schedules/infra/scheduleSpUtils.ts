/**
 * scheduleSpUtils.ts — Shared SharePoint utility functions for the schedules domain.
 *
 * Extracted from sharePointAdapter.ts and SharePointScheduleRepository.ts
 * to eliminate code duplication (~400 lines of shared utilities).
 */
import type { DateRange } from '../domain/ScheduleRepository';

// ─── Timezone helpers ────────────────────────────────────────────────────────

export const SCHEDULES_TZ = 'Asia/Tokyo';

/** Get date key (YYYY-MM-DD) in site timezone */
export function dayKeyInTz(date: Date, timeZone: string = SCHEDULES_TZ): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone }).format(date);
}

/** Get month key (YYYY-MM) in site timezone */
export function monthKeyInTz(date: Date, timeZone: string = SCHEDULES_TZ): string {
  const day = dayKeyInTz(date, timeZone);
  return day.slice(0, 7);
}

// ─── Error helpers ───────────────────────────────────────────────────────────

/**
 * Extract HTTP status code from various error shapes.
 * Used for 412 Precondition Failed detection.
 */
export const getHttpStatus = (e: unknown): number | undefined => {
  if (!e || typeof e !== 'object') return undefined;
  const obj = e as Record<string, unknown>;

  // Direct status
  if (typeof obj.status === 'number') return obj.status;

  // Nested response.status / response.statusCode
  if (obj.response && typeof obj.response === 'object') {
    const resp = obj.response as Record<string, unknown>;
    if (typeof resp.status === 'number') return resp.status;
    if (typeof resp.statusCode === 'number') return resp.statusCode;
  }

  // Nested cause.status / cause.response.status
  if (obj.cause && typeof obj.cause === 'object') {
    const cause = obj.cause as Record<string, unknown>;
    if (typeof cause.status === 'number') return cause.status;
    if (cause.response && typeof cause.response === 'object') {
      const causeResp = cause.response as Record<string, unknown>;
      if (typeof causeResp.status === 'number') return causeResp.status;
    }
  }

  return undefined;
};

export const isMissingFieldError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message ?? '';
  return /does not exist|cannot find field|存在しません/i.test(message);
};

export const readSpErrorMessage = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => '');
  if (!text) return '';
  try {
    const data = JSON.parse(text) as {
      error?: { message?: { value?: string } };
      'odata.error'?: { message?: { value?: string } };
      message?: { value?: string };
    };
    return (
      data.error?.message?.value ??
      data['odata.error']?.message?.value ??
      data.message?.value ??
      ''
    );
  } catch {
    return text.slice(0, 4000);
  }
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type SharePointResponse<T> = {
  value?: T[];
};

// ─── Date encoding ───────────────────────────────────────────────────────────

/** SharePoint-safe UTC ISO8601 literal (no milliseconds, with trailing Z). */
export const toIsoWithoutZ = (date: Date): string => {
  return date.toISOString().replace(/\.\d{3}Z$/u, 'Z');
};

export const encodeDateLiteral = (value: string): string => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid date value: ${value}`);
  }
  const isoUtc = toIsoWithoutZ(new Date(parsed));
  return `datetime'${isoUtc}'`;
};

export const buildRangeFilter = (
  range: DateRange,
  fields: { start: string; end: string }
): string => {
  // Add ±1 day buffer for timezone/all-day event safety
  const fromBuffer = toIsoWithoutZ(new Date(new Date(range.from).getTime() - 24 * 60 * 60 * 1000));
  const toBuffer = toIsoWithoutZ(new Date(new Date(range.to).getTime() + 24 * 60 * 60 * 1000));
  const fromLiteral = encodeDateLiteral(fromBuffer);
  const toLiteral = encodeDateLiteral(toBuffer);
  return `(${fields.start} lt ${toLiteral}) and (${fields.end} ge ${fromLiteral})`;
};

// ─── Sorting & key generation ────────────────────────────────────────────────

export const sortByStart = <T extends { start: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.start.localeCompare(b.start));

/** Generate rowKey for new schedule */
export const generateRowKey = (input?: string): string => {
  if (input) return input;
  const now = new Date();
  const date = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `${date}${random}`;
};

