type MergeCandidate = { id?: unknown; Id?: unknown; ID?: unknown };

const toKey = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const resolveKey = (item: MergeCandidate | null | undefined, fallback: string): string => {
  if (!item || typeof item !== 'object') {
    return fallback;
  }
  const key = toKey(item.id) ?? toKey(item.Id) ?? toKey(item.ID);
  return key ?? fallback;
};

/**
 * Merge two collections by `id`, preferring the override array when identifiers collide.
 */
export function mergeById<T extends MergeCandidate>(base: readonly T[], overrides: readonly T[]): T[] {
  const map = new Map<string, T>();
  const order: string[] = [];
  const seen = new Set<string>();

  const register = (key: string, value: T) => {
    if (!seen.has(key)) {
      seen.add(key);
      order.push(key);
    }
    map.set(key, value);
  };

  base.forEach((item, index) => {
    const key = resolveKey(item, `base-${index}`);
    register(key, item);
  });

  overrides.forEach((item, index) => {
    const key = resolveKey(item, `override-${index}`);
    register(key, item);
  });

  return order.map((key) => map.get(key)!).filter((value): value is T => value !== undefined);
}
