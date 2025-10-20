import {
  type ComplianceRiskFlag,
  type SupportPlanDocument,
  type SupportPlanServiceItem,
} from './entities';

export interface SupportPlanSnapshot {
  userId: string;
  planId: string;
  version: number;
  planEffectiveFrom: string;
  planEffectiveTo: string;
  consentSignedOn?: string;
  assessmentCompletedOn: string;
  lastMonitoringOn?: string;
  monitoringDueOn: string;
  unlinkedActivities: number;
  outstandingActions: {
    requiresMonitoring: boolean;
    hasExpiredPlan: boolean;
    requiresConsentRenewal: boolean;
  };
  linkedServiceItems: SupportPlanServiceItem[];
  riskFlags: ComplianceRiskFlag[];
}

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

type SnapshotOverrides = Partial<Omit<SupportPlanSnapshot, 'outstandingActions' | 'linkedServiceItems' | 'riskFlags'>> & {
  outstandingActions?: Partial<SupportPlanSnapshot['outstandingActions']>;
  linkedServiceItems?: SupportPlanServiceItem[];
  riskFlags?: ComplianceRiskFlag[];
};

const baseServiceItems: SupportPlanServiceItem[] = [
  {
    itemId: 'item-morning',
    title: '朝の身支度支援',
    frequency: '毎日 / 朝',
    responsibleStaffRole: '生活支援員',
    linkedActivityKey: '09:30',
  },
  {
    itemId: 'item-lunch',
    title: '昼食介助と摂取状況確認',
    frequency: '毎日 / 昼',
    responsibleStaffRole: '生活支援員',
    linkedActivityKey: '12:00',
  },
  {
    itemId: 'item-afternoon',
    title: '午後活動の参加支援',
    frequency: '毎日 / 午後',
    responsibleStaffRole: '職業指導員',
    linkedActivityKey: '13:30',
  },
];

const buildSnapshot = (overrides: SnapshotOverrides): SupportPlanSnapshot => {
  const today = new Date();
  const assessment = addDays(today, -90);
  const effectiveFrom = addDays(today, -60);
  const effectiveTo = addDays(effectiveFrom, 180);
  const monitoringDue = addDays(today, -7);

  const base: SupportPlanSnapshot = {
    userId: 'default',
    planId: 'PLAN-DEFAULT',
    version: 1,
    assessmentCompletedOn: toIsoDate(assessment),
    planEffectiveFrom: toIsoDate(effectiveFrom),
    planEffectiveTo: toIsoDate(effectiveTo),
    consentSignedOn: toIsoDate(effectiveFrom),
    lastMonitoringOn: toIsoDate(addDays(today, -40)),
    monitoringDueOn: toIsoDate(monitoringDue),
    unlinkedActivities: 0,
    linkedServiceItems: baseServiceItems,
    outstandingActions: {
      requiresMonitoring: monitoringDue < today,
      hasExpiredPlan: effectiveTo < today,
      requiresConsentRenewal: false,
    },
    riskFlags: [],
  };

  const { outstandingActions: overrideActions, linkedServiceItems, riskFlags, ...rest } = overrides;
  Object.assign(base, rest);

  if (overrideActions) {
    base.outstandingActions = {
      ...base.outstandingActions,
      ...overrideActions,
    };
  }

  if (linkedServiceItems) {
    base.linkedServiceItems = linkedServiceItems;
  }

  if (riskFlags) {
    base.riskFlags = riskFlags;
  }

  // keep derived flags in sync
  base.outstandingActions.hasExpiredPlan = new Date(base.planEffectiveTo) < today;
  base.outstandingActions.requiresMonitoring =
    new Date(base.monitoringDueOn) < today ||
    !!(base.lastMonitoringOn && addDays(new Date(base.lastMonitoringOn), 90) < today);

  base.outstandingActions.requiresConsentRenewal =
    !!base.consentSignedOn && addDays(new Date(base.consentSignedOn), 365) < today;

  return base;
};

const warningFlag = (options: Partial<ComplianceRiskFlag>): ComplianceRiskFlag => ({
  flagId: options.flagId ?? `flag-${Math.random().toString(36).slice(2, 7)}`,
  category: options.category ?? '減算リスク',
  severity: options.severity ?? 'warning',
  message: options.message ?? '要確認',
  detectedOn: options.detectedOn ?? toIsoDate(new Date()),
  relatedUserIds: options.relatedUserIds,
  relatedStaffIds: options.relatedStaffIds,
  relatedPlanIds: options.relatedPlanIds,
});

const snapshots: Record<string, SupportPlanSnapshot> = {
  '001': buildSnapshot({
    userId: '001',
    planId: 'PLAN-001',
    linkedServiceItems: baseServiceItems,
    monitoringDueOn: toIsoDate(addDays(new Date(), 14)),
    outstandingActions: {
      requiresMonitoring: false,
    },
  }),
  '005': buildSnapshot({
    userId: '005',
    planId: 'PLAN-005',
    planEffectiveTo: toIsoDate(addDays(new Date(), -5)),
    unlinkedActivities: 2,
    linkedServiceItems: [
      baseServiceItems[0],
      {
        ...baseServiceItems[1],
        linkedActivityKey: undefined,
      },
      {
        ...baseServiceItems[2],
        linkedActivityKey: undefined,
      },
    ],
    riskFlags: [
      warningFlag({
        flagId: 'expired-plan',
        category: '支援計画失効',
        severity: 'error',
        message: '支援計画の有効期限が切れています。',
        relatedPlanIds: ['PLAN-005'],
        relatedUserIds: ['005'],
      }),
    ],
  }),
  '012': buildSnapshot({
    userId: '012',
    planId: 'PLAN-012',
    monitoringDueOn: toIsoDate(addDays(new Date(), -10)),
    lastMonitoringOn: toIsoDate(addDays(new Date(), -120)),
    outstandingActions: {
      requiresMonitoring: true,
    },
    riskFlags: [
      warningFlag({
        flagId: 'monitoring-overdue',
        category: 'モニタリング期限超過',
        message: 'モニタリングの実施期限を超過しています。',
        relatedPlanIds: ['PLAN-012'],
        relatedUserIds: ['012'],
      }),
    ],
  }),
  '018': buildSnapshot({
    userId: '018',
    planId: 'PLAN-018',
    consentSignedOn: toIsoDate(addDays(new Date(), -400)),
  }),
  '023': buildSnapshot({
    userId: '023',
    planId: 'PLAN-023',
    unlinkedActivities: 1,
    linkedServiceItems: [
      baseServiceItems[0],
      baseServiceItems[1],
      {
        ...baseServiceItems[2],
        linkedActivityKey: undefined,
      },
    ],
  }),
  '030': buildSnapshot({
    userId: '030',
    planId: 'PLAN-030',
    monitoringDueOn: toIsoDate(addDays(new Date(), 3)),
  }),
  '032': buildSnapshot({
    userId: '032',
    planId: 'PLAN-032',
  }),
};

/**
 * Retrieve a lightweight compliance snapshot for個別支援計画.
 * In production this will hydrate from SharePoint lists, but the structure is stable.
 */
export const getMockSupportPlanSnapshot = (userId: string): SupportPlanSnapshot => {
  const source = snapshots[userId] ?? buildSnapshot({ userId, planId: `PLAN-${userId}` });
  return {
    ...source,
    linkedServiceItems: source.linkedServiceItems.map((item) => ({ ...item })),
    outstandingActions: { ...source.outstandingActions },
    riskFlags: source.riskFlags.map((flag) => ({ ...flag })),
  };
};

/**
 * A mocked support-plan document for future integration tests.
 * Keeps parity with existing PlanWizard deploy artifacts.
 */
export const getMockSupportPlanDocument = (userId: string): SupportPlanDocument => {
  const snapshot = getMockSupportPlanSnapshot(userId);
  return {
    planId: snapshot.planId,
    userId: snapshot.userId,
    version: snapshot.version,
    assessmentRecord: {
      assessmentId: `${snapshot.planId}-ASM`,
      conductedOn: snapshot.assessmentCompletedOn,
      assessorName: 'サービス管理責任者A',
      location: '居宅',
      summary: '生活リズムの安定と作業活動への参加意欲を確認。',
    },
    createdByStaffId: 'staff-smr-001',
    draftCreatedOn: snapshot.assessmentCompletedOn,
    approvedOn: snapshot.planEffectiveFrom,
    consentedOn: snapshot.consentSignedOn,
    effectiveFrom: snapshot.planEffectiveFrom,
    effectiveTo: snapshot.planEffectiveTo,
    goals: [
      {
        goalId: `${snapshot.planId}-goal-long`,
        title: '生活リズムの安定',
        description: '規則正しい生活リズムを整え、日中活動に落ち着いて参加できる状態を維持する。',
        category: '長期',
        targetDate: snapshot.planEffectiveTo,
        progressStatus: '進行中',
      },
      {
        goalId: `${snapshot.planId}-goal-short`,
        title: '午後活動での集中時間を延ばす',
        description: '午後の作業活動において集中できる時間を15分から20分に伸ばす。',
        category: '短期',
        targetDate: toIsoDate(addDays(new Date(snapshot.planEffectiveFrom), 90)),
        progressStatus: '進行中',
      },
    ],
    serviceItems: snapshot.linkedServiceItems,
    monitoringLogs: snapshot.lastMonitoringOn
      ? [
          {
            monitoringId: `${snapshot.planId}-mon-01`,
            monitoredOn: snapshot.lastMonitoringOn,
            supervisorName: 'サービス管理責任者A',
            outcome: snapshot.outstandingActions.requiresMonitoring ? '改善提案' : '継続',
            notes: snapshot.outstandingActions.requiresMonitoring
              ? '課題参加時の姿勢が崩れるため、環境調整を提案。'
              : '計画通りに支援が実施されていることを確認。',
          },
        ]
      : [],
  };
};
