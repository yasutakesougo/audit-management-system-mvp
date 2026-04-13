import { type ABCRecord, type BehaviorIntensity, DEFAULT_OBSERVATION_MASTER } from '@/domain/behavior';
import { useCallback, useState } from 'react';
import { getBehaviorRepository, getInMemoryBehaviorRepository } from '../../repositories/sharepoint/behaviorRepositoryFactory';
import { addABCRecord, getABCRecordsForUser } from '@/features/ibd/core/ibdStore';

export function useBehaviorStore() {
  const [data, setData] = useState<ABCRecord[]>([]);
  const [analysisData, setAnalysisData] = useState<ABCRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const repo = getBehaviorRepository();
  const RECENT_LIMIT = 5;

  const ensureDesc = useCallback((items: ABCRecord[]) => {
    return [...items].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );
  }, []);

  const fetchByUser = useCallback(async (userId: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      // Migration Status: Reading from Path-B (ibdStore) as SSOT
      const rawRecords = getABCRecordsForUser(userId);
      
      // Recent sorted records (Descending for history display)
      const normalized = ensureDesc(rawRecords).slice(0, RECENT_LIMIT);
      setData(normalized);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err : new Error('Failed to load behaviors'));
    } finally {
      setLoading(false);
    }
  }, [RECENT_LIMIT, ensureDesc]);

  const add = useCallback(async (record: Omit<ABCRecord, 'id'>) => {
    setLoading(true);
    try {
      const newRecord = await repo.add(record);
      setData((prev) => [newRecord, ...prev]);
      setError(null); // ✅ 成功時のみクリア
      return newRecord;
    } catch (err) {
      console.error(err);
      const error = err instanceof Error ? err : new Error('Failed to add behavior');
      setError(error);
      // 🚨 throw で上に投げる（呼び出し側で try/catch が握ってる）
      throw error;
    } finally {
      setLoading(false);
    }
  }, [repo]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /** Analysis 用: 日付範囲指定で大量データをフェッチ（Daily の RECENT_LIMIT に影響しない） */
  const fetchForAnalysis = useCallback(async (userId: string, days = 30) => {
    if (!userId) return;
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      // Migration Status: Reading from Path-B (ibdStore) as SSOT
      const rawRecords = getABCRecordsForUser(userId);

      // In-memory filter and sort (Ascending for analysis)
      const result = rawRecords
        .filter((r) => {
          const d = new Date(r.recordedAt);
          return d >= startDate && d <= endDate;
        })
        .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

      setAnalysisData(result);
    } catch (err) {
      console.error('[behaviorStore] fetchForAnalysis failed:', err);
      setError(err instanceof Error ? err : new Error('分析データの読込に失敗しました'));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    data,
    analysisData,
    loading,
    error,
    fetchByUser,
    fetchForAnalysis,
    add,
    clearError,
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
  const seeded: ABCRecord[] = [];

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
        recordedAt: eventDate.toISOString(),
        behavior: pickRandom(DEFAULT_OBSERVATION_MASTER.behaviors),
        antecedent: pickRandom(DEFAULT_OBSERVATION_MASTER.antecedents) ?? '',
        antecedentTags: [],
        consequence: pickRandom(DEFAULT_OBSERVATION_MASTER.consequences) ?? '',
        intensity: (Math.floor(Math.random() * 5) + 1) as BehaviorIntensity,
      });
    }
  }

  if (!seeded.length) return 0;

  repo.seed(seeded);
  
  // Migration Status: Sync seeded data to Path-B (ibdStore)
  for (const record of seeded) {
    addABCRecord(record);
  }
  
  return seeded.length;
};
