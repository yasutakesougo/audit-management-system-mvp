import { getAppConfig } from '@/lib/env';
import { fromZonedTime } from 'date-fns-tz';

export const DEFAULT_TZ = 'Asia/Tokyo';
export const DEFAULT_TZ_CANDIDATES: readonly string[] = ['America/New_York', 'Asia/Tokyo', 'UTC'];

const ALIASES: Record<string, string> = {
  jst: 'Asia/Tokyo',
  jp: 'Asia/Tokyo',
  japan: 'Asia/Tokyo',
  utc: 'UTC',
  est: 'America/New_York',
  pst: 'America/Los_Angeles',
  gmt: 'UTC',
};

/**
 * ICU の canonical timezone ID へのマッピング
 * 将来的に Intl が返す canonical ID との差異を吸収するために使用
 */
const _CANONICAL_MAPPINGS: Record<string, string> = {
  // 将来拡張: 'Europe/Belfast' -> 'Europe/London' など
  // 現在は必要最小限のみ定義
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
    // If Intl accepts the option without throwing, treat it as usable even on minimal ICU builds.
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
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
  if (dateFnsAcceptsTimeZone(normalized)) {
    return true;
  }

  // As a last resort, trust a small whitelist of safe candidates even if the runtime cannot validate them.
  return DEFAULT_TZ_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized.toLowerCase());
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
  // DEFAULT_TZ_CANDIDATES をデフォルト候補として統合
  const orderedCandidates = normalizeCandidates(
    options.candidates ?? [...DEFAULT_TZ_CANDIDATES]
  );

  if (primary && isValidTimeZone(primary)) {
    return primary;
  }

  if (primary) {
    console.warn(`[scheduleTz] Invalid time zone "${tz}"; falling back to "${fallback}".`);
  }

  const chain = [fallback, DEFAULT_TZ, ...orderedCandidates, 'UTC'];
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
  if (!hasIntlSupport()) return undefined;

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
