import type { Daily } from '@/lib/mappers';
import { useCallback, useEffect, useState } from 'react';

const baseDate = new Date();
const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);
const delay = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sanitizeOverrides = <T extends Record<string, unknown>>(input: Partial<T>): Partial<T> =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;

const makeDaily = (id: number, rawOverrides: Partial<Daily>): Daily => {
  const overrides = sanitizeOverrides<Daily>(rawOverrides);
  const date = overrides.date ?? toDateOnly(new Date(baseDate.getTime() - id * 24 * 60 * 60 * 1000));

  const base: Daily = {
    id,
    title: `日次記録 ${id}`,
    date,
    startTime: '09:00',
    endTime: '17:00',
    location: '多目的室',
    staffId: id,
    notes: 'サンプルデータ',
    mealLog: '通常食',
    behaviorLog: '特筆事項なし',
    draft: null,
    status: 'approved',
    userId: id,
    modified: `${date}T18:30:00Z`,
    created: `${date}T08:30:00Z`,
  };

  return {
    ...base,
    ...overrides,
  } as Daily;
};

const DAILY_DEMO: Daily[] = [
  makeDaily(1, { title: '送迎・活動記録', staffId: 101, userId: 201 }),
  makeDaily(2, { title: '昼食サポート', staffId: 102, userId: 202, startTime: '12:00', endTime: '13:30' }),
  makeDaily(3, { title: '個別支援', staffId: 103, userId: 203, notes: '作業訓練を実施' }),
];

/**
 * デモ用の日次記録データを取得する
 * 将来的にはSharePoint APIまたは他のデータソースに差し替え予定
 */
const fetchDailyDemo = async (): Promise<Daily[]> => {
  await delay();
  // 破壊されないように毎回新しいオブジェクトを返す
  return DAILY_DEMO.map((row) => ({ ...row }));
};

/**
 * 日次記録データを管理するReact Hook
 * 状態管理とデータ取得を行い、reload()で実際にUIが更新される
 */
export function useDaily() {
  const [data, setData] = useState<Daily[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 将来的にここをSharePoint/API呼び出しに差し替え
      const rows = await fetchDailyDemo();
      setData(rows);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    loading,
    error,
    reload,
  };
}
