/**
 * useWorkflowPhases — ユニットテスト
 *
 * Hook のリアクティブ部分ではなく、
 * テスト可能な純関数（buildWorkflowItems, countByPhase）をテストする。
 */
import { describe, it, expect } from 'vitest';
import {
  buildWorkflowItems,
  countByPhase,
  toPlanningSheetSnapshot,
} from '../useWorkflowPhases';
import { type PlanningSheetSnapshot } from '@/app/services/bridgeProxy';
import type { PlanningSheetListItem } from '@/domain/isp/schema';

// ─────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────

function makeUser(id: string, name: string) {
  return { userId: id, userName: name };
}

function makeSheet(overrides: Partial<PlanningSheetSnapshot> = {}): PlanningSheetSnapshot {
  return {
    id: 'ps-1',
    status: 'active',
    appliedFrom: '2026-01-01',
    reviewedAt: null,
    reviewCycleDays: 90,
    procedureCount: 5,
    isCurrent: true,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// buildWorkflowItems
// ─────────────────────────────────────────────

describe('buildWorkflowItems', () => {
  it('利用者ごとの phase を正しく判定する', () => {
    const users = [
      makeUser('u-1', '伊藤'),
      makeUser('u-2', '山田'),
      makeUser('u-3', '佐藤'),
    ];

    const sheetsByUser = new Map<string, PlanningSheetSnapshot[]>([
      // u-1: 計画シートあり → active_plan
      ['u-1', [makeSheet({ id: 'ps-1' })]],
      // u-2: 手順なし → needs_plan
      ['u-2', [makeSheet({ id: 'ps-2', procedureCount: 0 })]],
      // u-3: 計画シートなし → needs_assessment
    ]);

    const { results, items } = buildWorkflowItems(users, sheetsByUser, '2026-02-15');

    expect(results.length).toBe(3);
    expect(items.length).toBe(3);

    // 各利用者の phase が正しい
    const phaseByUser = new Map(results.map((r) => [r.userId, r.phase]));
    expect(phaseByUser.get('u-1')).toBe('active_plan');
    expect(phaseByUser.get('u-2')).toBe('needs_plan');
    expect(phaseByUser.get('u-3')).toBe('needs_assessment');
  });

  it('priority 順にソートされる', () => {
    const users = [
      makeUser('u-active', '安定太郎'),
      makeUser('u-overdue', '超過花子'),
      makeUser('u-noplan', '未実施次郎'),
    ];

    const sheetsByUser = new Map<string, PlanningSheetSnapshot[]>([
      // u-active: reviewedAt = 2026-03-20 → next due = 2026-03-20 + 90 = 2026-06-18 → safe
      ['u-active', [makeSheet({ id: 'ps-active', reviewedAt: '2026-03-20' })]],
      // u-overdue: appliedFrom = 2026-01-01 → next due = 2026-04-01 → overdue at 2026-04-10
      ['u-overdue', [makeSheet({ id: 'ps-overdue' })]],
      // u-noplan: なし → needs_assessment (priority 3)
    ]);

    const { items } = buildWorkflowItems(users, sheetsByUser, '2026-04-10');

    // u-overdue: overdue (priority 1), u-noplan: needs_assessment (3), u-active: active (6)
    expect(items[0].userId).toBe('u-overdue');
    expect(items[1].userId).toBe('u-noplan');
    expect(items[2].userId).toBe('u-active');
  });

  it('利用者がいない場合は空配列', () => {
    const { results, items } = buildWorkflowItems([], new Map());
    expect(results).toEqual([]);
    expect(items).toEqual([]);
  });

  it('計画シートがない利用者も needs_assessment として扱える', () => {
    const users = [makeUser('u-new', '新規利用者')];
    const { results } = buildWorkflowItems(users, new Map(), '2026-03-14');

    expect(results[0].phase).toBe('needs_assessment');
    expect(results[0].userId).toBe('u-new');
  });

  it('topPriorityItem が最上位になる', () => {
    const users = [
      makeUser('u-1', '安定'),
      makeUser('u-2', '超過'),
    ];

    const sheetsByUser = new Map<string, PlanningSheetSnapshot[]>([
      ['u-1', [makeSheet()]],
      ['u-2', [makeSheet({ id: 'ps-2' })]],
    ]);

    const { items } = buildWorkflowItems(users, sheetsByUser, '2026-04-10');
    // items[0] should be monitoring_overdue (u-2)
    expect(items[0].phase).toBe('monitoring_overdue');
  });
});

// ─────────────────────────────────────────────
// countByPhase
// ─────────────────────────────────────────────

describe('countByPhase', () => {
  it('フェーズ別件数が正しく集計される', () => {
    const users = [
      makeUser('u-1', 'A'),
      makeUser('u-2', 'B'),
      makeUser('u-3', 'C'),
      makeUser('u-4', 'D'),
      makeUser('u-5', 'E'),
    ];

    const sheetsByUser = new Map<string, PlanningSheetSnapshot[]>([
      ['u-1', [makeSheet()]],                                     // active_plan
      ['u-2', [makeSheet({ id: 'ps-2', procedureCount: 0 })]],    // needs_plan
      // u-3: なし → needs_assessment
      ['u-4', [makeSheet({ id: 'ps-4' })]],                       // monitoring_overdue (@2026-04-10)
      ['u-5', [makeSheet({ id: 'ps-5' })]],                       // needs_monitoring (@2026-03-25)
    ]);

    // 2人の referenceDate を分けたいが buildWorkflowItems は全体に1つ
    // → まず overdue を確認
    const { results } = buildWorkflowItems(users, sheetsByUser, '2026-04-10');
    const counts = countByPhase(results);

    // u-1, u-4, u-5 は全部 overdue (ref: 2026-04-10)
    // u-2 は needs_plan
    // u-3 は needs_assessment
    expect(counts.needsPlan).toBe(1);
    expect(counts.needsAssessment).toBe(1);
    expect(counts.monitoringOverdue).toBe(3); // u-1, u-4, u-5 all overdue at 4/10
  });

  it('空配列では全て 0', () => {
    const counts = countByPhase([]);
    expect(counts.needsAssessment).toBe(0);
    expect(counts.needsPlan).toBe(0);
    expect(counts.monitoringOverdue).toBe(0);
    expect(counts.needsReassessment).toBe(0);
    expect(counts.needsMonitoring).toBe(0);
    expect(counts.activePlan).toBe(0);
  });
});

// ─────────────────────────────────────────────
// toPlanningSheetSnapshot adapter
// ─────────────────────────────────────────────

describe('toPlanningSheetSnapshot', () => {
  it('PlanningSheetListItem を正しく変換する', () => {
    const item: PlanningSheetListItem = {
      id: 'ps-123',
      userId: 'u-1',
      ispId: 'isp-1',
      title: 'テスト計画',
      targetScene: '食事場面',
      status: 'active',
      nextReviewAt: '2026-06-01',
      isCurrent: true,
      applicableServiceType: 'daily_life_care',
      applicableAddOnTypes: ['severe_disability_support'],
      authoredByQualification: 'practical_training',
      reviewedAt: null,
    };

    const snapshot = toPlanningSheetSnapshot(item, 3);

    expect(snapshot.id).toBe('ps-123');
    expect(snapshot.status).toBe('active');
    expect(snapshot.isCurrent).toBe(true);
    expect(snapshot.procedureCount).toBe(3);
    expect(snapshot.reviewCycleDays).toBe(90);
  });

  it('procedureCount 省略時はデフォルト 1', () => {
    const item: PlanningSheetListItem = {
      id: 'ps-456',
      userId: 'u-2',
      ispId: 'isp-2',
      title: '計画2',
      targetScene: null,
      status: 'draft',
      nextReviewAt: null,
      isCurrent: false,
      applicableServiceType: 'other',
      applicableAddOnTypes: ['none'],
      authoredByQualification: 'unknown',
      reviewedAt: null,
    };

    const snapshot = toPlanningSheetSnapshot(item);
    expect(snapshot.procedureCount).toBe(1);
  });
});
