/**
 * SupportPlanGuide — 型定義・定数
 *
 * SupportPlanGuidePage.tsx から抽出。
 * 振る舞いの変更は一切なし（純粋リファクタリング）。
 */
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import type { IUserMaster } from '@/features/users/types';

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

export type SupportPlanForm = {
  serviceUserName: string;
  supportLevel: string;
  planPeriod: string;
  assessmentSummary: string;
  strengths: string;
  decisionSupport: string;
  conferenceNotes: string;
  monitoringPlan: string;
  reviewTiming: string;
  riskManagement: string;
  complianceControls: string;
  improvementIdeas: string;
  lastMonitoringDate: string; // 直近のモニタ実施日 (YYYY/MM/DD)
  /** 構造化目標データ */
  goals: GoalItem[];
};

/** SupportPlanForm のうち string フィールドのみのキー集合 */
export type SupportPlanStringFieldKey = Exclude<keyof SupportPlanForm, 'goals'>;

export type SectionKey =
  | 'overview'
  | 'assessment'
  | 'smart'
  | 'supports'
  | 'decision'
  | 'monitoring'
  | 'risk'
  | 'excellence'
  | 'preview';

export type FieldConfig = {
  key: SupportPlanStringFieldKey;
  label: string;
  helper?: string;
  placeholder?: string;
  minRows?: number;
  quickPhrases?: string[];
  required?: boolean;
};

export type SectionConfig = {
  key: SectionKey;
  label: string;
  description: string;
  fields: FieldConfig[];
};

export type ToastState = { open: boolean; message: string; severity: 'success' | 'error' | 'info' };

export type SupportPlanDraft = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: SupportPlanForm;
  userId?: number | string | null;
  userCode?: string | null;
};

export type UserOption = {
  id: string;
  label: string;
  user: IUserMaster;
};

export type DeadlineInfo = {
  label: string;
  date?: Date;
  daysLeft?: number; // 正数: 期限までの日数 / 負数: 経過日数
  color: 'default' | 'success' | 'warning' | 'error';
  tooltip?: string;
};

export type MonitoringEvidenceSectionProps = {
  userId: string;
  onAppend: (text: string) => void;
  isAdmin: boolean;
};

// ────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────

export const STORAGE_KEY = 'support-plan-guide.v2';
export const SAVE_DEBOUNCE = 600;
export const MAX_DRAFTS = 32;
export const NAME_LIMIT = 80;

export const defaultFormState: SupportPlanForm = {
  serviceUserName: '',
  supportLevel: '',
  planPeriod: '',
  assessmentSummary: '',
  strengths: '',
  decisionSupport: '',
  conferenceNotes: '',
  monitoringPlan: '',
  reviewTiming: '',
  riskManagement: '',
  complianceControls: '',
  improvementIdeas: '',
  lastMonitoringDate: '',
  goals: [],
};

export const FIELD_LIMITS: Record<SupportPlanStringFieldKey, number> = {
  serviceUserName: 80,
  supportLevel: 200,
  planPeriod: 120,
  assessmentSummary: 900,
  strengths: 600,
  decisionSupport: 900,
  conferenceNotes: 800,
  monitoringPlan: 800,
  reviewTiming: 450,
  riskManagement: 700,
  complianceControls: 700,
  improvementIdeas: 900,
  lastMonitoringDate: 20,
};

export const REQUIRED_FIELDS: SupportPlanStringFieldKey[] = [
  'serviceUserName',
  'supportLevel',
  'planPeriod',
  'assessmentSummary',
  'decisionSupport',
  'monitoringPlan',
  'riskManagement',
];

export const FIELD_KEYS = Object.keys(FIELD_LIMITS) as SupportPlanStringFieldKey[];
