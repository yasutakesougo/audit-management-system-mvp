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
  /** 医療的配慮事項 */
  medicalConsiderations: string;
  /** 緊急時対応計画 */
  emergencyResponsePlan: string;
  /** 権利擁護に関する記載 */
  rightsAdvocacy: string;
  /** 契約上のサービス開始日 */
  serviceStartDate: string;
  /** 実際の初回サービス提供日 */
  firstServiceDate: string;
  /** 構造化目標データ */
  goals: GoalItem[];
  /**
   * ISP コンプライアンスメタデータ（useComplianceForm が読み書き）
   * 型はドメイン層に依存しないよう unknown で管理し、読み出し側で Zod parse する。
   */
  compliance?: unknown;
};

/** SupportPlanForm のうち string フィールドのみのキー集合 */
export type SupportPlanStringFieldKey = Exclude<keyof SupportPlanForm, 'goals' | 'compliance'>;

export type SectionKey =
  | 'overview'
  | 'assessment'
  | 'smart'
  | 'supports'
  | 'decision'
  | 'compliance'
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

// ────────────────────────────────────────────
// P3-D: 提案判断の永続化
// ────────────────────────────────────────────

/** 提案判断アクション（SmartTab + 改善メモ 全状態の union） */
export type SuggestionDecisionAction =
  | 'accepted'
  | 'dismissed'
  | 'noted'
  | 'deferred'
  | 'promoted';

/** 判断を行ったタブ */
export type SuggestionDecisionSource = 'smart' | 'memo';

/**
 * 個々の提案判断レコード
 *
 * append-only で保存し、UI では id ごとの最新レコードを採用する。
 * これにより状態変更の履歴を保持しつつ、表示は常に最新を見る。
 */
export type SuggestionDecisionRecord = {
  /** GoalSuggestion.id */
  id: string;
  /** どのタブで判断したか */
  source: SuggestionDecisionSource;
  /** 判断アクション */
  action: SuggestionDecisionAction;
  /** ISO 8601 判断日時 */
  decidedAt: string;
};

export type SupportPlanDraft = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: SupportPlanForm;
  userId?: number | string | null;
  userCode?: string | null;
  /** P3-D: 提案判断履歴（append-only） */
  suggestionDecisions?: SuggestionDecisionRecord[];
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
  medicalConsiderations: '',
  emergencyResponsePlan: '',
  rightsAdvocacy: '',
  serviceStartDate: '',
  firstServiceDate: '',
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
  medicalConsiderations: 2000,
  emergencyResponsePlan: 2000,
  rightsAdvocacy: 2000,
  serviceStartDate: 20,
  firstServiceDate: 20,
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
