import type { BehaviorDateRange, BehaviorQueryOptions, BehaviorRepository } from '../domain/BehaviorRepository';
import type { BehaviorObservation } from '../domain/daily/types';

let inMemoryStore: BehaviorObservation[] = [];

const toTimestamp = (value?: string): number => {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
};

const isWithinRange = (timestamp: string, range?: BehaviorDateRange): boolean => {
  if (!range) return true;
  const target = toTimestamp(timestamp);
  if (!Number.isFinite(target)) return false;
  if (range.from && target < toTimestamp(range.from)) return false;
  if (range.to && target > toTimestamp(range.to)) return false;
  return true;
};

const applyLimit = (items: BehaviorObservation[], options?: BehaviorQueryOptions): BehaviorObservation[] => {
  if (!options?.limit || options.limit <= 0) {
    return items;
  }
  return items.slice(0, options.limit);
};

export class InMemoryBehaviorRepository implements BehaviorRepository {
  async add(observation: Omit<BehaviorObservation, 'id'>): Promise<BehaviorObservation> {
    const newRecord: BehaviorObservation = {
      ...observation,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    inMemoryStore = [newRecord, ...inMemoryStore].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return newRecord;
  }

  async getByUser(userId: string, options?: BehaviorQueryOptions): Promise<BehaviorObservation[]> {
    const dateRange = options?.dateRange;
    const filtered = inMemoryStore.filter(
      (behavior) => behavior.userId === userId && isWithinRange(behavior.timestamp, dateRange),
    );
    return applyLimit(filtered, options);
  }

  public seed(records: BehaviorObservation[]): void {
    if (!records.length) return;
    inMemoryStore = [...records, ...inMemoryStore].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  public reset(): void {
    inMemoryStore = [];
  }
}

export const __debugGetInMemoryBehaviors = (): BehaviorObservation[] => inMemoryStore;
