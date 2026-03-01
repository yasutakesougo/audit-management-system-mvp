// ---------------------------------------------------------------------------
// individual-support/types — 共有型 + ヘルパー
//
// SupportStepTemplate (SP) → ScheduleSlot 変換を担う。
// ハードコード定数は削除済み。
// ---------------------------------------------------------------------------
import type { SupportStepTemplate } from '@/domain/support/step-templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TabValue = 'plan' | 'records';

export interface ScheduleSlot {
  id: string;
  time: string;
  activity: string;
  selfTasks: string[];
  supporterTasks: string[];
  isRecorded: boolean;
}

export interface ABCSelection {
  antecedent: string;
  behavior: string;
  consequence: string;
}

export interface SlotFormState {
  mood: string;
  note: string;
  showABC: boolean;
  abc: ABCSelection;
  error: string | null;
}

export interface TimelineEntry {
  id: string;
  time: string;
  activity: string;
  mood: string;
  note: string;
  abc?: ABCSelection;
  recordedAt: string;
}

// ---------------------------------------------------------------------------
// Constants (UI のみ — SP 非依存)
// ---------------------------------------------------------------------------

export const moodOptions = ['落ち着いている', '楽しそう', '不安そう', '疲れている', 'サインが出ている'];

export const abcOptionMap: Record<keyof ABCSelection, string[]> = {
  antecedent: ['要求が通らない', '活動の切り替え', '感覚刺激が強い', '周囲が騒がしい'],
  behavior: ['手を叩く', '大きな声を出す', 'その場を離れる', '泣く / 叫ぶ'],
  consequence: ['支援者が近づく', '活動から離れる', '要求が受け入れられる', '時間を置いて再開する'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * SupportStepTemplate → ScheduleSlot に変換する。
 * SP テンプレートのフィールドを DailyRecordsTab が消費できる形に射影。
 */
export function toScheduleSlot(template: SupportStepTemplate): ScheduleSlot {
  // timeSlot は "09:30-10:30" 形式 → 開始時刻のみ抽出
  const startTime = template.timeSlot.split('-')[0] ?? template.timeSlot;

  return {
    id: template.id,
    time: startTime,
    activity: template.stepTitle,
    selfTasks: template.targetBehavior
      .split(/[、,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    supporterTasks: template.supportMethod
      .split(/[、,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    isRecorded: false,
  };
}

/**
 * ScheduleSlot[] から初期フォーム状態を構築する。
 */
export const buildInitialFormState = (slots: ScheduleSlot[]): Record<string, SlotFormState> => {
  return slots.reduce<Record<string, SlotFormState>>((acc, slot) => {
    acc[slot.id] = {
      mood: '',
      note: '',
      showABC: false,
      abc: { antecedent: '', behavior: '', consequence: '' },
      error: null,
    };
    return acc;
  }, {});
};
