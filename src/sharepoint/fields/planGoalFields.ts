/**
 * SharePoint フィールド定義 — PlanGoals (ISP)
 */
import { buildSelectFieldsFromMap } from './fieldUtils';

export const PLAN_GOALS_LIST_TITLE = 'PlanGoals' as const;

export const PLAN_GOALS_FIELDS = {
  id: 'Id',
  title: 'Title',              // composite key or label
  userCode: 'UserCode',         // links to Users_Master.UserID
  goalType: 'GoalType',         // 'long' | 'short' | 'support'
  goalLabel: 'GoalLabel',       // display label (e.g. '長期目標')
  goalText: 'GoalText',         // goal body text (multi-line)
  domains: 'Domains',           // comma-separated domain ids (e.g. 'health,social')
  planPeriod: 'PlanPeriod',     // period text (e.g. '2025年4月〜2025年9月')
  planStatus: 'PlanStatus',     // 'confirmed' | 'draft'
  certExpiry: 'CertExpiry',     // YYYY-MM-DD (受給者証有効期限)
  sortOrder: 'SortOrder',       // numeric ordering within a plan
  created: 'Created',
  modified: 'Modified',
} as const;

export const PLAN_GOALS_SELECT_FIELDS = [
  PLAN_GOALS_FIELDS.id,
  PLAN_GOALS_FIELDS.title,
  PLAN_GOALS_FIELDS.userCode,
  PLAN_GOALS_FIELDS.goalType,
  PLAN_GOALS_FIELDS.goalLabel,
  PLAN_GOALS_FIELDS.goalText,
  PLAN_GOALS_FIELDS.domains,
  PLAN_GOALS_FIELDS.planPeriod,
  PLAN_GOALS_FIELDS.planStatus,
  PLAN_GOALS_FIELDS.certExpiry,
  PLAN_GOALS_FIELDS.sortOrder,
  PLAN_GOALS_FIELDS.created,
  PLAN_GOALS_FIELDS.modified,
] as const;

/**
 * SharePoint PlanGoals リスト行 — 読み取り型
 *
 * listItems<SpPlanGoalItem>() の戻り型として使用。
 * SP REST API のレスポンス JSON と 1:1 対応。
 */
export interface SpPlanGoalItem {
  Id: number;
  Title?: string | null;
  UserCode: string;
  GoalType: 'long' | 'short' | 'support';
  GoalLabel: string;
  GoalText: string;
  Domains?: string | null;          // comma-separated (e.g. 'health,social')
  PlanPeriod?: string | null;
  PlanStatus: 'confirmed' | 'draft';
  CertExpiry?: string | null;       // YYYY-MM-DD
  SortOrder?: number | null;
  Created?: string | null;
  Modified?: string | null;
}

/**
 * PlanGoals リストへの PATCH/POST リクエストボディ型
 *
 * undefined は送信せず、null は SP 側で空値クリアにマッピング。
 */
export interface PlanGoalPayload {
  UserCode: string;
  GoalType: 'long' | 'short' | 'support';
  GoalLabel: string;
  GoalText: string;
  Domains: string;                   // comma-joined
  PlanPeriod?: string | null;
  PlanStatus: 'confirmed' | 'draft';
  CertExpiry?: string | null;
  SortOrder?: number | null;
}

/**
 * PlanGoals リスト用の動的 $select ビルダー
 *
 * テナントによるフィールド差分に耐えるため、
 * Fields API で取得した内部名リストと突合して安全なクエリを組み立てる。
 */
export function buildPlanGoalsSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(PLAN_GOALS_FIELDS, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified'],
    fallback: [...PLAN_GOALS_SELECT_FIELDS],
  });
}

/** Dynamic schema candidates for PlanGoals. */
export const PLAN_GOALS_CANDIDATES = {
  userCode: ['UserCode', 'cr013_usercode', 'UserID'],
  goalType: ['GoalType', 'cr013_goaltype'],
  goalLabel: ['GoalLabel', 'cr013_goallabel', 'Title'],
  goalText: ['GoalText', 'cr013_goaltext'],
  domains: ['Domains', 'cr013_domains'],
  planPeriod: ['PlanPeriod', 'cr013_planperiod'],
  planStatus: ['PlanStatus', 'cr013_planstatus'],
  certExpiry: ['CertExpiry', 'cr013_certexpiry'],
  sortOrder: ['SortOrder', 'cr013_sortorder'],
} as const;

/** Essential fields for PlanGoals list. */
export const PLAN_GOALS_ESSENTIALS = ['userCode', 'goalType', 'goalText', 'planStatus'] as const;

/** Fields to ensure for modern PlanGoals list. */
export const PLAN_GOALS_ENSURE_FIELDS = [
  { internalName: 'UserCode', displayName: 'UserCode', type: 'Text' },
  { internalName: 'GoalType', displayName: 'GoalType', type: 'Text' },
  { internalName: 'GoalLabel', displayName: 'GoalLabel', type: 'Text' },
  { internalName: 'GoalText', displayName: 'GoalText', type: 'Note' },
  { internalName: 'Domains', displayName: 'Domains', type: 'Text' },
  { internalName: 'PlanPeriod', displayName: 'PlanPeriod', type: 'Text' },
  { internalName: 'PlanStatus', displayName: 'PlanStatus', type: 'Text' },
  { internalName: 'CertExpiry', displayName: 'CertExpiry', type: 'Text' },
  { internalName: 'SortOrder', displayName: 'SortOrder', type: 'Number' },
] as const;
