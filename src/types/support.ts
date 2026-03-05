/**
 * Shared support record type definitions
 *
 * Extracted from SupportRecordPage.tsx for reuse across the support module.
 */

export interface SupportStep {
  id: string;
  stepNumber: number;
  category: '朝の準備' | '健康確認' | '活動準備' | 'AM活動' | '昼食準備' | '昼食' | '休憩' | 'PM活動' | '終了準備' | '振り返り' | 'その他';
  title: string;
  description: string;
  targetBehavior: string;
  supportMethod: string;
  duration: number;
  importance: '必須' | '推奨' | '任意';
}

export interface SupportRecord {
  id: number;
  supportPlanId: string;
  personId: string;
  personName: string;
  date: string;
  stepId: string;
  stepNumber: number;
  implemented: boolean;
  implementedAt?: string;
  userResponse: {
    mood?: '良好' | '普通' | '不安定';
    participation?: '積極的' | '普通' | '消極的';
    understanding?: '理解良好' | '部分理解';
    notes: string;
  };
  supportEvaluation: {
    effectiveness?: '効果的' | '部分的効果';
    nextAction?: '継続' | '方法変更';
  };
  reporter: {
    name: string;
    role?: string;
  };
  status: '未実施' | '実施済み';
  createdAt: string;
  updatedAt: string;
}

export interface DailySupportRecord {
  id: number;
  supportPlanId: string;
  personId: string;
  personName: string;
  date: string;
  records: SupportRecord[];
  summary: {
    totalSteps: number;
    implementedSteps: number;
    effectiveSteps: number;
    improvementNeeded: number;
    overallProgress: '良好' | '順調' | '要注意';
  };
  completedBy: string;
  status: '未作成' | '作成中' | '完了';
}
