import { getAppConfig } from '@/lib/env';
import { fromZonedTime } from 'date-fns-tz';

export const DEFAULT_TZ = 'Asia/Tokyo';
export const DEFAULT_TZ_CANDIDATES: readonly string[] = ['America/New_York', 'Asia/Tokyo', 'UTC'];

const ALIASES: Record<string, string> = {
  jst: 'Asia/Tokyo',
  jp: 'Asia/Tokyo',
  utc: 'UTC',
};

const hasIntlSupport = (): boolean => typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function';

const normalizeTz = (tz?: string): string | undefined => {
  if (!tz) return undefined;
  const trimmed = tz.trim();
  if (!trimmed) return undefined;
  const alias = ALIASES[trimmed.toLowerCase()];
  return alias ?? trimmed;
};

const intlAcceptsTimeZone = (tz: string): boolean => {
  if (!hasIntlSupport()) return false;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz });
    const resolved = formatter.resolvedOptions().timeZone;
    return typeof resolved === 'string' && resolved.toLowerCase() === tz.toLowerCase();
  } catch {
    return false;
  }
};

const dateFnsAcceptsTimeZone = (tz: string): boolean => {
  try {
    // Attempt to convert a known timestamp using the provided zone. This mirrors
    // how downstream utilities rely on fromZonedTime and will surface invalid
    // IANA identifiers the same way.
    const probe = fromZonedTime('2000-01-01T00:00:00.000', tz);
    return Number.isFinite(probe.getTime());
  } catch {
    return false;
  }
};

export function isValidTimeZone(tz?: string): boolean {
  const normalized = normalizeTz(tz);

  if (!normalized) {
    return false;
  }

  if (hasIntlSupport() && intlAcceptsTimeZone(normalized)) {
    return true;
  }

  // Fallback for environments where Intl is unavailable or lacks the zone data.
  return dateFnsAcceptsTimeZone(normalized);
}

type AssertValidTzOptions = {
  candidates?: string[];
  fallback?: string;
};

function normalizeCandidates(candidates: string[] | undefined): string[] {
  if (!candidates) return [];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeTz(candidate);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

export function assertValidTz(
  tz?: string,
  fallbackOrOptions: string | AssertValidTzOptions = DEFAULT_TZ,
): string {
  const options: AssertValidTzOptions =
    typeof fallbackOrOptions === 'string'
      ? { fallback: fallbackOrOptions }
      : fallbackOrOptions ?? {};

  const primary = normalizeTz(tz);
  const fallback = normalizeTz(options.fallback) ?? DEFAULT_TZ;
  const orderedCandidates = normalizeCandidates(options.candidates);

  if (primary && isValidTimeZone(primary)) {
    return primary;
  }

  if (primary) {
    console.warn(`[scheduleTz] Invalid time zone "${tz}"; falling back to "${fallback}".`);
  }

  const chain = [...orderedCandidates, fallback, DEFAULT_TZ, 'UTC'];
  const seen = new Set<string>();

  for (const candidate of chain) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    if (isValidTimeZone(candidate)) {
      return candidate;
    }
  }

  return 'UTC';
}

const logWarn = (message: string, extra?: unknown): void => {
  // eslint-disable-next-line no-console
  console.warn('[scheduleTz]', message, extra ?? '');
};

const resolveIntlTimeZone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

export function resolveSchedulesTz(): string {
  const { schedulesTz } = getAppConfig();
  const trimmed = schedulesTz?.trim();
  const normalized = normalizeTz(trimmed);

  if (normalized && isValidTimeZone(normalized)) {
    return normalized;
  }

  if (trimmed) {
    logWarn('Invalid VITE_SCHEDULES_TZ configured; attempting Intl fallback.', trimmed);
  }

  const intlTz = resolveIntlTimeZone();
  if (!trimmed && intlTz && isValidTimeZone(intlTz)) {
    logWarn('No VITE_SCHEDULES_TZ set. Using Intl resolved time zone.', intlTz);
    return intlTz;
  }

  if (trimmed && intlTz && isValidTimeZone(intlTz)) {
    logWarn('Using Intl resolved time zone due to invalid configuration.', intlTz);
    return intlTz;
  }

  const resolved = assertValidTz(trimmed, { fallback: DEFAULT_TZ });

  const logTarget = trimmed ?? '';
  if (resolved === DEFAULT_TZ) {
    logWarn('Unable to resolve valid time zone; defaulting to Asia/Tokyo.', logTarget);
  }

  return resolved;
}
