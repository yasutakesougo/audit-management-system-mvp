import { describe, expect, it } from 'vitest';
import type { ExceptionItem } from '../exceptionLogic';
import {
  buildChildCountByParentId,
  computeExceptionPriorityBreakdown,
  computeExceptionPriorityScore,
  extractExceptionPriorityMaterials,
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

  it('signal 重み: sync-fail > missing-driver > stale > none', () => {
    const now = new Date('2026-03-25T12:00:00.000Z');

    const syncFail = makeItem({
      id: 'sync',
      category: 'transport-alert',
      severity: 'medium',
      title: '送迎実績の同期に失敗があります',
    });
    const missingDriver = makeItem({
      id: 'missing-driver',
      category: 'transport-alert',
      severity: 'medium',
      title: '運転者未設定の送迎車両があります',
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
    const missingDriverScore = computeExceptionPriorityScore(missingDriver, { now });
    const staleScore = computeExceptionPriorityScore(stale, { now });
    const plainScore = computeExceptionPriorityScore(plain, { now });

    expect(syncScore).toBeGreaterThan(staleScore);
    expect(syncScore).toBeGreaterThan(missingDriverScore);
    expect(missingDriverScore).toBeGreaterThan(staleScore);
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

  it('期限超過日数が大きいほど優先度が上がる', () => {
    const now = new Date('2026-03-28T12:00:00.000Z');
    const oneDay = makeItem({
      id: 'one-day',
      category: 'overdue-plan',
      targetDate: '2026-03-27',
      updatedAt: '2026-03-27T09:00:00.000Z',
    });
    const fiveDays = makeItem({
      id: 'five-day',
      category: 'overdue-plan',
      targetDate: '2026-03-23',
      updatedAt: '2026-03-23T09:00:00.000Z',
    });

    const oneBreakdown = computeExceptionPriorityBreakdown(oneDay, { now });
    const fiveBreakdown = computeExceptionPriorityBreakdown(fiveDays, { now });

    expect(fiveBreakdown.materials.isOverdue).toBe(true);
    expect(fiveBreakdown.materials.overdueDays).toBeGreaterThan(oneBreakdown.materials.overdueDays);
    expect(fiveBreakdown.overdue).toBeGreaterThan(oneBreakdown.overdue);
    expect(fiveBreakdown.total).toBeGreaterThan(oneBreakdown.total);
  });

  it('corrective-action カテゴリは是正要否加点される', () => {
    const now = new Date('2026-03-25T12:00:00.000Z');
    const corrective = makeItem({
      id: 'corrective',
      category: 'corrective-action',
      severity: 'high',
    });
    const nonCorrective = makeItem({
      id: 'non-corrective',
      category: 'missing-record',
      severity: 'high',
      title: '記録未入力',
      description: '日次記録が未入力です',
    });

    const correctiveBreakdown = computeExceptionPriorityBreakdown(corrective, { now });
    const nonCorrectiveBreakdown = computeExceptionPriorityBreakdown(nonCorrective, { now });

    expect(correctiveBreakdown.materials.requiresCorrectiveAction).toBe(true);
    expect(correctiveBreakdown.correctiveAction).toBeGreaterThan(nonCorrectiveBreakdown.correctiveAction);
    expect(correctiveBreakdown.total).toBeGreaterThan(nonCorrectiveBreakdown.total);
  });

  it('重大カテゴリ（critical-handoff）はカテゴリ加点される', () => {
    const now = new Date('2026-03-25T12:00:00.000Z');
    const criticalCategory = makeItem({
      id: 'critical-category',
      category: 'critical-handoff',
      severity: 'high',
    });
    const nonCriticalCategory = makeItem({
      id: 'non-critical-category',
      category: 'attention-user',
      severity: 'high',
    });

    const criticalBreakdown = computeExceptionPriorityBreakdown(criticalCategory, { now });
    const normalBreakdown = computeExceptionPriorityBreakdown(nonCriticalCategory, { now });

    expect(criticalBreakdown.materials.isCriticalCategory).toBe(true);
    expect(criticalBreakdown.criticalCategory).toBeGreaterThan(normalBreakdown.criticalCategory);
    expect(criticalBreakdown.total).toBeGreaterThan(normalBreakdown.total);
  });

  it('利用者単位の件数が多い parent は userCount 加点される', () => {
    const now = new Date('2026-03-25T12:00:00.000Z');
    const parentSparse = makeItem({
      id: 'parent-sparse',
      category: 'corrective-action',
      severity: 'high',
    });
    const parentDense = makeItem({
      id: 'parent-dense',
      category: 'corrective-action',
      severity: 'high',
    });

    const childCounts = buildChildCountByParentId([
      parentSparse,
      parentDense,
      makeItem({ id: 'child-s-1', parentId: 'parent-sparse' }),
      makeItem({ id: 'child-d-1', parentId: 'parent-dense' }),
      makeItem({ id: 'child-d-2', parentId: 'parent-dense' }),
      makeItem({ id: 'child-d-3', parentId: 'parent-dense' }),
      makeItem({ id: 'child-d-4', parentId: 'parent-dense' }),
    ]);

    const sparse = computeExceptionPriorityBreakdown(parentSparse, { now, childCountByParentId: childCounts });
    const dense = computeExceptionPriorityBreakdown(parentDense, { now, childCountByParentId: childCounts });

    expect(dense.materials.userExceptionCount).toBeGreaterThan(sparse.materials.userExceptionCount);
    expect(dense.userCount).toBeGreaterThan(sparse.userCount);
    expect(dense.total).toBeGreaterThan(sparse.total);
  });

  it('priority 材料抽出は公開ヘルパーで取得できる', () => {
    const materials = extractExceptionPriorityMaterials(
      makeItem({
        id: 'materials',
        category: 'critical-handoff',
        targetDate: '2026-03-23',
      }),
      { now: new Date('2026-03-28T12:00:00.000Z') },
    );

    expect(materials.isOverdue).toBe(true);
    expect(materials.overdueDays).toBeGreaterThan(0);
    expect(materials.isCriticalCategory).toBe(true);
  });
});
