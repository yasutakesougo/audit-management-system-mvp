/**
 * @fileoverview ActionQueue 優先度制御ロジックの単体テスト
 * @description
 * MVP-011: scoreActionQueueItem / buildPriorityReasonLabel /
 * sortActionQueueItems / buildScoredQueueCategories のテスト
 */
import { describe, it, expect } from 'vitest';
import {
  scoreActionQueueItem,
  buildPriorityReasonLabel,
  sortActionQueueItems,
  buildScoredQueueCategories,
  type PriorityFactor,
} from '../actionQueuePriority';
import { TASK_PRIORITY, type TodayTask } from '@/domain/todayEngine';

// ─── ヘルパー ────────────────────────────────────────────────────

function makeTask(overrides: Partial<TodayTask> = {}): TodayTask {
  return {
    id: 'test-1',
    userId: 'U-001',
    label: 'テスト',
    source: 'unrecorded',
    priority: TASK_PRIORITY.unrecorded,
    actionType: 'quickRecord',
    completed: false,
    ...overrides,
  };
}

// ─── scoreActionQueueItem ─────────────────────────────────────────

describe('scoreActionQueueItem', () => {
  it('ファクターなしなら base priority と一致する', () => {
    const task = makeTask({ priority: 100 });
    expect(scoreActionQueueItem(task, [])).toBe(100);
  });

  it('critical-handoff ファクターは +50 される', () => {
    const task = makeTask({ priority: 90, source: 'handoff' });
    const score = scoreActionQueueItem(task, ['critical-handoff']);
    expect(score).toBe(140);
  });

  it('複数ファクターは合算される', () => {
    const task = makeTask({ priority: 100 });
    const score = scoreActionQueueItem(task, ['missing-record', 'high-intensity-support']);
    // 100 + 40 + 25 = 165
    expect(score).toBe(165);
  });

  it('default ファクターはスコアに影響しない', () => {
    const task = makeTask({ priority: 80 });
    expect(scoreActionQueueItem(task, ['default'])).toBe(80);
  });
});

// ─── buildPriorityReasonLabel ─────────────────────────────────────

describe('buildPriorityReasonLabel', () => {
  it('ファクターなし or default のみなら空文字を返す', () => {
    expect(buildPriorityReasonLabel([])).toBe('');
    expect(buildPriorityReasonLabel(['default'])).toBe('');
  });

  it('critical-handoff があれば最優先で表示', () => {
    const label = buildPriorityReasonLabel(['missing-record', 'critical-handoff']);
    expect(label).toBe('🔴 重要申し送り');
  });

  it('overdue は critical-handoff の次に優先', () => {
    const label = buildPriorityReasonLabel(['overdue', 'missing-record']);
    expect(label).toBe('⏰ 期限超過');
  });

  it('high-intensity-support は missing-record より優先', () => {
    const label = buildPriorityReasonLabel(['missing-record', 'high-intensity-support']);
    expect(label).toBe('🟠 強度行動障害');
  });

  it('missing-record のみ', () => {
    expect(buildPriorityReasonLabel(['missing-record'])).toBe('📝 記録未入力');
  });

  it('missing-plan のみ', () => {
    expect(buildPriorityReasonLabel(['missing-plan'])).toBe('📋 計画未作成');
  });
});

// ─── sortActionQueueItems ─────────────────────────────────────────

describe('sortActionQueueItems', () => {
  it('compositeScore が高いタスクが先頭に来る', () => {
    const tasks: TodayTask[] = [
      makeTask({ id: 'low', priority: 90, source: 'handoff' }),
      makeTask({ id: 'high', priority: 90, source: 'handoff', userId: 'U-002' }),
    ];
    const getFactors = (t: TodayTask): PriorityFactor[] =>
      t.id === 'high' ? ['critical-handoff'] : [];

    const sorted = sortActionQueueItems(tasks, getFactors);
    expect(sorted[0].id).toBe('high');
    expect(sorted[0].compositeScore).toBe(140);   // 90 + 50
    expect(sorted[1].compositeScore).toBe(90);
  });

  it('同スコアなら dueTime 昇順', () => {
    const tasks: TodayTask[] = [
      makeTask({ id: 'late', dueTime: '15:00', userId: 'U-001' }),
      makeTask({ id: 'early', dueTime: '09:00', userId: 'U-002' }),
    ];
    const sorted = sortActionQueueItems(tasks, () => []);
    expect(sorted[0].id).toBe('early');
  });

  it('priorityReasonLabel が付与される', () => {
    const tasks: TodayTask[] = [makeTask()];
    const sorted = sortActionQueueItems(tasks, () => ['missing-record']);
    expect(sorted[0].priorityReasonLabel).toBe('📝 記録未入力');
  });

  it('空配列を渡しても空配列が返る', () => {
    expect(sortActionQueueItems([], () => [])).toEqual([]);
  });
});

// ─── buildScoredQueueCategories ──────────────────────────────────

describe('buildScoredQueueCategories', () => {
  const incompleteUnrecorded = {
    ...makeTask({ id: 'u1', source: 'unrecorded', completed: false }),
    compositeScore: 140,
    priorityReasonLabel: '📝 記録未入力',
    factors: ['missing-record'] as PriorityFactor[],
  };
  const incompleteHandoff = {
    ...makeTask({ id: 'h1', source: 'handoff', userId: 'U-002', completed: false }),
    compositeScore: 140,
    priorityReasonLabel: '🔴 重要申し送り',
    factors: ['critical-handoff'] as PriorityFactor[],
  };
  const completedTask = {
    ...makeTask({ id: 'c1', source: 'unrecorded', userId: 'U-003', completed: true }),
    compositeScore: 100,
    priorityReasonLabel: '',
    factors: [] as PriorityFactor[],
  };

  it('3カテゴリを返す', () => {
    const cats = buildScoredQueueCategories([]);
    expect(cats).toHaveLength(3);
    expect(cats.map((c) => c.key)).toEqual(['unrecorded', 'handoff', 'other']);
  });

  it('完了済みタスクはカウントに含まれない', () => {
    const cats = buildScoredQueueCategories([completedTask]);
    expect(cats.find((c) => c.key === 'unrecorded')?.count).toBe(0);
  });

  it('unrecorded に count とラベルが入る', () => {
    const cats = buildScoredQueueCategories([incompleteUnrecorded]);
    const cat = cats.find((c) => c.key === 'unrecorded');
    expect(cat?.count).toBe(1);
    expect(cat?.topReasonLabel).toBe('📝 記録未入力');
    expect(cat?.color).toBe('error');
  });

  it('handoff に重要申し送りラベルが入る', () => {
    const cats = buildScoredQueueCategories([incompleteHandoff]);
    const cat = cats.find((c) => c.key === 'handoff');
    expect(cat?.topReasonLabel).toBe('🔴 重要申し送り');
    expect(cat?.color).toBe('warning');
  });
});
