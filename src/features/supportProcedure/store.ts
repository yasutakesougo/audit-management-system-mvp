import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SupportStrategyStage } from '@/features/planDeployment/supportFlow';

export type SupportProcedureRecord = {
  userId: string;
  date: string;
  activityTime: string;
  activityTitle: string;
  stage: SupportStrategyStage;
  mood: string;
  notes: string;
  includeAbc: boolean;
  abc?: {
    antecedent?: string;
    behavior?: string;
    consequence?: string;
  };
  recordedAt: string;
};

export type SupportProcedureSummary = {
  recordedCount: number;
  abcCount: number;
  stageCounts: Record<SupportStrategyStage, number>;
  lastRecordedAt?: string | null;
};

export type SupportProcedureRecordInput = Omit<SupportProcedureRecord, 'recordedAt'> & {
  recordedAt?: string;
};

type SupportProcedureState = {
  records: Record<string, SupportProcedureRecord>;
  version: number;
  upsertRecord: (input: SupportProcedureRecordInput) => void;
  clearRecord: (userId: string, date: string, activityTime: string) => void;
  getRecordsFor: (userId: string, date: string) => SupportProcedureRecord[];
  getDailySummary: (userId: string, date: string) => SupportProcedureSummary;
};

const STORAGE_KEY = 'support-procedure-records.v1';

const buildKey = (userId: string, date: string, activityTime: string) =>
  `${userId}::${date}::${activityTime}`;

const EMPTY_SUMMARY: SupportProcedureSummary = {
  recordedCount: 0,
  abcCount: 0,
  stageCounts: {
    proactive: 0,
    earlyResponse: 0,
    crisisResponse: 0,
    postCrisis: 0,
  },
  lastRecordedAt: null,
};

export const useSupportProcedureStore = create<SupportProcedureState>()(
  persist(
    (set, get) => ({
      records: {},
      version: 0,
      upsertRecord: (input) => {
        const record: SupportProcedureRecord = {
          ...input,
          recordedAt: input.recordedAt ?? new Date().toISOString(),
        };
        set((state) => ({
          records: {
            ...state.records,
            [buildKey(record.userId, record.date, record.activityTime)]: record,
          },
          version: state.version + 1,
        }));
      },
      clearRecord: (userId, date, activityTime) => {
        set((state) => {
          const nextRecords = { ...state.records };
          delete nextRecords[buildKey(userId, date, activityTime)];
          return {
            records: nextRecords,
            version: state.version + 1,
          };
        });
      },
      getRecordsFor: (userId, date) => {
        return Object.values(get().records).filter(
          (record) => record.userId === userId && record.date === date,
        );
      },
      getDailySummary: (userId, date) => {
        const records = get().getRecordsFor(userId, date);
        if (records.length === 0) {
          return { ...EMPTY_SUMMARY };
        }
        const summary: SupportProcedureSummary = {
          recordedCount: records.length,
          abcCount: records.filter((record) => record.includeAbc).length,
          stageCounts: {
            proactive: 0,
            earlyResponse: 0,
            crisisResponse: 0,
            postCrisis: 0,
          },
          lastRecordedAt: null,
        };
        records.forEach((record) => {
          summary.stageCounts[record.stage] = (summary.stageCounts[record.stage] ?? 0) + 1;
          if (!summary.lastRecordedAt || record.recordedAt > summary.lastRecordedAt) {
            summary.lastRecordedAt = record.recordedAt;
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
