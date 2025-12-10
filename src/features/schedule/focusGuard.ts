const DEFAULT_FOCUS_GUARD_MS = 12_000;

function getOverride(): number | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const scope = window as typeof window & { __FOCUS_GUARD_MS__?: unknown };
  const raw = scope.__FOCUS_GUARD_MS__;
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

export const FOCUS_GUARD_MS = getOverride() ?? DEFAULT_FOCUS_GUARD_MS;
