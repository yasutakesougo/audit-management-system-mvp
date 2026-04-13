import { create } from 'zustand';
import type { ActionTask, ActionTaskStatus, ActionSuggestion } from '../domain/types';
import { v4 as uuidv4 } from 'uuid';

export type ActionTaskStore = {
  tasks: Record<string, ActionTask>;
  /** 提案をタスクへ昇格させる */
  promote: (suggestion: ActionSuggestion, options?: { assignedToUserId?: string; dueDate?: string }) => string;
  /** ステータス更新 */
  updateStatus: (taskId: string, status: ActionTaskStatus, meta?: { note?: string; by?: string }) => void;
  /** 担当者アサイン */
  assignTask: (taskId: string, userId: string) => void;
  /** タスク削除（基本は非推奨だが管理用） */
  removeTask: (taskId: string) => void;
};

export const ACTION_TASK_STORAGE_KEY = 'action-engine.tasks.v1';
export const ACTION_TASK_STORAGE_VERSION = 1;

/** 
 * useActionTaskStore — 実行タスクの状態管理ストア
 * 
 * Suggestion から昇格された、永続的なアクションタスクのライフサイクルを管理します。
 * localStorage に保存され、リロード後も実行状態が維持されます。
 */
export const useActionTaskStore = create<ActionTaskStore>((set) => ({
  // 初期化時に localStorage から読み込み
  tasks: (() => {
    try {
      const raw = localStorage.getItem(ACTION_TASK_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed.version !== ACTION_TASK_STORAGE_VERSION) return {};
      return parsed.tasks || {};
    } catch {
      return {};
    }
  })(),

  promote: (suggestion, options) => {
    const taskId = uuidv4();
    const newTask: ActionTask = {
      ...suggestion,
      taskId,
      status: 'open',
      assignedToUserId: options?.assignedToUserId,
      dueDate: options?.dueDate,
      createdAt: new Date().toISOString(),
    };

    set((state) => {
      const nextTasks = { ...state.tasks, [taskId]: newTask };
      localStorage.setItem(ACTION_TASK_STORAGE_KEY, JSON.stringify({
        version: ACTION_TASK_STORAGE_VERSION,
        tasks: nextTasks
      }));
      return { tasks: nextTasks };
    });

    return taskId;
  },

  assignTask: (taskId, userId) => {
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;

      const nextTask: ActionTask = {
        ...task,
        assignedToUserId: userId
      };

      const nextTasks = { ...state.tasks, [taskId]: nextTask };
      localStorage.setItem(ACTION_TASK_STORAGE_KEY, JSON.stringify({
        version: ACTION_TASK_STORAGE_VERSION,
        tasks: nextTasks
      }));
      return { tasks: nextTasks };
    });
  },

  updateStatus: (taskId, status, meta) => {
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;

      const nextTask: ActionTask = {
        ...task,
        status,
        resultNote: meta?.note,
        executedAt: status === 'done' ? new Date().toISOString() : task.executedAt,
      };

      const nextTasks = { ...state.tasks, [taskId]: nextTask };
      localStorage.setItem(ACTION_TASK_STORAGE_KEY, JSON.stringify({
        version: ACTION_TASK_STORAGE_VERSION,
        tasks: nextTasks
      }));
      return { tasks: nextTasks };
    });
  },

  removeTask: (taskId) => {
    set((state) => {
      const { [taskId]: _, ...nextTasks } = state.tasks;
      localStorage.setItem(ACTION_TASK_STORAGE_KEY, JSON.stringify({
        version: ACTION_TASK_STORAGE_VERSION,
        tasks: nextTasks
      }));
      return { tasks: nextTasks };
    });
  },
}));

/** 
 * Selector utilities for useActionTaskStore
 * コンポーネント外でもロジックを再利用できるように関数として定義
 */
export const actionTaskSelectors = {
  /** タスクを配列として取得し、実務優先度順にソートして返す */
  getTasksArray: (tasks: Record<string, ActionTask>) => {
    return Object.values(tasks).sort((a, b) => {
      // 1. 未完了 (done以外) を優先
      if (a.status !== 'done' && b.status === 'done') return -1;
      if (a.status === 'done' && b.status !== 'done') return 1;

      // 2. 優先度 (P0 > P1 > P2)
      const priorityMap = { P0: 0, P1: 1, P2: 2 };
      if (priorityMap[a.priority] !== priorityMap[b.priority]) {
        return priorityMap[a.priority] - priorityMap[b.priority];
      }

      // 3. 作成日時 (新しい順)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  },

  /** タスク状況のサマリーを取得 */
  getSummary: (tasks: Record<string, ActionTask>) => {
    const all = Object.values(tasks);
    return {
      total: all.length,
      open: all.filter(t => t.status === 'open').length,
      inProgress: all.filter(t => t.status === 'in_progress').length,
      done: all.filter(t => t.status === 'done').length,
      critical: all.filter(t => t.status !== 'done' && t.priority === 'P0').length,
    };
  }
};
