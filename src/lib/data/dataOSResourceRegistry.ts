import { 
  BEHAVIOR_MONITORING_LIST_TITLE, 
  BEHAVIOR_MONITORING_CANDIDATES,
  PLANNING_SHEET_REASSESSMENT_LIST_TITLE,
  REASSESSMENT_CANDIDATES
} from '@/sharepoint/fields/pdcaCycleFields';
import {
  ATTENDANCE_DAILY_LIST_TITLE,
  ATTENDANCE_DAILY_ENSURE_FIELDS,
} from '@/sharepoint/fields/attendanceFields';
import {
  NURSE_OBSERVATIONS_LIST_TITLE,
  NURSE_OBSERVATIONS_ENSURE_FIELDS,
} from '@/sharepoint/fields/nurseObservationFields';
import {
  SCHEDULE_ENSURE_FIELDS,
} from '@/sharepoint/fields/scheduleFields';
import {
  SUPPORT_PLANS_LIST_TITLE,
  SUPPORT_PLANS_ENSURE_FIELDS,
} from '@/sharepoint/fields/supportPlanFields';
import {
  PLAN_GOAL_LIST_TITLE,
  PLAN_GOAL_ENSURE_FIELDS,
} from '@/sharepoint/fields/planGoalFields';
import type { SpFieldDef } from '@/lib/sp/types';

export interface ResourceDefinition {
  resourceName: string;
  defaultListTitle: string;
  fields: SpFieldDef[];
}

/**
 * Data OS Resource Registry
 * 
 * すべてのリソース名（resourceName）とその標準スキーマを定義する。
 * Self-Healing 機能（自動修復）のマスターデータとして使用される。
 */
export const DATA_OS_RESOURCE_REGISTRY: Record<string, ResourceDefinition> = {
  BehaviorMonitoring: {
    resourceName: 'BehaviorMonitoring',
    defaultListTitle: BEHAVIOR_MONITORING_LIST_TITLE,
    fields: Object.entries(BEHAVIOR_MONITORING_CANDIDATES).map(([key, candidates]) => ({
      internalName: (candidates as unknown as string[])[0],
      displayName: key,
      type: key.endsWith('Json') ? 'Note' : 'Text',
    })),
  },
  PlanningSheetReassessment: {
    resourceName: 'PlanningSheetReassessment',
    defaultListTitle: PLANNING_SHEET_REASSESSMENT_LIST_TITLE,
    fields: Object.entries(REASSESSMENT_CANDIDATES).map(([key, candidates]) => ({
      internalName: (candidates as unknown as string[])[0],
      displayName: key,
      type: key.endsWith('Json') ? 'Note' : 'Text',
    })),
  },
  AttendanceDaily: {
    resourceName: 'AttendanceDaily',
    defaultListTitle: ATTENDANCE_DAILY_LIST_TITLE,
    fields: [...ATTENDANCE_DAILY_ENSURE_FIELDS] as SpFieldDef[],
  },
  NurseObservations: {
    resourceName: 'NurseObservations',
    defaultListTitle: NURSE_OBSERVATIONS_LIST_TITLE,
    fields: [...NURSE_OBSERVATIONS_ENSURE_FIELDS] as SpFieldDef[],
  },
  Schedule: {
    resourceName: 'Schedule',
    defaultListTitle: 'Schedules',
    fields: [...SCHEDULE_ENSURE_FIELDS] as SpFieldDef[],
  },
  SupportPlans: {
    resourceName: 'SupportPlans',
    defaultListTitle: SUPPORT_PLANS_LIST_TITLE,
    fields: [...SUPPORT_PLANS_ENSURE_FIELDS] as unknown as SpFieldDef[],
  },
  PlanGoal: {
    resourceName: 'PlanGoal',
    defaultListTitle: PLAN_GOAL_LIST_TITLE,
    fields: [...PLAN_GOAL_ENSURE_FIELDS] as unknown as SpFieldDef[],
  },
};
