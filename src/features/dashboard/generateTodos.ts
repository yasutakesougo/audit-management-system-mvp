/**
 * Todo Auto-Generator (Phase C-2)
 * 
 * 目的：スケジュールから重要タスクを自動抽出
 * 
 * 抽出ルール：
 * - 「服薬」「薬」→ medication（高優先度）
 * - 「通院」「受診」→ hospital（高優先度）
 * - 「入浴」「シャワー」→ cleaning（中優先度）
 * - その他 → other（低優先度）
 * 
 * 優先度判定：
 * - 服薬・通院 → high
 * - 入浴・清掃 → medium
 * - その他 → low
 */

import type { TodoItem } from '@/features/dashboard/tabs/TodoTab';
import type { ScheduleItem } from '@/features/dashboard/sections/impl/ScheduleSection';

/**
 * キーワードマッピング
 * タイトルに含まれるキーワードから TodoItem の type を判定
 */
const KEYWORD_MAPPING: Array<{
  keywords: string[];
  type: TodoItem['type'];
  priority: TodoItem['priority'];
}> = [
  {
    keywords: ['服薬', '薬', '投薬', '内服'],
    type: 'medication',
    priority: 'high',
  },
  {
    keywords: ['通院', '受診', '診察', '病院', 'クリニック'],
    type: 'hospital',
    priority: 'high',
  },
  {
    keywords: ['入浴', 'シャワー', '清拭', '足浴'],
    type: 'cleaning',
    priority: 'medium',
  },
  {
    keywords: ['清掃', '掃除', '点検', '整理'],
    type: 'cleaning',
    priority: 'medium',
  },
];

/**
 * スケジュールアイテムから TodoItem の type と priority を判定
 */
function classifyTask(title: string): {
  type: TodoItem['type'];
  priority: TodoItem['priority'];
} {
  for (const mapping of KEYWORD_MAPPING) {
    if (mapping.keywords.some(keyword => title.includes(keyword))) {
      return {
        type: mapping.type,
        priority: mapping.priority,
      };
    }
  }
  // デフォルト
  return {
    type: 'other',
    priority: 'low',
  };
}

/**
 * スケジュールから Todo を自動生成
 * 
 * @param scheduleLanes - 今日のスケジュールレーン
 * @returns 自動生成された TodoItem のリスト
 */
export function generateTodosFromSchedule(scheduleLanes: {
  userLane: ScheduleItem[];
  staffLane: ScheduleItem[];
  organizationLane: ScheduleItem[];
}): TodoItem[] {
  const todos: TodoItem[] = [];

  // 利用者レーンから抽出（最優先）
  scheduleLanes.userLane.forEach((item) => {
    const { type, priority } = classifyTask(item.title);
    
    // 重要なタスクのみを抽出（other は除外）
    if (type !== 'other') {
      todos.push({
        id: `user-${item.id}`,
        title: `${item.title}（${item.time}）`,
        type,
        deadline: item.time.split('-')[0]?.trim(), // 開始時刻を期限に設定
        assignee: item.owner,
        priority,
      });
    }
  });

  // 職員レーンから抽出
  scheduleLanes.staffLane.forEach((item) => {
    const { type, priority } = classifyTask(item.title);
    
    if (type !== 'other') {
      todos.push({
        id: `staff-${item.id}`,
        title: `${item.title}（${item.time}）`,
        type,
        deadline: item.time.split('-')[0]?.trim(),
        assignee: item.owner || item.title, // 職員名が owner に入っている想定
        priority,
      });
    }
  });

  // 組織レーンから抽出（清掃・点検など）
  scheduleLanes.organizationLane.forEach((item) => {
    const { type, priority } = classifyTask(item.title);
    
    if (type !== 'other') {
      todos.push({
        id: `org-${item.id}`,
        title: `${item.title}（${item.time}）`,
        type,
        deadline: item.time.split('-')[0]?.trim(),
        priority,
      });
    }
  });

  // 優先度順にソート（high → medium → low）
  todos.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const orderDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    
    // 優先度が同じ場合は時刻順
    if (orderDiff === 0 && a.deadline && b.deadline) {
      return a.deadline.localeCompare(b.deadline);
    }
    
    return orderDiff;
  });

  return todos;
}

/**
 * Todo の統計情報を計算
 */
export function calculateTodoStats(todos: TodoItem[]): {
  total: number;
  byType: Record<TodoItem['type'], number>;
  byPriority: Record<TodoItem['priority'], number>;
  urgent: number; // 今から1時間以内のタスク
} {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  const byType: Record<TodoItem['type'], number> = {
    medication: 0,
    hospital: 0,
    cleaning: 0,
    other: 0,
  };

  const byPriority: Record<TodoItem['priority'], number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  let urgent = 0;

  todos.forEach((todo) => {
    byType[todo.type]++;
    byPriority[todo.priority]++;

    // 緊急タスク判定（1時間以内）
    if (todo.deadline) {
      const [h, m] = todo.deadline.split(':').map(Number);
      const deadlineInMinutes = h * 60 + m;
      if (deadlineInMinutes - currentTimeInMinutes <= 60 && deadlineInMinutes > currentTimeInMinutes) {
        urgent++;
      }
    }
  });

  return {
    total: todos.length,
    byType,
    byPriority,
    urgent,
  };
}
