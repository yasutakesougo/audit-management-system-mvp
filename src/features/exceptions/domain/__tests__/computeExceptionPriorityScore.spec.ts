import { describe, expect, it } from 'vitest';
import type { ExceptionItem } from '../exceptionLogic';
import {
  buildChildCountByParentId,
  computeExceptionPriorityBreakdown,
  computeExceptionPriorityScore,
} from '../computeExceptionPriorityScore';

function makeItem(overrides: Partial<ExceptionItem> & { id: string }): ExceptionItem {
  return {
    category: 'missing-record',
    severity: 'medium',
    title: 'テスト例外',
    description: 'テスト説明',
    updatedAt: '2026-03-25T08:00:00.000Z',
    ...overrides,
  };
}

describe('computeExceptionPriorityScore', () => {
  it('severity の重み: critical > high > medium > low', () => {
    const now = new Date('2026-03-25T12:00:00.000Z');
    const low = computeExceptionPriorityScore(makeItem({ id: 'low', severity: 'low' }), { now });
    const medium = computeExceptionPriorityScore(makeItem({ id: 'medium', severity: 'medium' }), { now });
    const high = computeExceptionPriorityScore(makeItem({ id: 'high', severity: 'high' }), { now });
    const critical = computeExceptionPriorityScore(makeItem({ id: 'critical', severity: 'critical' }), { now });

    expect(critical).toBeGreaterThan(high);
    expect(high).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(low);
  });

  it('構造重み: child > parent > standalone', () => {
    const now = new Date('2026-03-25T12:00:00.000Z');

    const parent = makeItem({ id: 'parent', severity: 'high' });
    const child = makeItem({ id: 'child', severity: 'high', parentId: 'parent' });
    const standalone = makeItem({ id: 'standalone', severity: 'high' });

    const childCounts = buildChildCountByParentId([parent, child, standalone]);

    const parentScore = computeExceptionPriorityScore(parent, { now, childCountByParentId: childCounts });
    const childScore = computeExceptionPriorityScore(child, { now, childCountByParentId: childCounts });
    const standaloneScore = computeExceptionPriorityScore(standalone, { now, childCountByParentId: childCounts });

    expect(childScore).toBeGreaterThan(parentScore);
    expect(parentScore).toBeGreaterThan(standaloneScore);
  });

  it('signal 重み: sync-fail > stale > none', () => {
    const now = new Date('2026-03-25T12:00:00.000Z');

    const syncFail = makeItem({
      id: 'sync',
      category: 'transport-alert',
      severity: 'medium',
      title: '送迎実績の同期に失敗があります',
    });
    const stale = makeItem({
      id: 'stale',
      category: 'transport-alert',
      severity: 'medium',
      title: '送迎ステータスが長時間停滞中',
    });
    const plain = makeItem({
      id: 'plain',
      category: 'transport-alert',
      severity: 'medium',
      title: '送迎アラート',
    });

    const syncScore = computeExceptionPriorityScore(syncFail, { now });
    const staleScore = computeExceptionPriorityScore(stale, { now });
    const plainScore = computeExceptionPriorityScore(plain, { now });

    expect(syncScore).toBeGreaterThan(staleScore);
    expect(staleScore).toBeGreaterThan(plainScore);
  });

  it('経過時間が長いほど加点される', () => {
    const now = new Date('2026-03-25T12:00:00.000Z');

    const recent = makeItem({
      id: 'recent',
      updatedAt: '2026-03-25T11:50:00.000Z',
    });
    const old = makeItem({
      id: 'old',
      updatedAt: '2026-03-23T12:00:00.000Z',
    });

    const recentBreakdown = computeExceptionPriorityBreakdown(recent, { now });
    const oldBreakdown = computeExceptionPriorityBreakdown(old, { now });

    expect(oldBreakdown.age).toBeGreaterThan(recentBreakdown.age);
    expect(oldBreakdown.total).toBeGreaterThan(recentBreakdown.total);
  });

  it('件数・分数情報があるほど volume が加点される', () => {
    const now = new Date('2026-03-25T12:00:00.000Z');

    const baseParent = makeItem({ id: 'parent', severity: 'high' });
    const rich = makeItem({
      id: 'parent-rich',
      severity: 'high',
      title: '送迎停滞 7件',
      description: '移動中のまま 90 分以上経過',
    });

    const sparseChild = makeItem({ id: 's-child', parentId: 'parent' });
    const richChild1 = makeItem({ id: 'r-child-1', parentId: 'parent-rich' });
    const richChild2 = makeItem({ id: 'r-child-2', parentId: 'parent-rich' });
    const richChild3 = makeItem({ id: 'r-child-3', parentId: 'parent-rich' });
    const richChild4 = makeItem({ id: 'r-child-4', parentId: 'parent-rich' });

    const childCounts = buildChildCountByParentId([
      baseParent,
      rich,
      sparseChild,
      richChild1,
      richChild2,
      richChild3,
      richChild4,
    ]);

    const baseBreakdown = computeExceptionPriorityBreakdown(baseParent, { now, childCountByParentId: childCounts });
    const richBreakdown = computeExceptionPriorityBreakdown(rich, { now, childCountByParentId: childCounts });

    expect(richBreakdown.childCount).toBeGreaterThan(baseBreakdown.childCount);
    expect(richBreakdown.volume).toBeGreaterThan(baseBreakdown.volume);
    expect(richBreakdown.total).toBeGreaterThan(baseBreakdown.total);
  });

  it('無効な日付でも例外を投げず計算できる', () => {
    const result = computeExceptionPriorityBreakdown(makeItem({
      id: 'bad-date',
      updatedAt: 'invalid-date',
    }), { now: new Date('2026-03-25T12:00:00.000Z') });

    expect(result.age).toBe(0);
    expect(result.total).toBeGreaterThan(0);
  });
});
