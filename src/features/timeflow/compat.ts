import { DailySupportRecord, SupportRecord } from '../support/types';
import { SupportActivityTemplate } from '../planDeployment/supportFlow';

/**
 * 既存の軽量モック（TimeFlow v1）が保持している日次記録を、
 * 新 UI（v2）が想定するリッチな構造に変換するための互換アダプタ。
 */

export interface AbcSnapshot {
  antecedent?: string;
  behavior?: string;
  consequence?: string;
  intensity?: string;
}

export interface RichSupportRecord extends SupportRecord {
  /**
   * v2 UI がキーとして利用する activityKey。
   * 旧データに無い場合は timeSlot から派生させる。
   */
  activityKey: string;
  activityName?: string;
  abc?: AbcSnapshot | null;
}

export interface SupportPlanSnapshot {
  planEffectiveFrom: string;
  planEffectiveTo: string;
  monitoringDueOn: string;
  consentSignedOn?: string;
  outstandingActions: {
    hasExpiredPlan: boolean;
    requiresMonitoring: boolean;
    requiresConsentRenewal: boolean;
  };
  riskFlags: Array<{ flagId: string; message: string; severity: 'info' | 'warning' | 'error' }>;
  unlinkedActivities: number;
}

export interface DailyRecordSummary {
  totalTimeSlots: number;
  recordedTimeSlots: number;
  concerningIncidents: number;
  achievementHighlights: number;
  overallProgress: string;
}

export type RichDailySupportRecord = Omit<DailySupportRecord, 'records'> & {
  records: RichSupportRecord[];
  summary: DailyRecordSummary;
  dailyNotes: string;
  completedBy?: string;
  completedAt?: string;
  status?: '作成中' | '確定' | '下書き' | '未記録';
  supportPlanSnapshot?: SupportPlanSnapshot | null;
};

const defaultSummary = (totalTimeSlots: number, recordedTimeSlots: number): DailyRecordSummary => ({
  totalTimeSlots,
  recordedTimeSlots,
  concerningIncidents: 0,
  achievementHighlights: recordedTimeSlots,
  overallProgress: recordedTimeSlots === 0 ? '未着手' : '良好',
});

const defaultSnapshot: SupportPlanSnapshot = {
  planEffectiveFrom: '',
  planEffectiveTo: '',
  monitoringDueOn: '',
  outstandingActions: {
    hasExpiredPlan: false,
    requiresMonitoring: false,
    requiresConsentRenewal: false,
  },
  riskFlags: [],
  unlinkedActivities: 0,
};

/**
 * 旧データから v2 用のアクティビティキーを導出する。
 */
const deriveActivityKey = (record: SupportRecord, fallbackKey: string): string => {
  const legacyKey = (record as unknown as { activityKey?: string }).activityKey;
  if (legacyKey && typeof legacyKey === 'string') {
    return legacyKey;
  }
  return fallbackKey;
};

import { isDevMode } from '@/lib/env';

const incrementDebugCounter = (label: string): void => {
  if (!isDevMode()) return;
  if (typeof window === 'undefined') return;
  const target = (window as { __TIMEFLOW_DBG__?: Record<string, number> }).__TIMEFLOW_DBG__;
  if (!target) return;
  target[label] = (target[label] ?? 0) + 1;
};

/**
 * TimeFlow v1 の DailySupportRecord を v2 UI が利用しやすい形に整形する。
 */
export const toRichDailyRecord = (
  record: DailySupportRecord,
  activities: SupportActivityTemplate[]
): RichDailySupportRecord => {
  const activityMap = new Map<string, SupportActivityTemplate>();
  activities.forEach((activity) => activityMap.set(String(activity.time), activity));

  const richRecords = record.records.map((entry, index) => {
    const activity = activityMap.get(String(entry.timeSlot));
    const activityKey = deriveActivityKey(entry, `legacy:${entry.timeSlot ?? index}`);
    if (!('activityKey' in entry) || !(entry as { activityKey?: string }).activityKey) {
      incrementDebugCounter('filled.activityKey');
    }
    const abc = (entry as unknown as { abc?: AbcSnapshot | null }).abc ?? null;

    return {
      ...entry,
      activityKey,
      activityName: activity?.title ?? String(entry.timeSlot),
      abc,
    };
  });

  const recordedCount = richRecords.filter((r) => r.status === '記録済み').length;
  const summarySource = (record as unknown as { summary?: DailyRecordSummary }).summary;
  if (!summarySource) {
    incrementDebugCounter('filled.summary');
  }
  const summary = summarySource ?? defaultSummary(activities.length, recordedCount);

  const dailyNotes = (record as unknown as { dailyNotes?: string }).dailyNotes ?? '';
  const completedBy = (record as unknown as { completedBy?: string }).completedBy;
  const completedAt = (record as unknown as { completedAt?: string }).completedAt;
  const status = (record as unknown as { status?: RichDailySupportRecord['status'] }).status ?? '未記録';
  if (!(record as { status?: unknown }).status) {
    incrementDebugCounter('filled.status');
  }
  const snapshotSource =
    (record as unknown as { supportPlanSnapshot?: SupportPlanSnapshot | null }).supportPlanSnapshot ?? null;
  if (!snapshotSource) {
    incrementDebugCounter('filled.snapshot');
  }

  return {
    ...record,
    records: richRecords,
    summary,
    dailyNotes,
    completedBy,
    completedAt,
    status,
    supportPlanSnapshot: snapshotSource ?? defaultSnapshot,
  };
};
