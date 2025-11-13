export type MinuteBasis = 'utc' | 'local';

const pad = (value: number) => String(value).padStart(2, '0');

const makeUtcRange = (date: Date) => {
  const start = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    0,
    0,
  ));
  const end = new Date(start.getTime() + 60_000);
  return [start, end] as const;
};

const makeLocalRange = (date: Date) => {
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    0,
    0,
  );
  const end = new Date(start.getTime() + 60_000);
  return [start, end] as const;
};

const readGlobalOverride = (): MinuteBasis | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const override = (window as typeof window & { __NURSE_MINUTE_BASIS__?: MinuteBasis }).__NURSE_MINUTE_BASIS__;
  if (override === 'local' || override === 'utc') {
    return override;
  }
  return null;
};

const resolveMinuteBasis = (): MinuteBasis => {
  const override = readGlobalOverride();
  if (override) {
    return override;
  }
  try {
    const raw = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_NURSE_MINUTE_BASIS;
    return raw === 'local' ? 'local' : 'utc';
  } catch {
    return 'utc';
  }
};

export function minuteWindow(iso?: string, basis?: MinuteBasis) {
  const initial = iso ? new Date(iso) : new Date();
  const resolvedBasis = basis ?? resolveMinuteBasis();
  const [start, end] = resolvedBasis === 'utc' ? makeUtcRange(initial) : makeLocalRange(initial);
  return [start.toISOString(), end.toISOString()] as const;
}

export function minuteLabel(iso: string, basis?: MinuteBasis) {
  const date = new Date(iso);
  const resolvedBasis = basis ?? resolveMinuteBasis();
  const year = resolvedBasis === 'utc' ? date.getUTCFullYear() : date.getFullYear();
  const month = resolvedBasis === 'utc' ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const day = resolvedBasis === 'utc' ? date.getUTCDate() : date.getDate();
  const hours = resolvedBasis === 'utc' ? date.getUTCHours() : date.getHours();
  const minutes = resolvedBasis === 'utc' ? date.getUTCMinutes() : date.getMinutes();

  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
}

export function getMinuteBasis(): MinuteBasis {
  return resolveMinuteBasis();
}
