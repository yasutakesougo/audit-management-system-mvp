import type { ComplianceRiskFlag } from '@/domain/compliance/entities';

export type ProcedureMonitoringSnapshot = {
  userId: string;
  procedureId: string;
  planVersion: string;
  lastReviewOn?: string | null;
  nextReviewDueOn: string;
  lastUpdatedAt: string;
  reviewerName: string;
  coachName?: string | null;
  cycleDays: number;
  incidentCounts: {
    last30Days: number;
    last90Days: number;
  };
  outstandingActions: {
    requiresPlanUpdate: boolean;
    requiresTeamDebrief: boolean;
    requiresCoachTraining: boolean;
  };
  focusNotes?: string;
  riskFlags?: ComplianceRiskFlag[];
};

const ISO_DATE = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const toIsoDate = (date: Date) => ISO_DATE.format(date);

const addDays = (source: Date, amount: number) => {
  const next = new Date(source);
  next.setDate(next.getDate() + amount);
  return next;
};

type SnapshotOverrides = Partial<ProcedureMonitoringSnapshot>;

const buildSnapshot = (overrides: SnapshotOverrides): ProcedureMonitoringSnapshot => {
  const today = new Date();
  const defaultReview = addDays(today, -65); // 約2ヶ月前にレビュー
  const base: ProcedureMonitoringSnapshot = {
    userId: 'default',
    procedureId: 'PROC-DEFAULT',
    planVersion: 'v1',
    lastReviewOn: toIsoDate(defaultReview),
    nextReviewDueOn: toIsoDate(addDays(defaultReview, 90)),
    lastUpdatedAt: toIsoDate(addDays(today, -14)),
    reviewerName: 'サービス管理責任者A',
    coachName: '支援員チームA',
    cycleDays: 90,
    incidentCounts: {
      last30Days: 0,
      last90Days: 1,
    },
    outstandingActions: {
      requiresPlanUpdate: false,
      requiresTeamDebrief: false,
      requiresCoachTraining: false,
    },
    focusNotes: '次期レビューでは環境調整（感覚過敏対策）の継続効果を確認予定。',
    riskFlags: [],
  };

  return {
    ...base,
    ...overrides,
    incidentCounts: {
      ...base.incidentCounts,
      ...overrides.incidentCounts,
    },
    outstandingActions: {
      ...base.outstandingActions,
      ...overrides.outstandingActions,
    },
    riskFlags: overrides.riskFlags ?? base.riskFlags,
  };
};

const snapshots: Record<string, ProcedureMonitoringSnapshot> = {
  '023': buildSnapshot({
    userId: '023',
    procedureId: 'PROC-023',
    planVersion: 'v3',
    lastReviewOn: toIsoDate(addDays(new Date(), -78)),
    nextReviewDueOn: toIsoDate(addDays(new Date(), 12)),
    lastUpdatedAt: toIsoDate(addDays(new Date(), -5)),
    reviewerName: 'サービス管理責任者B',
    coachName: '行動支援専門員チーム',
    incidentCounts: {
      last30Days: 1,
      last90Days: 4,
    },
    outstandingActions: {
      requiresPlanUpdate: false,
      requiresTeamDebrief: true,
      requiresCoachTraining: false,
    },
    focusNotes: '感覚過敏への環境調整は効果あり。次フェーズは個別強化子の見直しが必要。',
  }),
  '030': buildSnapshot({
    userId: '030',
    procedureId: 'PROC-030',
    planVersion: 'v2',
    lastReviewOn: toIsoDate(addDays(new Date(), -95)),
    nextReviewDueOn: toIsoDate(addDays(new Date(), -5)),
    lastUpdatedAt: toIsoDate(addDays(new Date(), -35)),
    reviewerName: 'サービス管理責任者A',
    coachName: '行動支援専門員サポート班',
    incidentCounts: {
      last30Days: 2,
      last90Days: 6,
    },
    outstandingActions: {
      requiresPlanUpdate: true,
      requiresTeamDebrief: true,
      requiresCoachTraining: true,
    },
    focusNotes: '危機対応場面での事後支援手順が形骸化。次回レビューまでに現場ヒアリングが必要。',
  }),
};

export const getMockProcedureMonitoringSnapshot = (userId: string): ProcedureMonitoringSnapshot => {
  const snapshot = snapshots[userId] ?? buildSnapshot({ userId, procedureId: `PROC-${userId}` });
  return {
    ...snapshot,
    incidentCounts: { ...snapshot.incidentCounts },
    outstandingActions: { ...snapshot.outstandingActions },
    riskFlags: snapshot.riskFlags?.map((flag) => ({ ...flag })),
  };
};
