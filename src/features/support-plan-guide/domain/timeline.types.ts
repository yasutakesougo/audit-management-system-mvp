import type { SupportPlanExportModel } from '../types/export';
import type { SupportPlanDiff } from './diffEngine.types';
import type { ActionTask } from '@/features/action-engine';

export type SupportPlanTimelineEntry = {
  draftId: string;
  date: string; // ISO 8601
  versionLabel: string;
  snapshot: SupportPlanExportModel;
  diffFromPrevious: SupportPlanDiff | null;
};

export type SupportPlanTimelineSummary = {
  totalVersions: number;
  structuralChanges: number;
  criticalSafetyUpdates: number;
  lastStructuralChangeAt: string | null;
  lastCriticalSafetyUpdateAt: string | null;
  stagnantSince: string | null;
  /** 最近完了したアクションタスク */
  completedTasks?: ActionTask[];
};

export type SupportPlanTimeline = {
  entries: SupportPlanTimelineEntry[];
  summary: SupportPlanTimelineSummary;
};
