export function normalizeRange(from?: string | null, to?: string | null): { from: string; to: string } {
  const start = (from ?? '').trim();
  const end = (to ?? '').trim();

  if (!start && !end) {
    return { from: '', to: '' };
  }

  if (start && end && start > end) {
    return { from: end, to: start };
  }

  return { from: start, to: end };
}
