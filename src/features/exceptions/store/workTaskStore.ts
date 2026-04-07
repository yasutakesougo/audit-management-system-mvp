import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * @fileoverview 行動強制OS (Action Enforcement OS) のためのタスク管理ストア
 * @description
 * システムが検出した「例外（不備）」を「必須業務（タスク）」として管理し、
 * 現場が「今、何をすべきか」を強制的に提示するための状態を保持する。
 */

export type AcknowledgeReason = 'CONFIRMED' | 'LATER' | 'ASSIGNED_TO_OTHER' | 'SYSTEM_OVERRIDE';

interface WorkTaskState {
  /** ユーザーが「承諾（確認）」したタスクのID一覧 (Audit Metadata 保持) */
  acknowledgedIds: Record<string, {
    timestamp: string;
    userId?: string;
    reason: AcknowledgeReason;
  }>;
  /** ユーザーが完了させたタスクのID一覧（一時的なキャッシュ） */
  completedIds: Set<string>;
  
  // Actions
  acknowledge: (id: string, reason?: AcknowledgeReason, userId?: string) => void;
  markDone: (id: string) => void;
  reset: () => void;
}

export const useWorkTaskStore = create<WorkTaskState>()(
  persist(
    (set) => ({
      acknowledgedIds: {},
      completedIds: new Set(),

      acknowledge: (id, reason = 'CONFIRMED', userId) => set((state) => ({
        acknowledgedIds: { 
          ...state.acknowledgedIds, 
          [id]: { 
            timestamp: new Date().toISOString(),
            userId,
            reason
          } 
        }
      })),

      markDone: (id) => set((state) => {
        const newCompleted = new Set(state.completedIds);
        newCompleted.add(id);
        return { completedIds: newCompleted };
      }),

      reset: () => set({ acknowledgedIds: {}, completedIds: new Set() }),
    }),
    {
      name: 'today-os-work-tasks-v2', // スキーマ変更のためバージョンアップ
    }
  )
);
