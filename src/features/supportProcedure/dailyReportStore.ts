import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExecutionStatus } from '@/features/support/types';

export type DailyReportStatus = '未作成' | '作成中' | '完了';
export type MealAmountOption = '完食' | '8割' | '半量' | '少なめ' | '欠食';
export type ProblemBehaviorOption = 'あり' | 'なし';

export type DailyReportRecord = {
  userId: string;
  date: string;
  reporterName: string;
  amActivities: string[];
  pmActivities: string[];
  amNotes: string;
  pmNotes: string;
  specialNotes: string;
  mealMain: MealAmountOption;
  mealSide: MealAmountOption;
  problemBehavior: ProblemBehaviorOption;
  problemBehaviorNotes?: string;
  activityExecution: Record<string, ExecutionStatus>;
  status: DailyReportStatus;
  lastSavedAt: string;
  alerts: {
    hasProblemBehavior: boolean;
  };
};

export type DailyReportDraftInput = Omit<DailyReportRecord, 'status' | 'lastSavedAt' | 'alerts'> & {
  status?: DailyReportStatus;
  lastSavedAt?: string;
};


type DailyReportSummary = {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
};

type DailyReportState = {
  records: Record<string, DailyReportRecord>;
  version: number;
  upsertDraft: (input: DailyReportDraftInput) => void;
  markComplete: (input: DailyReportDraftInput) => void;
  clear: (userId: string, date: string) => void;
  getReport: (userId: string, date: string) => DailyReportRecord | null;
  getStatus: (userId: string, date: string) => DailyReportStatus;
  getSummaryForDate: (date: string) => DailyReportSummary;
};

const STORAGE_KEY = 'daily-report-records.v1';

const buildKey = (userId: string, date: string) => `${userId}::${date}`;

const EMPTY_SUMMARY: DailyReportSummary = {
  total: 0,
  completed: 0,
  inProgress: 0,
  notStarted: 0,
};

const resolveStatus = (requested?: DailyReportStatus): DailyReportStatus => {
  if (!requested) return '作成中';
  return requested;
};

const cloneExecution = (execution?: Record<string, ExecutionStatus>) => {
  if (!execution) {
    return {};
  }
  return Object.entries(execution).reduce<Record<string, ExecutionStatus>>((acc, [key, value]) => {
    acc[key] = {
      client: { ...value.client },
      supporter: { ...value.supporter },
      followUp: value.followUp ? { ...value.followUp } : undefined,
    };
    return acc;
  }, {});
};

const createRecord = (input: DailyReportDraftInput, status: DailyReportStatus): DailyReportRecord => {
  const lastSavedAt = input.lastSavedAt ?? new Date().toISOString();
  return {
    ...input,
    activityExecution: cloneExecution(input.activityExecution),
    status,
    lastSavedAt,
    alerts: {
      hasProblemBehavior: input.problemBehavior === 'あり',
    },
  };
};

export const useDailyReportStore = create<DailyReportState>()(
  persist(
    (set, get) => ({
      records: {},
      version: 0,
      upsertDraft: (input) => {
        if (!input.userId || !input.date) {
          return;
        }
        const status = resolveStatus(input.status);
        const record = createRecord(input, status === '完了' ? '完了' : '作成中');
        const key = buildKey(record.userId, record.date);
        set((state) => ({
          records: {
            ...state.records,
            [key]: {
              ...(state.records[key] ?? record),
              ...record,
            },
          },
          version: state.version + 1,
        }));
      },
      markComplete: (input) => {
        if (!input.userId || !input.date) {
          return;
        }
        const key = buildKey(input.userId, input.date);
        const existing = get().records[key];
        const base = existing ?? createRecord(input, '完了');
        const record = createRecord(
          {
            ...base,
            ...input,
            status: '完了',
            lastSavedAt: new Date().toISOString(),
          },
          '完了',
        );
        set((state) => ({
          records: {
            ...state.records,
            [key]: record,
          },
          version: state.version + 1,
        }));
      },
      clear: (userId, date) => {
        const key = buildKey(userId, date);
        set((state) => {
          if (!state.records[key]) {
            return state;
          }
          const next = { ...state.records };
          delete next[key];
          return {
            records: next,
            version: state.version + 1,
          };
        });
      },
      getReport: (userId, date) => {
        return get().records[buildKey(userId, date)] ?? null;
      },
      getStatus: (userId, date) => {
        const record = get().records[buildKey(userId, date)];
        return record?.status ?? '未作成';
      },
      getSummaryForDate: (date) => {
        if (!date) {
          return { ...EMPTY_SUMMARY };
        }
        const records = Object.values(get().records).filter((record) => record.date === date);
        if (records.length === 0) {
          return { ...EMPTY_SUMMARY };
        }
        const summary: DailyReportSummary = {
          total: records.length,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
        };
        records.forEach((record) => {
          if (record.status === '完了') {
            summary.completed += 1;
          } else if (record.status === '作成中') {
            summary.inProgress += 1;
          } else {
            summary.notStarted += 1;
          }
        });
        return summary;
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        records: state.records,
      }),
    },
  ),
);
