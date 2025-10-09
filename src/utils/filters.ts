export function buildSearchParams<T extends Record<string, unknown>>(input: T): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(input)) {
    if (raw === undefined || raw === null) {
      continue;
    }
    if (Array.isArray(raw)) {
      for (const value of raw) {
        if (value === undefined || value === null) continue;
        params.append(key, String(value));
      }
      continue;
    }
    params.set(key, String(raw));
  }
  return params;
}

export function normalizeFilters<T>(input: T): T {
  return input;
}
