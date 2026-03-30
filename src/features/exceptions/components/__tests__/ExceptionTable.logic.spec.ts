import { describe, expect, it } from 'vitest';
import type { ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';
import {
  buildDisplayRows,
  compareByPriority,
  sortFlatItemsByPriority,
} from '../ExceptionTable.logic';

function makeItem(overrides: Partial<ExceptionItem> & { id: string }): ExceptionItem {
  const { id, ...rest } = overrides;
  return {
    id,
    category: 'missing-record',
    severity: 'high',
    title: '同点テスト',
    description: '同点テスト',
    targetDate: '2026-03-28',
    updatedAt: '2026-03-28T09:00:00.000Z',
    ...rest,
  };
}

describe('ExceptionTable.logic priority stability', () => {
  it('compareByPriority uses id as final tie-break', () => {
    const now = new Date('2026-03-28T12:00:00.000Z');
    const childCountByParentId = new Map<string, number>();

    const a = makeItem({ id: 'a-id' });
    const b = makeItem({ id: 'b-id' });

    expect(compareByPriority(a, b, now, childCountByParentId)).toBeLessThan(0);
    expect(compareByPriority(b, a, now, childCountByParentId)).toBeGreaterThan(0);
  });

  it('buildDisplayRows keeps deterministic order for equal-priority rows', () => {
    const rows = buildDisplayRows({
      items: [
        makeItem({ id: 'z-item' }),
        makeItem({ id: 'a-item' }),
        makeItem({ id: 'm-item' }),
      ],
      categoryFilter: 'all',
      severityFilter: 'all',
      sortMode: 'priority',
      sortOrder: 'severity',
      displayMode: 'flat',
    });

    const rowIds = rows
      .filter((row): row is Extract<typeof rows[number], { kind: 'item' }> => row.kind === 'item')
      .map((row) => row.item.id);

    expect(rowIds).toEqual(['a-item', 'm-item', 'z-item']);
  });

  it('critical だが overdue ではない例外は中位 severity の overdue より先に来る', () => {
    const now = new Date('2026-03-28T12:00:00.000Z');
    const childCountByParentId = new Map<string, number>();
    const criticalNotOverdue = makeItem({
      id: 'critical-fresh',
      category: 'critical-handoff',
      severity: 'critical',
      targetDate: '2026-03-28',
      updatedAt: '2026-03-28T09:00:00.000Z',
      title: '重要申し送り未対応',
      description: '本日中に確認予定',
    });
    const overdueNoCorrective = makeItem({
      id: 'overdue-medium',
      category: 'attention-user',
      severity: 'medium',
      targetDate: '2026-03-25',
      updatedAt: '2026-03-25T09:00:00.000Z',
      title: '経過観察',
      description: '提出期限が 3日超過',
    });

    const sorted = [overdueNoCorrective, criticalNotOverdue].sort((a, b) =>
      compareByPriority(a, b, now, childCountByParentId),
    );
    expect(sorted.map((item) => item.id)).toEqual(['critical-fresh', 'overdue-medium']);
  });

  it('overdue だが corrective action 不要の例外でも同 severity の非 overdue より優先される', () => {
    const now = new Date('2026-03-28T12:00:00.000Z');
    const childCountByParentId = new Map<string, number>();
    const fresh = makeItem({
      id: 'fresh-high',
      category: 'attention-user',
      severity: 'high',
      targetDate: '2026-03-28',
      updatedAt: '2026-03-28T10:00:00.000Z',
      title: '通常確認',
      description: '経過観察中',
    });
    const overdueNoCorrective = makeItem({
      id: 'overdue-high',
      category: 'attention-user',
      severity: 'high',
      targetDate: '2026-03-24',
      updatedAt: '2026-03-24T10:00:00.000Z',
      title: '確認遅延',
      description: '対応期限が 4日超過',
    });

    const sorted = [fresh, overdueNoCorrective].sort((a, b) =>
      compareByPriority(a, b, now, childCountByParentId),
    );
    expect(sorted.map((item) => item.id)).toEqual(['overdue-high', 'fresh-high']);
  });

  it('同一利用者に複数件あるグループは priority sort で先頭にまとまる', () => {
    const items = [
      makeItem({
        id: 'sparse-parent',
        category: 'corrective-action',
        severity: 'high',
        targetUserId: 'U-001',
        targetDate: '2026-03-28',
      }),
      makeItem({
        id: 'dense-parent',
        category: 'corrective-action',
        severity: 'high',
        targetUserId: 'U-002',
        targetDate: '2026-03-28',
      }),
      makeItem({ id: 'sparse-child-1', parentId: 'sparse-parent', targetUserId: 'U-001' }),
      makeItem({ id: 'dense-child-1', parentId: 'dense-parent', targetUserId: 'U-002' }),
      makeItem({ id: 'dense-child-2', parentId: 'dense-parent', targetUserId: 'U-002' }),
      makeItem({ id: 'dense-child-3', parentId: 'dense-parent', targetUserId: 'U-002' }),
    ];

    const sorted = sortFlatItemsByPriority(items);
    const ids = sorted.map((item) => item.id);

    expect(ids.indexOf('dense-parent')).toBeLessThan(ids.indexOf('sparse-parent'));
    expect(ids.slice(0, 4)).toEqual([
      'dense-parent',
      'dense-child-1',
      'dense-child-2',
      'dense-child-3',
    ]);
  });
});
