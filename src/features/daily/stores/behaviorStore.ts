import { BehaviorIntensity, type BehaviorObservation, MOCK_OBSERVATION_MASTER } from '@/features/daily/domain/daily/types';
import { useCallback, useState } from 'react';
import { getBehaviorRepository, getInMemoryBehaviorRepository } from '../infra/behaviorRepositoryFactory';

const buildDateRange = (dateKey?: string) => {
  if (!dateKey) return undefined;
  const parsed = new Date(dateKey);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const start = new Date(parsed);
  start.setHours(0, 0, 0, 0);
  const end = new Date(parsed);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() } as const;
};

export function useBehaviorStore() {
  const [data, setData] = useState<BehaviorObservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const repo = getBehaviorRepository();

  const fetchByUser = useCallback(async (userId: string, dateKey?: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const dateRange = buildDateRange(dateKey);
      const result = await repo.getByUser(userId, dateRange ? { dateRange } : undefined);
      setData(result);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err : new Error('Failed to load behaviors'));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  const add = useCallback(async (record: Omit<BehaviorObservation, 'id'>) => {
    setLoading(true);
    try {
      const newRecord = await repo.add(record);
      setData((prev) => [newRecord, ...prev]);
      return newRecord;
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [repo]);

  return {
    data,
    loading,
    error,
    fetchByUser,
    add,
  } as const;
}

const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]!;

export const seedDemoBehaviors = (userId: string, days = 7): number => {
  const repo = getInMemoryBehaviorRepository();
  if (!repo || !userId) {
    console.warn('[seedDemoBehaviors] Skipped: repository unavailable or user missing');
    return 0;
  }

  const now = new Date();
  const seeded: BehaviorObservation[] = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const baseDate = new Date(now);
    baseDate.setDate(now.getDate() - dayOffset);

    const dailyCount = Math.floor(Math.random() * 6);
    for (let idx = 0; idx < dailyCount; idx += 1) {
      const eventDate = new Date(baseDate);
      const hour = 9 + Math.floor(Math.random() * 9);
      eventDate.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

      seeded.push({
        id: `demo-${userId}-${dayOffset}-${idx}-${eventDate.getTime()}`,
        userId,
        timestamp: eventDate.toISOString(),
        behavior: pickRandom(MOCK_OBSERVATION_MASTER.behaviors),
        antecedent: pickRandom(MOCK_OBSERVATION_MASTER.antecedents) ?? null,
        consequence: pickRandom(MOCK_OBSERVATION_MASTER.consequences) ?? null,
        intensity: (Math.floor(Math.random() * 5) + 1) as BehaviorIntensity,
      });
    }
  }

  if (!seeded.length) return 0;

  repo.seed(seeded);
  return seeded.length;
};
