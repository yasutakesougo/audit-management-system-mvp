/**
 * SharePoint フィールド定義 — PlanGoal (ISP)
 *
 * 利用者の個別支援計画における目標（長期・短期・具体的支援）を管理。
 */
import { buildSelectFieldsFromMap } from './fieldUtils';

export const PLAN_GOAL_LIST_TITLE = 'PlanGoal' as const;

/**
 * PlanGoal リストのフィールド定義
 */
export const PLAN_GOAL_FIELDS = {
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

export const PLAN_GOAL_SELECT_FIELDS = [
  PLAN_GOAL_FIELDS.id,
  PLAN_GOAL_FIELDS.title,
  PLAN_GOAL_FIELDS.userCode,
  PLAN_GOAL_FIELDS.goalType,
  PLAN_GOAL_FIELDS.goalLabel,
  PLAN_GOAL_FIELDS.goalText,
  PLAN_GOAL_FIELDS.domains,
  PLAN_GOAL_FIELDS.planPeriod,
  PLAN_GOAL_FIELDS.planStatus,
  PLAN_GOAL_FIELDS.certExpiry,
  PLAN_GOAL_FIELDS.sortOrder,
  PLAN_GOAL_FIELDS.created,
  PLAN_GOAL_FIELDS.modified,
] as const;

/**
 * SharePoint PlanGoal リスト行 — 読み取り型
 */
export interface SpPlanGoalItem {
  Id: number;
  Title?: string | null;
  UserCode: string;
  GoalType: 'long' | 'short' | 'support';
  GoalLabel: string;
  GoalText: string;
  Domains?: string | null;
  PlanPeriod?: string | null;
  PlanStatus: 'confirmed' | 'draft';
  CertExpiry?: string | null;
  SortOrder?: number | null;
  Created?: string | null;
  Modified?: string | null;
}

/**
 * PlanGoal リストへの PATCH/POST リクエストボディ型
 */
export interface PlanGoalPayload {
  UserCode: string;
  GoalType: 'long' | 'short' | 'support';
  GoalLabel: string;
  GoalText: string;
  Domains: string;
  PlanPeriod?: string | null;
  PlanStatus: 'confirmed' | 'draft';
  CertExpiry?: string | null;
  SortOrder?: number | null;
}

/**
 * PlanGoal リスト用の動的 $select ビルダー
 */
export function buildPlanGoalSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(PLAN_GOAL_FIELDS, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified'],
    fallback: [...PLAN_GOAL_SELECT_FIELDS],
  });
}

/** Dynamic schema candidates for PlanGoal. */
export const PLAN_GOAL_CANDIDATES = {
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

/** Essential fields for PlanGoal list. */
export const PLAN_GOAL_ESSENTIALS = ['userCode', 'goalType', 'goalText', 'planStatus'] as const;

/** Fields to ensure for modern PlanGoal list. */
export const PLAN_GOAL_ENSURE_FIELDS = [
  { internalName: 'UserCode', displayName: '利用者コード', type: 'Text' },
  { internalName: 'GoalType', displayName: '目標種別', type: 'Text' },
  { internalName: 'GoalLabel', displayName: '目標ラベル', type: 'Text' },
  { internalName: 'GoalText', displayName: '目標内容', type: 'Note' },
  { internalName: 'Domains', displayName: '領域', type: 'Text' },
  { internalName: 'PlanPeriod', displayName: '計画期間', type: 'Text' },
  { internalName: 'PlanStatus', displayName: '計画状態', type: 'Text' },
  { internalName: 'CertExpiry', displayName: '受給者証期限', type: 'Text' },
  { internalName: 'SortOrder', displayName: '表示順', type: 'Number' },
] as const;
