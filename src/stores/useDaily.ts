import type { Daily } from '@/lib/mappers';

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

const reloadDaily = async (): Promise<Daily[]> => {
  await delay();
  return DAILY_DEMO.map((row) => ({ ...row }));
};

export function useDaily() {
  return {
    data: DAILY_DEMO,
    loading: false,
    error: null as Error | null,
    reload: reloadDaily,
  };
}
