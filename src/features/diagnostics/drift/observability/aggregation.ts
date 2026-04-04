import type { DriftEvent } from '../domain/driftLogic';

export type DriftTopItem = {
  key: string;
  count: number;
};

type DriftEventLike = Partial<DriftEvent> & Record<string, unknown>;

const MAX_TOP_ITEMS = 5;

const asEventLike = (value: unknown): DriftEventLike | null => {
  if (!value || typeof value !== 'object') return null;
  return value as DriftEventLike;
};

const normalizeKey = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const rankTopCounts = (counts: Map<string, number>, limit: number): DriftTopItem[] =>
  Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);

const countByKey = (
  events: readonly unknown[],
  pick: (event: DriftEventLike) => string | null,
  limit: number,
): DriftTopItem[] => {
  const counts = new Map<string, number>();
  for (const raw of events) {
    const event = asEventLike(raw);
    if (!event) continue;

    const key = pick(event);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return rankTopCounts(counts, limit);
};

export const aggregateTopDriftFields = (
  events: readonly unknown[],
  limit: number = MAX_TOP_ITEMS,
): DriftTopItem[] =>
  countByKey(events, (event) => normalizeKey(event.fieldName), limit);

export const aggregateTopDriftLists = (
  events: readonly unknown[],
  limit: number = MAX_TOP_ITEMS,
): DriftTopItem[] =>
  countByKey(events, (event) => normalizeKey(event.listName), limit);

const hasResolutionSignal = (event: DriftEventLike): boolean =>
  Object.prototype.hasOwnProperty.call(event, 'resolved') ||
  Object.prototype.hasOwnProperty.call(event, 'fieldName') ||
  Object.prototype.hasOwnProperty.call(event, 'listName');

const isResolvedTruthy = (value: unknown): boolean => {
  if (value === true) return true;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
};

export const aggregateUnresolvedCount = (events: readonly unknown[]): number => {
  let count = 0;

  for (const raw of events) {
    const event = asEventLike(raw);
    if (!event || !hasResolutionSignal(event)) continue;

    const listName = normalizeKey(event.listName);
    const fieldName = normalizeKey(event.fieldName);
    const resolved = isResolvedTruthy(event.resolved);
    const missingIdentity = !listName || !fieldName;

    if (!resolved || missingIdentity) {
      count += 1;
    }
  }

  return count;
};
