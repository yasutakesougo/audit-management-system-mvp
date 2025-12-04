type Mergeable = { id: string | number };

const toKey = (id: Mergeable['id']): string => {
  if (typeof id === 'number') {
    return Number.isFinite(id) ? String(id) : '';
  }
  return id ?? '';
};

/**
 * Merge schedule collections by `id`, giving precedence to drafts when collisions occur.
 * Keeps the original fetched ordering for stable UI rendering.
 */
export const mergeById = <Fetched extends Mergeable, Draft extends Mergeable>(
  fetched: readonly Fetched[],
  drafts: readonly Draft[],
): Array<Fetched | Draft> => {
  const merged = new Map<string, Fetched | Draft>();

  fetched.forEach((item) => {
    const key = toKey(item.id);
    if (!key) return;
    merged.set(key, item);
  });

  drafts.forEach((item) => {
    const key = toKey(item.id);
    if (!key) return;
    merged.set(key, item);
  });

  return Array.from(merged.values());
};
