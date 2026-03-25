/**
 * groupExceptionsByParent のテスト
 *
 * 親子構造化 + 初期展開判定のテスト
 */

import { describe, expect, it } from 'vitest';
import type { ExceptionItem } from '../domain/exceptionLogic';
import {
  getInitialExpandedParents,
  groupExceptionsByParent,
} from '../domain/groupExceptionsByParent';

// ── Test Helpers ────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ExceptionItem> & { id: string }): ExceptionItem {
  return {
    category: 'transport-alert',
    severity: 'medium',
    title: 'Test',
    description: 'desc',
    updatedAt: '2026-03-25',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('groupExceptionsByParent', () => {
  it('parentId のないアイテムは standalone として扱う', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
    const result = groupExceptionsByParent(items);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ kind: 'standalone', item: { id: 'a' } });
    expect(result[1]).toMatchObject({ kind: 'standalone', item: { id: 'b' } });
  });

  it('parentId を持つアイテムの親を parent、子を child として構造化する', () => {
    const items = [
      makeItem({ id: 'parent-1' }),
      makeItem({ id: 'child-1', parentId: 'parent-1' }),
      makeItem({ id: 'child-2', parentId: 'parent-1' }),
    ];
    const result = groupExceptionsByParent(items);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ kind: 'parent', item: { id: 'parent-1' }, childCount: 2 });
    expect(result[1]).toMatchObject({ kind: 'child', item: { id: 'child-1' }, parentId: 'parent-1' });
    expect(result[2]).toMatchObject({ kind: 'child', item: { id: 'child-2' }, parentId: 'parent-1' });
  });

  it('親の highestChildSeverity が子の最高 severity を反映する', () => {
    const items = [
      makeItem({ id: 'p' }),
      makeItem({ id: 'c1', parentId: 'p', severity: 'medium' }),
      makeItem({ id: 'c2', parentId: 'p', severity: 'critical' }),
    ];
    const result = groupExceptionsByParent(items);

    const parent = result.find((r) => r.kind === 'parent');
    expect(parent).toBeDefined();
    if (parent?.kind === 'parent') {
      expect(parent.highestChildSeverity).toBe('critical');
    }
  });

  it('親がいない orphan 子は standalone として扱う', () => {
    const items = [makeItem({ id: 'orphan', parentId: 'nonexistent' })];
    const result = groupExceptionsByParent(items);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'standalone', item: { id: 'orphan' } });
  });

  it('混在する親子 + standalone を正しく並べる', () => {
    const items = [
      makeItem({ id: 'standalone-1' }),
      makeItem({ id: 'parent-a' }),
      makeItem({ id: 'child-a1', parentId: 'parent-a' }),
      makeItem({ id: 'standalone-2' }),
    ];
    const result = groupExceptionsByParent(items);

    expect(result.map((r) => r.item.id)).toEqual([
      'standalone-1',
      'parent-a',
      'child-a1',
      'standalone-2',
    ]);
  });

  it('子が0件の場合は standalone として扱う', () => {
    const items = [makeItem({ id: 'lonely-parent' })];
    const result = groupExceptionsByParent(items);

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('standalone');
  });
});

describe('getInitialExpandedParents', () => {
  it('critical の子がいる親を展開する', () => {
    const groups = groupExceptionsByParent([
      makeItem({ id: 'p1' }),
      makeItem({ id: 'c1', parentId: 'p1', severity: 'critical' }),
    ]);
    const expanded = getInitialExpandedParents(groups);
    expect(expanded.has('p1')).toBe(true);
  });

  it('high の子がいる親を展開する', () => {
    const groups = groupExceptionsByParent([
      makeItem({ id: 'p2' }),
      makeItem({ id: 'c2', parentId: 'p2', severity: 'high' }),
    ]);
    const expanded = getInitialExpandedParents(groups);
    expect(expanded.has('p2')).toBe(true);
  });

  it('medium/low のみの親は折りたたむ', () => {
    const groups = groupExceptionsByParent([
      makeItem({ id: 'p3' }),
      makeItem({ id: 'c3', parentId: 'p3', severity: 'medium' }),
    ]);
    const expanded = getInitialExpandedParents(groups);
    expect(expanded.has('p3')).toBe(false);
  });

  it('複数の親がある場合、条件に合うもののみ展開する', () => {
    const groups = groupExceptionsByParent([
      makeItem({ id: 'critical-parent' }),
      makeItem({ id: 'cc', parentId: 'critical-parent', severity: 'critical' }),
      makeItem({ id: 'medium-parent' }),
      makeItem({ id: 'mc', parentId: 'medium-parent', severity: 'medium' }),
    ]);
    const expanded = getInitialExpandedParents(groups);
    expect(expanded.has('critical-parent')).toBe(true);
    expect(expanded.has('medium-parent')).toBe(false);
  });
});
