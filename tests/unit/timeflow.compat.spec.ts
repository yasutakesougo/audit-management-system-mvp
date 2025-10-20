import { describe, expect, it } from 'vitest';

import { toRichDailyRecord } from '@/features/timeflow/compat';
import {
  fallbackSupportActivities as DEFAULT_FLOW_MASTER_ACTIVITIES,
  type SupportActivityTemplate,
} from '@/features/planDeployment/supportFlow';
import type {
  DailySupportRecord,
  SupportRecord,
  SupportRecordTimeSlot,
} from '@/features/support/types';

const createSupportRecord = (
  overrides: Partial<SupportRecord> = {}
): SupportRecord => ({
  id: overrides.id ?? 'support-record-1',
  supportPlanId: overrides.supportPlanId ?? 'plan-001',
  personId: overrides.personId ?? '001',
  personName: overrides.personName ?? '田中太郎',
  date: overrides.date ?? '2025-01-15',
  timeSlot: overrides.timeSlot ?? ('09:00' as unknown as SupportRecordTimeSlot),
  userActivities:
    overrides.userActivities ?? {
      planned: '予定された活動',
      actual: '',
      notes: '',
    },
  staffActivities:
    overrides.staffActivities ?? {
      planned: '予定された支援',
      actual: '',
      notes: '',
    },
  userCondition:
    overrides.userCondition ?? {
      mood: '普通',
      behavior: '',
      communication: '',
      physicalState: '',
    },
  specialNotes:
    overrides.specialNotes ?? {
      incidents: '',
      concerns: '',
      achievements: '',
      nextTimeConsiderations: '',
    },
  reporter:
    overrides.reporter ?? {
      name: '支援員A',
      role: '生活支援員',
    },
  executionStatus: overrides.executionStatus,
  status: overrides.status ?? '未記録',
  createdAt: overrides.createdAt ?? '2025-01-15T09:00:00+09:00',
  updatedAt: overrides.updatedAt ?? '2025-01-15T09:00:00+09:00',
});

const createDailySupportRecord = (
  overrides: Partial<DailySupportRecord> = {},
  activities: SupportActivityTemplate[] = DEFAULT_FLOW_MASTER_ACTIVITIES
): DailySupportRecord => ({
  id: overrides.id ?? 'daily-record-001',
  personId: overrides.personId ?? '001',
  personName: overrides.personName ?? '田中太郎',
  date: overrides.date ?? '2025-01-15',
  records:
    overrides.records ??
    activities.slice(0, 2).map((activity, index) =>
      createSupportRecord({
        id: `support-${index}`,
        timeSlot: activity.time as unknown as SupportRecordTimeSlot,
      })
    ),
  createdAt: overrides.createdAt ?? '2025-01-15T09:00:00+09:00',
  updatedAt: overrides.updatedAt ?? '2025-01-15T09:00:00+09:00',
});

describe('features/timeflow/compat', () => {
  it('fills missing fields and derives sensible defaults', () => {
    const dailyRecord = createDailySupportRecord();

    const rich = toRichDailyRecord(dailyRecord, DEFAULT_FLOW_MASTER_ACTIVITIES);

    expect(rich.summary.totalTimeSlots).toBe(DEFAULT_FLOW_MASTER_ACTIVITIES.length);
    expect(rich.summary.recordedTimeSlots).toBe(0);
    expect(rich.records).toHaveLength(dailyRecord.records.length);
    expect(rich.records[0].activityKey).toBe(`legacy:${dailyRecord.records[0].timeSlot}`);
    expect(rich.records[0].activityName).toBe(DEFAULT_FLOW_MASTER_ACTIVITIES[0].title);
    expect(rich.supportPlanSnapshot).toBeTruthy();
  });

  it('preserves rich fields when provided by upstream data', () => {
    const snapshot = {
      planEffectiveFrom: '2024-12-01',
      planEffectiveTo: '2025-03-31',
      monitoringDueOn: '2025-02-15',
      consentSignedOn: '2024-12-05',
      outstandingActions: {
        hasExpiredPlan: true,
        requiresMonitoring: false,
        requiresConsentRenewal: false,
      },
      riskFlags: [{ flagId: 'alert', message: '要重点観察', severity: 'warning' as const }],
      unlinkedActivities: 1,
    };

    const dailyRecord = {
      ...createDailySupportRecord(),
      summary: {
        totalTimeSlots: 6,
        recordedTimeSlots: 4,
        concerningIncidents: 1,
        achievementHighlights: 2,
        overallProgress: '順調',
      },
      supportPlanSnapshot: snapshot,
      dailyNotes: '追加メモ',
      status: '確定',
    } as unknown as DailySupportRecord;

    const rich = toRichDailyRecord(dailyRecord, DEFAULT_FLOW_MASTER_ACTIVITIES);

    expect(rich.summary.overallProgress).toBe('順調');
    expect(rich.supportPlanSnapshot?.planEffectiveFrom).toBe('2024-12-01');
    expect(rich.supportPlanSnapshot?.outstandingActions.hasExpiredPlan).toBe(true);
    expect(rich.status).toBe('確定');
    expect(rich.dailyNotes).toBe('追加メモ');
  });
});
