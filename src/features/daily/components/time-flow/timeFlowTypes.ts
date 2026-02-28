// ---------------------------------------------------------------------------
// TimeFlow 支援記録 — 共通型定義
// ---------------------------------------------------------------------------

import type { SupportStrategyStage } from '@/features/planDeployment/supportFlow';

// ===== 支援記録 =====

/** 時間フロー支援記録の型定義 */
export interface SupportRecord {
  id: number;
  supportPlanId: string;
  personId: string;
  personName: string;
  date: string;
  timeSlot?: string;
  userActivities: {
    planned: string;
    actual: string;
    notes: string;
  };
  staffActivities: {
    planned: string;
    actual: string;
    notes: string;
  };
  userCondition: {
    mood?: '良好' | '普通' | '不安定';
    behavior: string;
    communication?: string;
    physicalState?: string;
  };
  specialNotes: {
    incidents?: string;
    concerns?: string;
    achievements?: string;
    nextTimeConsiderations?: string;
  };
  reporter: {
    name: string;
    role?: string;
  };
  status: '未記録' | '記録中' | '記録済み';
  createdAt: string;
  updatedAt: string;
  activityKey?: string;
  activityName?: string;
  abc?: {
    antecedent?: string;
    behavior?: string;
    consequence?: string;
    intensity?: '軽度' | '中度' | '重度';
  };
}

// ===== 日次記録コンテナ =====

export interface DailySupportRecord {
  id: number;
  supportPlanId: string;
  personId: string;
  personName: string;
  date: string;
  records: SupportRecord[];
  summary: {
    totalTimeSlots: number;
    recordedTimeSlots: number;
    concerningIncidents: number;
    achievementHighlights: number;
    overallProgress: '良好' | '順調' | '要注意';
  };
  dailyNotes?: string;
  completedBy: string;
  completedAt?: string;
  status: '未作成' | '作成中' | '完了';
}

// ===== 利用者情報 =====

export interface SupportUser {
  id: string;
  name: string;
  planType: string;
  isActive: boolean;
}

// ===== フォーム状態 =====

/** ABC入力フォームの状態型 */
export type SlotFormState = {
  mood: string;
  notes: string;
  intensity: '軽度' | '中度' | '重度' | '';
  showABC: boolean;
  abc: {
    antecedent: string;
    behavior: string;
    consequence: string;
  };
  error: string | null;
};

// ===== Re-export =====

export type { SupportStrategyStage };
