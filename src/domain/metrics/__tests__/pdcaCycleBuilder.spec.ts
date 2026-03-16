import { describe, it, expect } from 'vitest';
import {
  buildPdcaCycleRecords,
  buildAllPdcaCycleRecords,
} from '../adapters/pdcaCycleBuilder';
import type { SuggestionAction } from '@/features/daily/domain/suggestionAction';

// ─── テストデータファクトリ ───────────────────────────────

function makeAction(overrides: Partial<SuggestionAction> = {}): SuggestionAction {
  return {
    action: 'accept',
    ruleId: 'highCoOccurrence.001',
    category: 'pattern',
    message: 'テスト提案',
    evidence: 'テスト根拠',
    timestamp: '2026-02-10T09:00:00Z',
    userId: 'user-A',
    ...overrides,
  };
}

// ─── buildPdcaCycleRecords ───────────────────────────────

describe('buildPdcaCycleRecords', () => {
  it('支援開始日から 90 日単位でサイクルを生成する', () => {
    const result = buildPdcaCycleRecords({
      userId: 'user-A',
      supportStartDate: '2026-01-01T00:00:00Z',
      today: '2026-06-01T00:00:00Z',
      maxRounds: 2,
    });

    expect(result).toHaveLength(2);
    expect(result[0].cycleId).toBe('user-A-cycle-1');
    expect(result[1].cycleId).toBe('user-A-cycle-2');
  });

  it('cycleId が userId-cycle-{round} になる', () => {
    const result = buildPdcaCycleRecords({
      userId: 'user-B',
      supportStartDate: '2026-01-01T00:00:00Z',
      maxRounds: 3,
      today: '2026-12-01T00:00:00Z',
    });

    expect(result[0].cycleId).toBe('user-B-cycle-1');
    expect(result[1].cycleId).toBe('user-B-cycle-2');
    expect(result[2].cycleId).toBe('user-B-cycle-3');
  });

  it('startedAt と dueAt が cycleDays 間隔になる', () => {
    const result = buildPdcaCycleRecords({
      userId: 'user-A',
      supportStartDate: '2026-01-01T00:00:00Z',
      cycleDays: 90,
      maxRounds: 2,
      today: '2026-12-01T00:00:00Z',
    });

    // round 1: 1/1 → 4/1
    expect(result[0].startedAt).toContain('2026-01-01');
    expect(result[0].dueAt).toContain('2026-04-01');

    // round 2: 4/1 → 6/30
    expect(result[1].startedAt).toContain('2026-04-01');
    expect(result[1].dueAt).toContain('2026-06-30');
  });

  it('reviewScheduledAt は dueAt と同じ', () => {
    const result = buildPdcaCycleRecords({
      userId: 'user-A',
      supportStartDate: '2026-01-01T00:00:00Z',
      maxRounds: 1,
      today: '2026-06-01T00:00:00Z',
    });

    expect(result[0].reviewScheduledAt).toBe(result[0].dueAt);
  });

  it('proposalAcceptedAt: サイクル期間内の最初の accept を取得する', () => {
    const actions = [
      // サイクル 1 期間内（1/1〜4/1）の accept
      makeAction({ timestamp: '2026-02-15T09:00:00Z', action: 'accept' }),
      makeAction({ timestamp: '2026-02-10T09:00:00Z', action: 'accept' }), // これが最初
      makeAction({ timestamp: '2026-03-01T09:00:00Z', action: 'dismiss' }),
      // サイクル 2 期間内の accept
      makeAction({ timestamp: '2026-05-01T09:00:00Z', action: 'accept' }),
    ];

    const result = buildPdcaCycleRecords({
      userId: 'user-A',
      supportStartDate: '2026-01-01T00:00:00Z',
      suggestionActions: actions,
      maxRounds: 2,
      today: '2026-07-01T00:00:00Z',
    });

    // cycle 1: 最初の accept は 2/10
    expect(result[0].proposalAcceptedAt).toBe('2026-02-10T09:00:00Z');
    // cycle 2: 5/1
    expect(result[1].proposalAcceptedAt).toBe('2026-05-01T09:00:00Z');
  });

  it('accept がない場合は proposalAcceptedAt が null', () => {
    const result = buildPdcaCycleRecords({
      userId: 'user-A',
      supportStartDate: '2026-01-01T00:00:00Z',
      suggestionActions: [],
      maxRounds: 1,
      today: '2026-06-01T00:00:00Z',
    });

    expect(result[0].proposalAcceptedAt).toBeNull();
  });

  it('monitoringCompletions と planUpdateDates を正しく反映する', () => {
    const monitoringCompletions = new Map<number, string>();
    monitoringCompletions.set(1, '2026-03-20T00:00:00Z');

    const planUpdateDates = new Map<number, string>();
    planUpdateDates.set(1, '2026-03-25T00:00:00Z');

    const result = buildPdcaCycleRecords({
      userId: 'user-A',
      supportStartDate: '2026-01-01T00:00:00Z',
      monitoringCompletions,
      planUpdateDates,
      maxRounds: 2,
      today: '2026-07-01T00:00:00Z',
    });

    // cycle 1: 完了データあり
    expect(result[0].reviewCompletedAt).toBe('2026-03-20T00:00:00Z');
    expect(result[0].planUpdatedAt).toBe('2026-03-25T00:00:00Z');

    // cycle 2: 完了データなし
    expect(result[1].reviewCompletedAt).toBeNull();
    expect(result[1].planUpdatedAt).toBeNull();
  });

  it('maxRounds 未指定時は today までのサイクル数を自動算出する', () => {
    // 1/1 → 6/1 = 151日 → ceil(151/90) = 2 ラウンド
    const result = buildPdcaCycleRecords({
      userId: 'user-A',
      supportStartDate: '2026-01-01T00:00:00Z',
      today: '2026-06-01T00:00:00Z',
    });

    expect(result).toHaveLength(2);
  });

  it('cycleDays カスタム値が反映される', () => {
    const result = buildPdcaCycleRecords({
      userId: 'user-A',
      supportStartDate: '2026-01-01T00:00:00Z',
      cycleDays: 180,
      maxRounds: 1,
      today: '2026-12-01T00:00:00Z',
    });

    // 180日後
    expect(result[0].dueAt).toContain('2026-06-30');
  });
});

// ─── buildAllPdcaCycleRecords ────────────────────────────

describe('buildAllPdcaCycleRecords', () => {
  it('空配列は空を返す', () => {
    expect(buildAllPdcaCycleRecords([])).toEqual([]);
  });

  it('複数利用者分をフラットに構築する', () => {
    const result = buildAllPdcaCycleRecords([
      {
        userId: 'user-A',
        supportStartDate: '2026-01-01T00:00:00Z',
        maxRounds: 2,
        today: '2026-07-01T00:00:00Z',
      },
      {
        userId: 'user-B',
        supportStartDate: '2026-02-01T00:00:00Z',
        maxRounds: 1,
        today: '2026-07-01T00:00:00Z',
      },
    ]);

    expect(result).toHaveLength(3);
    expect(result.filter(r => r.userId === 'user-A')).toHaveLength(2);
    expect(result.filter(r => r.userId === 'user-B')).toHaveLength(1);
  });
});

// ─── 統合テスト: computePdcaCycleMetrics との接続 ─────────

describe('integration with computePdcaCycleMetrics', () => {
  it('構築結果を直接 computePdcaCycleMetrics に渡せる', async () => {
    const { computePdcaCycleMetrics } = await import('../pdcaCycleMetrics');

    const monitoringCompletions = new Map<number, string>();
    monitoringCompletions.set(1, '2026-03-20T00:00:00Z');
    const planUpdateDates = new Map<number, string>();
    planUpdateDates.set(1, '2026-03-25T00:00:00Z');

    const records = buildPdcaCycleRecords({
      userId: 'user-A',
      supportStartDate: '2026-01-01T00:00:00Z',
      monitoringCompletions,
      planUpdateDates,
      maxRounds: 2,
      today: '2026-06-01T00:00:00Z',
    });

    const metrics = computePdcaCycleMetrics(records, '2026-06-01T00:00:00Z');

    expect(metrics.totalCycles).toBe(2);
    expect(metrics.completedCycles).toBe(1);
    // cycle 2 は dueAt = 6/30 前なので in_progress
    expect(metrics.inProgressCycles).toBe(1);
  });
});
