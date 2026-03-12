/**
 * TodayEngine — Unit Tests
 *
 * Coverage per #824 acceptance criteria:
 * 1. 優先順位: unrecorded > handoff > briefing > schedule
 * 2. 同 priority → dueTime 昇順
 * 3. 重複: same userId → priority 高い方
 * 4. focusTask: 空配列 → null
 * 5. focusTask: 最高 priority → 理由メッセージ
 * 6. 安全弁: 200 件超 → console.warn
 */
import { describe, it, expect, vi } from 'vitest';
import {
  buildTodayTasks,
  dedupeTasks,
  summarizeTasks,
  pickFocusTask,
  TASK_PRIORITY,
  MAX_TASKS,
  type TodayEngineInput,
  type TodayTask,
} from './todayEngine';

// ─── Helpers ─────────────────────────────────────────────────────────────

const emptyInput: TodayEngineInput = {
  pendingUserIds: [],
  briefingAlerts: [],
  scheduleLanes: [],
  handoffItems: [],
};

function makeInput(overrides: Partial<TodayEngineInput>): TodayEngineInput {
  return { ...emptyInput, ...overrides };
}

// ─── buildTodayTasks ─────────────────────────────────────────────────────

describe('buildTodayTasks', () => {
  it('returns empty array for empty input', () => {
    const tasks = buildTodayTasks(emptyInput);
    expect(tasks).toEqual([]);
  });

  it('sorts by priority: unrecorded > handoff > briefing > schedule', () => {
    const input = makeInput({
      scheduleLanes: [{ id: 's1', title: '会議', time: '10:00' }],
      briefingAlerts: [{ id: 'b1', userId: 'U002', label: '注意事項' }],
      handoffItems: [{ id: 'h1', userId: 'U003', label: '申し送り' }],
      pendingUserIds: ['U001'],
    });

    const tasks = buildTodayTasks(input);

    expect(tasks[0].source).toBe('unrecorded');
    expect(tasks[1].source).toBe('handoff');
    expect(tasks[2].source).toBe('briefing');
    expect(tasks[3].source).toBe('schedule');
  });

  it('sorts same priority by dueTime ascending', () => {
    const input = makeInput({
      handoffItems: [
        { id: 'h1', userId: 'U001', label: '後', dueTime: '15:00' },
        { id: 'h2', userId: 'U002', label: '先', dueTime: '09:00' },
      ],
    });

    const tasks = buildTodayTasks(input);
    const handoffs = tasks.filter((t) => t.source === 'handoff');

    expect(handoffs[0].dueTime).toBe('09:00');
    expect(handoffs[1].dueTime).toBe('15:00');
  });

  it('tasks with dueTime come before tasks without dueTime at same priority', () => {
    const input = makeInput({
      handoffItems: [
        { id: 'h1', userId: 'U001', label: '時間なし' },
        { id: 'h2', userId: 'U002', label: '時間あり', dueTime: '10:00' },
      ],
    });

    const tasks = buildTodayTasks(input);
    const handoffs = tasks.filter((t) => t.source === 'handoff');

    expect(handoffs[0].label).toBe('時間あり');
    expect(handoffs[1].label).toBe('時間なし');
  });

  it('applies resolveUserName to unrecorded tasks', () => {
    const input = makeInput({
      pendingUserIds: ['U001'],
      resolveUserName: (id) => (id === 'U001' ? '田中太郎' : id),
    });

    const tasks = buildTodayTasks(input);
    expect(tasks[0].label).toBe('田中太郎の記録が未完了');
  });

  it('sets correct actionType for each source', () => {
    const input = makeInput({
      pendingUserIds: ['U001'],
      handoffItems: [{ id: 'h1', userId: 'U002', label: '申し送り' }],
      briefingAlerts: [{ id: 'b1', userId: 'U003', label: '注意事項' }],
      scheduleLanes: [{ id: 's1', title: '会議', time: '10:00' }],
    });

    const tasks = buildTodayTasks(input);

    expect(tasks.find((t) => t.source === 'unrecorded')?.actionType).toBe('quickRecord');
    expect(tasks.find((t) => t.source === 'handoff')?.actionType).toBe('navigate');
    expect(tasks.find((t) => t.source === 'briefing')?.actionType).toBe('info');
    expect(tasks.find((t) => t.source === 'schedule')?.actionType).toBe('navigate');
  });

  it('warns and truncates when exceeding MAX_TASKS', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const input = makeInput({
      pendingUserIds: Array.from({ length: MAX_TASKS + 10 }, (_, i) => `U${i}`),
    });

    const tasks = buildTodayTasks(input);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`exceeds MAX_TASKS (${MAX_TASKS})`),
    );
    expect(tasks).toHaveLength(MAX_TASKS);

    warnSpy.mockRestore();
  });
});

// ─── dedupeTasks ─────────────────────────────────────────────────────────

describe('dedupeTasks', () => {
  it('keeps higher priority task when same userId appears multiple times', () => {
    const tasks: TodayTask[] = [
      {
        id: 'unrecorded-U001',
        userId: 'U001',
        label: '未記録',
        source: 'unrecorded',
        priority: TASK_PRIORITY.unrecorded,
        actionType: 'quickRecord',
        completed: false,
      },
      {
        id: 'handoff-h1',
        userId: 'U001',
        label: '申し送り',
        source: 'handoff',
        priority: TASK_PRIORITY.handoff,
        actionType: 'navigate',
        completed: false,
      },
    ];

    const result = dedupeTasks(tasks);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('unrecorded');
    expect(result[0].priority).toBe(TASK_PRIORITY.unrecorded);
  });

  it('does not dedup tasks with empty userId (e.g. schedule)', () => {
    const tasks: TodayTask[] = [
      {
        id: 'schedule-s1',
        userId: '',
        label: '会議A',
        source: 'schedule',
        priority: TASK_PRIORITY.schedule,
        actionType: 'navigate',
        completed: false,
      },
      {
        id: 'schedule-s2',
        userId: '',
        label: '会議B',
        source: 'schedule',
        priority: TASK_PRIORITY.schedule,
        actionType: 'navigate',
        completed: false,
      },
    ];

    const result = dedupeTasks(tasks);
    expect(result).toHaveLength(2);
  });

  it('keeps lower priority task when it appears first but replaces with later higher', () => {
    const tasks: TodayTask[] = [
      {
        id: 'briefing-b1',
        userId: 'U002',
        label: 'ブリーフィング',
        source: 'briefing',
        priority: TASK_PRIORITY.briefing,
        actionType: 'info',
        completed: false,
      },
      {
        id: 'unrecorded-U002',
        userId: 'U002',
        label: '未記録',
        source: 'unrecorded',
        priority: TASK_PRIORITY.unrecorded,
        actionType: 'quickRecord',
        completed: false,
      },
    ];

    const result = dedupeTasks(tasks);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('unrecorded');
  });
});

// ─── summarizeTasks ──────────────────────────────────────────────────────

describe('summarizeTasks', () => {
  it('returns zeroes for empty list', () => {
    expect(summarizeTasks([])).toEqual({ total: 0, completed: 0, remaining: 0 });
  });

  it('counts completed and remaining correctly', () => {
    const tasks: TodayTask[] = [
      {
        id: 't1', userId: 'U001', label: 'A', source: 'unrecorded',
        priority: 100, actionType: 'quickRecord', completed: true,
      },
      {
        id: 't2', userId: 'U002', label: 'B', source: 'handoff',
        priority: 90, actionType: 'navigate', completed: false,
      },
      {
        id: 't3', userId: 'U003', label: 'C', source: 'briefing',
        priority: 80, actionType: 'info', completed: true,
      },
    ];

    expect(summarizeTasks(tasks)).toEqual({ total: 3, completed: 2, remaining: 1 });
  });
});

// ─── pickFocusTask ───────────────────────────────────────────────────────

describe('pickFocusTask', () => {
  it('returns null for empty array', () => {
    expect(pickFocusTask([])).toBeNull();
  });

  it('returns null when all tasks are completed', () => {
    const tasks: TodayTask[] = [
      {
        id: 't1', userId: 'U001', label: 'Done', source: 'unrecorded',
        priority: 100, actionType: 'quickRecord', completed: true,
      },
    ];
    expect(pickFocusTask(tasks)).toBeNull();
  });

  it('picks highest priority incomplete task with reason message', () => {
    const tasks: TodayTask[] = [
      {
        id: 'unrecorded-U001', userId: 'U001', label: '田中の記録が未完了',
        source: 'unrecorded', priority: TASK_PRIORITY.unrecorded,
        actionType: 'quickRecord', completed: false,
      },
      {
        id: 'handoff-h1', userId: 'U002', label: '申し送り確認',
        source: 'handoff', priority: TASK_PRIORITY.handoff,
        actionType: 'navigate', completed: false,
      },
    ];

    const focus = pickFocusTask(tasks);

    expect(focus).not.toBeNull();
    expect(focus!.task.id).toBe('unrecorded-U001');
    expect(focus!.reason).toContain('最優先');
    expect(focus!.reason).toContain('未記録の対応');
    expect(focus!.reason).toContain('田中の記録が未完了');
  });

  it('skips completed tasks even if they have higher priority', () => {
    const tasks: TodayTask[] = [
      {
        id: 'unrecorded-U001', userId: 'U001', label: '完了済み',
        source: 'unrecorded', priority: TASK_PRIORITY.unrecorded,
        actionType: 'quickRecord', completed: true,
      },
      {
        id: 'handoff-h1', userId: 'U002', label: '未完了の申し送り',
        source: 'handoff', priority: TASK_PRIORITY.handoff,
        actionType: 'navigate', completed: false,
      },
    ];

    const focus = pickFocusTask(tasks);

    expect(focus).not.toBeNull();
    expect(focus!.task.source).toBe('handoff');
  });
});
