const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/**
 * Normalize debug-flag-style values across env strings, runtime overrides, and
 * raw boolean/number primitives. Treats '1' / 'true' / 'yes' / 'on' (case- and
 * whitespace-insensitive) as enabled. Everything else — including undefined,
 * empty strings, '0', 'false', and unrelated numbers — is disabled.
 */
export const isDebugFlag = (value: unknown): boolean => {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return TRUTHY.has(normalized);
};
