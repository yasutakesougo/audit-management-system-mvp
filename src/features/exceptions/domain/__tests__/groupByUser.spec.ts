/**
 * groupExceptionsByUser — Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { groupExceptionsByUser } from '../groupByUser';
import type { ExceptionItem } from '../exceptionLogic';

function makeItem(overrides: Partial<ExceptionItem> & { id: string }): ExceptionItem {
  return {
    category: 'corrective-action',
    severity: 'medium',
    title: 'テスト提案',
    description: 'テスト説明',
    updatedAt: '2026-03-21T09:00:00Z',
    ...overrides,
  };
}

describe('groupExceptionsByUser', () => {
  it('空配列で空配列を返す', () => {
    expect(groupExceptionsByUser([])).toEqual([]);
  });

  it('同一利用者の提案をまとめる', () => {
    const items: ExceptionItem[] = [
      makeItem({ id: '1', targetUserId: 'user-001', severity: 'medium' }),
      makeItem({ id: '2', targetUserId: 'user-001', severity: 'high' }),
    ];

    const result = groupExceptionsByUser(items);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('user-001');
    expect(result[0].count).toBe(2);
    expect(result[0].items).toHaveLength(2);
  });

  it('highest severity が代表になる', () => {
    const items: ExceptionItem[] = [
      makeItem({ id: '1', targetUserId: 'user-001', severity: 'medium' }),
      makeItem({ id: '2', targetUserId: 'user-001', severity: 'critical' }),
      makeItem({ id: '3', targetUserId: 'user-001', severity: 'high' }),
    ];

    const result = groupExceptionsByUser(items);
    expect(result[0].highestSeverity).toBe('critical');
  });

  it('highest severity の降順でソートされる', () => {
    const items: ExceptionItem[] = [
      makeItem({ id: '1', targetUserId: 'user-low', severity: 'low' }),
      makeItem({ id: '2', targetUserId: 'user-critical', severity: 'critical' }),
      makeItem({ id: '3', targetUserId: 'user-high', severity: 'high' }),
    ];

    const result = groupExceptionsByUser(items);
    expect(result.map((g) => g.userId)).toEqual([
      'user-critical',
      'user-high',
      'user-low',
    ]);
  });

  it('corrective-action 以外のカテゴリは無視する', () => {
    const items: ExceptionItem[] = [
      makeItem({ id: '1', targetUserId: 'user-001', category: 'missing-record' }),
      makeItem({ id: '2', targetUserId: 'user-001', category: 'corrective-action' }),
    ];

    const result = groupExceptionsByUser(items);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
  });

  it('targetUserId が未設定の場合 __unknown__ にまとめる', () => {
    const items: ExceptionItem[] = [
      makeItem({ id: '1', targetUserId: undefined }),
      makeItem({ id: '2', targetUserId: undefined }),
    ];

    const result = groupExceptionsByUser(items);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('__unknown__');
    expect(result[0].count).toBe(2);
  });

  it('userName は最初の item から取得される', () => {
    const items: ExceptionItem[] = [
      makeItem({ id: '1', targetUserId: 'user-001', targetUser: '山田太郎' }),
      makeItem({ id: '2', targetUserId: 'user-001', targetUser: '山田太郎' }),
    ];

    const result = groupExceptionsByUser(items);
    expect(result[0].userName).toBe('山田太郎');
  });

  it('同一 severity のグループは userId 辞書順', () => {
    const items: ExceptionItem[] = [
      makeItem({ id: '1', targetUserId: 'user-c', severity: 'high' }),
      makeItem({ id: '2', targetUserId: 'user-a', severity: 'high' }),
      makeItem({ id: '3', targetUserId: 'user-b', severity: 'high' }),
    ];

    const result = groupExceptionsByUser(items);
    expect(result.map((g) => g.userId)).toEqual(['user-a', 'user-b', 'user-c']);
  });
});
