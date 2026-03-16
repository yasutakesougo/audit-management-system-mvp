import { describe, it, expect } from 'vitest';
import {
  computePdcaCycleMetrics,
  diagnoseCycle,
  type PdcaCycleRecord,
} from '../pdcaCycleMetrics';

// ─── テストデータファクトリ ───────────────────────────────

const TODAY = '2026-03-15T00:00:00Z';

function makeRecord(overrides: Partial<PdcaCycleRecord> = {}): PdcaCycleRecord {
  return {
    cycleId: 'cycle-001',
    userId: 'user-A',
    startedAt: '2026-01-01T00:00:00Z',
    dueAt: '2026-04-01T00:00:00Z',       // 90 日後
    proposalAcceptedAt: null,
    reviewScheduledAt: null,
    reviewCompletedAt: null,
    planUpdatedAt: null,
    ...overrides,
  };
}

/** 完了済みサイクルのテンプレート */
function makeCompleted(overrides: Partial<PdcaCycleRecord> = {}): PdcaCycleRecord {
  return makeRecord({
    proposalAcceptedAt: '2026-02-15T00:00:00Z',
    reviewScheduledAt: '2026-03-01T00:00:00Z',
    reviewCompletedAt: '2026-03-05T00:00:00Z',
    planUpdatedAt: '2026-03-07T00:00:00Z',
    ...overrides,
  });
}

/** 期限超過サイクルのテンプレート */
function makeOverdue(overrides: Partial<PdcaCycleRecord> = {}): PdcaCycleRecord {
  return makeRecord({
    dueAt: '2026-03-01T00:00:00Z',  // TODAY より前
    reviewScheduledAt: '2026-02-25T00:00:00Z',
    // reviewCompletedAt / planUpdatedAt は null（未完了）
    ...overrides,
  });
}

// ─── diagnoseCycle テスト ─────────────────────────────────

describe('diagnoseCycle', () => {
  it('全ステップ完了 → completed', () => {
    const record = makeCompleted();
    const result = diagnoseCycle(record, TODAY);

    expect(result.status).toBe('completed');
    expect(result.overdueDays).toBe(0);
    expect(result.cycleDays).not.toBeNull();
    expect(result.proposalToReviewDays).not.toBeNull();
    expect(result.reviewToPlanUpdateDays).not.toBeNull();
  });

  it('期限内で未完了 → in_progress', () => {
    const record = makeRecord(); // dueAt は 2026-04-01、TODAY は 2026-03-15
    const result = diagnoseCycle(record, TODAY);

    expect(result.status).toBe('in_progress');
    expect(result.overdueDays).toBe(0);
    expect(result.cycleDays).toBeNull();
  });

  it('期限超過で未完了 → overdue', () => {
    const record = makeOverdue();
    const result = diagnoseCycle(record, TODAY);

    expect(result.status).toBe('overdue');
    expect(result.overdueDays).toBe(14); // 3/1 → 3/15
    expect(result.cycleDays).toBeNull();
  });

  it('提案採用後 14 日以上見直し未完了 → stalled', () => {
    const record = makeRecord({
      proposalAcceptedAt: '2026-02-20T00:00:00Z', // TODAY から 23 日前
      reviewScheduledAt: '2026-03-10T00:00:00Z',
      // reviewCompletedAt: null
    });
    const result = diagnoseCycle(record, TODAY);

    expect(result.status).toBe('stalled');
  });

  it('提案採用後 13 日 → まだ stalled ではない', () => {
    const record = makeRecord({
      proposalAcceptedAt: '2026-03-02T00:00:00Z', // TODAY から 13 日前
    });
    const result = diagnoseCycle(record, TODAY);

    expect(result.status).toBe('in_progress');
  });

  it('完了サイクルの cycleDays を正しく計算する', () => {
    const record = makeCompleted({
      startedAt: '2026-01-01T00:00:00Z',
      planUpdatedAt: '2026-03-10T00:00:00Z', // 68 日
    });
    const result = diagnoseCycle(record, TODAY);

    expect(result.cycleDays).toBe(68);
  });

  it('提案→見直しの日数を正しく計算する', () => {
    const record = makeCompleted({
      proposalAcceptedAt: '2026-02-15T00:00:00Z',
      reviewCompletedAt: '2026-02-20T00:00:00Z', // 5 日
    });
    const result = diagnoseCycle(record, TODAY);

    expect(result.proposalToReviewDays).toBe(5);
  });

  it('見直し→計画更新の日数を正しく計算する', () => {
    const record = makeCompleted({
      reviewCompletedAt: '2026-03-05T00:00:00Z',
      planUpdatedAt: '2026-03-08T00:00:00Z', // 3 日
    });
    const result = diagnoseCycle(record, TODAY);

    expect(result.reviewToPlanUpdateDays).toBe(3);
  });

  it('proposalAcceptedAt が null でも proposalToReviewDays は null', () => {
    const record = makeCompleted({
      proposalAcceptedAt: null,
    });
    const result = diagnoseCycle(record, TODAY);

    expect(result.proposalToReviewDays).toBeNull();
  });

  it('完了が期限内なら overdueDays は 0', () => {
    const record = makeCompleted({
      dueAt: '2026-04-01T00:00:00Z',
      planUpdatedAt: '2026-03-10T00:00:00Z', // 期限前に完了
    });
    const result = diagnoseCycle(record, TODAY);

    expect(result.status).toBe('completed');
    expect(result.overdueDays).toBe(0);
  });
});

// ─── computePdcaCycleMetrics テスト ───────────────────────

describe('computePdcaCycleMetrics', () => {
  it('空配列でもエラーなく全指標 0 を返す', () => {
    const result = computePdcaCycleMetrics([], TODAY);

    expect(result.totalCycles).toBe(0);
    expect(result.completedCycles).toBe(0);
    expect(result.inProgressCycles).toBe(0);
    expect(result.overdueCycles).toBe(0);
    expect(result.stalledCycles).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.overdueRate).toBe(0);
    expect(result.stalledRate).toBe(0);
    expect(result.medianCycleDays).toBe(0);
    expect(result.avgCycleDays).toBe(0);
    expect(result.avgOverdueDays).toBe(0);
    expect(result.maxOverdueDays).toBe(0);
    expect(result.reviewCompletionRate).toBe(0);
    expect(result.medianProposalToReviewDays).toBe(0);
    expect(result.medianReviewToPlanUpdateDays).toBe(0);
    expect(result.alerts).toHaveLength(0);
  });

  it('全サイクル完了 → 完走率 100%', () => {
    const records: PdcaCycleRecord[] = [
      makeCompleted({ cycleId: 'c-1', userId: 'A' }),
      makeCompleted({ cycleId: 'c-2', userId: 'B' }),
      makeCompleted({ cycleId: 'c-3', userId: 'C' }),
    ];

    const result = computePdcaCycleMetrics(records, TODAY);

    expect(result.totalCycles).toBe(3);
    expect(result.completedCycles).toBe(3);
    expect(result.completionRate).toBe(100);
    expect(result.overdueCycles).toBe(0);
    expect(result.overdueRate).toBe(0);
    expect(result.alerts).toHaveLength(0);
  });

  it('期限超過サイクルの集計が正しい', () => {
    const records: PdcaCycleRecord[] = [
      makeOverdue({ cycleId: 'c-1', userId: 'A', dueAt: '2026-03-05T00:00:00Z' }), // 10 日超過
      makeOverdue({ cycleId: 'c-2', userId: 'B', dueAt: '2026-03-01T00:00:00Z' }), // 14 日超過
    ];

    const result = computePdcaCycleMetrics(records, TODAY);

    expect(result.overdueCycles).toBe(2);
    expect(result.overdueRate).toBe(100);
    expect(result.avgOverdueDays).toBe(12);
    expect(result.maxOverdueDays).toBe(14);
  });

  it('alerts は overdue + stalled のみ、overdueDays 降順', () => {
    const records: PdcaCycleRecord[] = [
      makeCompleted({ cycleId: 'c-1', userId: 'A' }),
      makeOverdue({ cycleId: 'c-2', userId: 'B', dueAt: '2026-03-10T00:00:00Z' }), // 5 日超過
      makeOverdue({ cycleId: 'c-3', userId: 'C', dueAt: '2026-03-01T00:00:00Z' }), // 14 日超過
      makeRecord({ cycleId: 'c-4', userId: 'D' }), // in_progress
    ];

    const result = computePdcaCycleMetrics(records, TODAY);

    expect(result.alerts).toHaveLength(2);
    expect(result.alerts[0].cycleId).toBe('c-3'); // 14 日超過が先
    expect(result.alerts[1].cycleId).toBe('c-2'); // 5 日超過が後
  });

  it('モニタリング実施率を正しく計算する', () => {
    const records: PdcaCycleRecord[] = [
      makeRecord({
        cycleId: 'c-1',
        reviewScheduledAt: '2026-03-01T00:00:00Z',
        reviewCompletedAt: '2026-03-05T00:00:00Z',
        planUpdatedAt: '2026-03-07T00:00:00Z',
      }),
      makeRecord({
        cycleId: 'c-2',
        reviewScheduledAt: '2026-03-10T00:00:00Z',
        // reviewCompletedAt: null → 未実施
      }),
      makeRecord({
        cycleId: 'c-3',
        // reviewScheduledAt: null → 予定なし（分母に含まない）
      }),
    ];

    const result = computePdcaCycleMetrics(records, TODAY);

    // 予定あり 2 件のうち完了 1 件 → 50%
    expect(result.reviewCompletionRate).toBe(50);
  });

  it('速度指標の中央値を正しく計算する', () => {
    const records: PdcaCycleRecord[] = [
      makeCompleted({
        cycleId: 'c-1',
        proposalAcceptedAt: '2026-02-10T00:00:00Z',
        reviewCompletedAt: '2026-02-13T00:00:00Z',    // 3 日
        planUpdatedAt: '2026-02-14T00:00:00Z',         // 1 日
      }),
      makeCompleted({
        cycleId: 'c-2',
        proposalAcceptedAt: '2026-02-15T00:00:00Z',
        reviewCompletedAt: '2026-02-22T00:00:00Z',    // 7 日
        planUpdatedAt: '2026-02-25T00:00:00Z',         // 3 日
      }),
      makeCompleted({
        cycleId: 'c-3',
        proposalAcceptedAt: '2026-02-20T00:00:00Z',
        reviewCompletedAt: '2026-02-25T00:00:00Z',    // 5 日
        planUpdatedAt: '2026-02-27T00:00:00Z',         // 2 日
      }),
    ];

    const result = computePdcaCycleMetrics(records, TODAY);

    // 提案→見直し: [3, 5, 7] → 中央値 5
    expect(result.medianProposalToReviewDays).toBe(5);
    // 見直し→計画更新: [1, 2, 3] → 中央値 2
    expect(result.medianReviewToPlanUpdateDays).toBe(2);
  });
});

// ─── 統合テスト: 現実的なシナリオ ─────────────────────────

describe('realistic scenario', () => {
  it('1 事業所 3 ヶ月分の運用データを正しく集計する', () => {
    const records: PdcaCycleRecord[] = [
      // 利用者 A: 完了（順調）
      makeCompleted({
        cycleId: 'A-cycle1',
        userId: 'user-A',
        startedAt: '2025-12-01T00:00:00Z',
        dueAt: '2026-03-01T00:00:00Z',
        proposalAcceptedAt: '2026-02-10T00:00:00Z',
        reviewScheduledAt: '2026-02-20T00:00:00Z',
        reviewCompletedAt: '2026-02-22T00:00:00Z',    // 提案→12日
        planUpdatedAt: '2026-02-24T00:00:00Z',         // 見直し→2日, 全体85日
      }),

      // 利用者 B: 完了（やや遅い）
      makeCompleted({
        cycleId: 'B-cycle1',
        userId: 'user-B',
        startedAt: '2025-12-15T00:00:00Z',
        dueAt: '2026-03-15T00:00:00Z',
        proposalAcceptedAt: '2026-02-20T00:00:00Z',
        reviewScheduledAt: '2026-03-01T00:00:00Z',
        reviewCompletedAt: '2026-03-05T00:00:00Z',    // 提案→13日
        planUpdatedAt: '2026-03-10T00:00:00Z',         // 見直し→5日, 全体85日
      }),

      // 利用者 C: 期限超過（モニタリング未実施）
      makeOverdue({
        cycleId: 'C-cycle1',
        userId: 'user-C',
        startedAt: '2025-12-01T00:00:00Z',
        dueAt: '2026-03-01T00:00:00Z',                // 14 日超過
        reviewScheduledAt: '2026-02-25T00:00:00Z',
      }),

      // 利用者 D: 進行中（期限前）
      makeRecord({
        cycleId: 'D-cycle1',
        userId: 'user-D',
        startedAt: '2026-01-15T00:00:00Z',
        dueAt: '2026-04-15T00:00:00Z',
        proposalAcceptedAt: '2026-03-10T00:00:00Z',
        reviewScheduledAt: '2026-03-20T00:00:00Z',
      }),

      // 利用者 E: 停滞（提案採用後 20 日動きなし）
      makeRecord({
        cycleId: 'E-cycle1',
        userId: 'user-E',
        startedAt: '2026-01-01T00:00:00Z',
        dueAt: '2026-04-01T00:00:00Z',
        proposalAcceptedAt: '2026-02-20T00:00:00Z',   // 23 日前
        reviewScheduledAt: '2026-03-10T00:00:00Z',
      }),
    ];

    const result = computePdcaCycleMetrics(records, TODAY);

    // 状態分布
    expect(result.totalCycles).toBe(5);
    expect(result.completedCycles).toBe(2);
    expect(result.inProgressCycles).toBe(1);
    expect(result.overdueCycles).toBe(1);
    expect(result.stalledCycles).toBe(1);

    // 完走率: 2/5 = 40%
    expect(result.completionRate).toBe(40);

    // 超過率: 1/5 = 20%
    expect(result.overdueRate).toBe(20);

    // 停滞率: 1/5 = 20%
    expect(result.stalledRate).toBe(20);

    // 超過日数
    expect(result.avgOverdueDays).toBe(14);
    expect(result.maxOverdueDays).toBe(14);

    // モニタリング実施率: 予定 5 件のうち完了 2 件 → 40%
    expect(result.reviewCompletionRate).toBe(40);

    // alerts: overdue + stalled = 2 件
    expect(result.alerts).toHaveLength(2);
    expect(result.alerts[0].userId).toBe('user-C'); // 14日超過
    expect(result.alerts[0].status).toBe('overdue');
  });
});
