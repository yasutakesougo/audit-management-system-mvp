import { describe, expect, it } from 'vitest';
import type { TodayExceptionAction } from '@/features/exceptions/domain/buildTodayExceptions';
import type { ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';
import {
  rankTodayExceptionActionsByPriority,
  selectTopExceptionAttentionCandidate,
} from '../selectTopExceptionAttentionCandidate';

function makeException(overrides: Partial<ExceptionItem> & { id: string }): ExceptionItem {
  return {
    id: overrides.id,
    category: 'attention-user',
    severity: 'high',
    title: '要確認',
    description: '要確認',
    updatedAt: '2026-03-28T09:00:00.000Z',
    actionLabel: '確認',
    actionPath: '/path',
    targetUserId: 'U-001',
    ...overrides,
  };
}

function makeAction(
  sourceExceptionId: string,
  overrides: Partial<TodayExceptionAction> = {},
): TodayExceptionAction {
  return {
    id: `today-action-${sourceExceptionId}`,
    sourceExceptionId,
    kind: 'attention-user',
    priority: 'high',
    title: '要確認',
    description: '要確認',
    actionLabel: '確認',
    actionPath: '/path',
    ...overrides,
  };
}

describe('selectTopExceptionAttentionCandidate', () => {
  it('critical だが overdue ではない候補を最上位として抽出できる', () => {
    const sourceExceptions = [
      makeException({
        id: 'critical-fresh',
        category: 'critical-handoff',
        severity: 'critical',
        targetDate: '2026-03-28',
        title: '重要申し送り未対応',
        description: '本日中に確認予定',
      }),
      makeException({
        id: 'overdue-high',
        category: 'attention-user',
        severity: 'high',
        targetDate: '2026-03-24',
        title: '経過観察',
        description: '対応期限が 4日超過',
      }),
    ];
    const actions = [
      makeAction('overdue-high'),
      makeAction('critical-fresh', { kind: 'critical-handoff', priority: 'critical' }),
    ];

    const candidate = selectTopExceptionAttentionCandidate({
      actions,
      sourceExceptions,
      now: new Date('2026-03-28T12:00:00.000Z'),
    });

    expect(candidate?.action.sourceExceptionId).toBe('critical-fresh');
  });

  it('同 severity では overdue 候補を優先できる', () => {
    const sourceExceptions = [
      makeException({
        id: 'fresh-high',
        category: 'attention-user',
        severity: 'high',
        targetDate: '2026-03-28',
        description: '経過観察中',
      }),
      makeException({
        id: 'overdue-high',
        category: 'attention-user',
        severity: 'high',
        targetDate: '2026-03-24',
        description: '対応期限が 4日超過',
      }),
    ];
    const actions = [
      makeAction('fresh-high'),
      makeAction('overdue-high'),
    ];

    const ranked = rankTodayExceptionActionsByPriority({
      actions,
      sourceExceptions,
      now: new Date('2026-03-28T12:00:00.000Z'),
    });

    expect(ranked[0]?.action.sourceExceptionId).toBe('overdue-high');
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it('同一利用者の件数が多い候補を上位にできる', () => {
    const sourceExceptions = [
      makeException({
        id: 'sparse-parent',
        category: 'missing-record',
        severity: 'high',
        targetUserId: 'U-001',
      }),
      makeException({
        id: 'dense-parent',
        category: 'missing-record',
        severity: 'high',
        targetUserId: 'U-002',
      }),
      makeException({
        id: 'sparse-child',
        category: 'missing-record',
        severity: 'high',
        parentId: 'sparse-parent',
        targetUserId: 'U-001',
      }),
      makeException({
        id: 'dense-child-1',
        category: 'missing-record',
        severity: 'high',
        parentId: 'dense-parent',
        targetUserId: 'U-002',
      }),
      makeException({
        id: 'dense-child-2',
        category: 'missing-record',
        severity: 'high',
        parentId: 'dense-parent',
        targetUserId: 'U-002',
      }),
      makeException({
        id: 'dense-child-3',
        category: 'missing-record',
        severity: 'high',
        parentId: 'dense-parent',
        targetUserId: 'U-002',
      }),
    ];
    const actions = [
      makeAction('sparse-parent', { kind: 'missing-record' }),
      makeAction('dense-parent', { kind: 'missing-record' }),
    ];

    const candidate = selectTopExceptionAttentionCandidate({
      actions,
      sourceExceptions,
      now: new Date('2026-03-28T12:00:00.000Z'),
    });

    expect(candidate?.action.sourceExceptionId).toBe('dense-parent');
    expect(candidate?.sourceException.targetUserId).toBe('U-002');
  });
});
