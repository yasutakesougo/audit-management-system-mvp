import { getAppConfig } from '@/lib/env';

const DEFAULT_TZ = 'Asia/Tokyo';

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function assertValidTz(tz: string, fallback: string = DEFAULT_TZ): string {
  if (isValidTimeZone(tz)) {
    return tz;
  }
  if (tz) {
    console.warn(`[scheduleTz] Invalid time zone "${tz}"; falling back to "${fallback}".`);
  }
  if (isValidTimeZone(fallback)) {
    return fallback;
  }
  return DEFAULT_TZ;
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

  if (trimmed && isValidTimeZone(trimmed)) {
    return trimmed;
  }

  if (trimmed) {
    logWarn('Invalid VITE_SCHEDULES_TZ configured; attempting Intl fallback.', trimmed);
  }

  const intlTz = resolveIntlTimeZone();
  if (intlTz && isValidTimeZone(intlTz)) {
    if (!trimmed) {
      logWarn('No VITE_SCHEDULES_TZ set. Using Intl resolved time zone.', intlTz);
    } else {
      logWarn('Using Intl resolved time zone due to invalid configuration.', intlTz);
    }
    return intlTz;
  }

  logWarn('Unable to resolve valid time zone; defaulting to Asia/Tokyo.');
  return DEFAULT_TZ;
}
