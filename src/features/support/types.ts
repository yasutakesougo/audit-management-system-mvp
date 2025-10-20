/**
 * 支援記録関連の型定義
 */

// 時間帯別支援記録用の時間帯定義（8:00-18:00）
export type SupportRecordTimeSlot =
  | '08:00-09:00' | '09:00-10:00' | '10:00-11:00' | '11:00-12:00' | '12:00-13:00'
  | '13:00-14:00' | '14:00-15:00' | '15:00-16:00' | '16:00-17:00' | '17:00-18:00';

// 支援記録の型定義
export interface SupportRecord {
  id: string;
  supportPlanId: string;
  personId: string;
  personName: string;
  date: string;
  timeSlot: SupportRecordTimeSlot;
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
    mood?: '良好' | '普通' | '不安定' | '拒否的' | '無反応';
    behavior: string;
    communication: string;
    physicalState: string;
  };
  specialNotes: {
    incidents: string;
    concerns: string;
    achievements: string;
    nextTimeConsiderations: string;
  };
  reporter: {
    name: string;
    role: string;
  };
  executionStatus?: ExecutionStatus;
  status: '未記録' | '記録済み' | '要確認';
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionRoleStatus {
  performed: boolean;
  memo?: string;
}

export interface ExecutionFollowUpNotes {
  improvementMemo?: string;
  nextAttention?: string;
}

export interface ExecutionStatus {
  client: ExecutionRoleStatus;
  supporter: ExecutionRoleStatus;
  followUp?: ExecutionFollowUpNotes;
}

// 日別支援記録の型定義
export interface DailySupportRecord {
  id: string;
  personId: string;
  personName: string;
  date: string;
  records: SupportRecord[];
  createdAt: string;
  updatedAt: string;
}
