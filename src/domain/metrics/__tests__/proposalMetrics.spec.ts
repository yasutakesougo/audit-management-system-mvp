import { describe, it, expect } from 'vitest';
import {
  computeProposalMetrics,
  safeRate,
  daysBetween,
  median,
  type ProposalDecisionRecord,
  type MetricsPeriod,
} from '../proposalMetrics';

// ─── ユーティリティ関数テスト ─────────────────────────────

describe('safeRate', () => {
  it('分母 0 のとき 0 を返す', () => {
    expect(safeRate(5, 0)).toBe(0);
  });

  it('通常の割合を小数 1 桁で返す', () => {
    expect(safeRate(3, 10)).toBe(30);
  });

  it('100% を返す', () => {
    expect(safeRate(7, 7)).toBe(100);
  });

  it('小数を丸める', () => {
    // 1/3 ≈ 33.333...% → 33.3
    expect(safeRate(1, 3)).toBe(33.3);
  });
});

describe('daysBetween', () => {
  it('同日は 0 を返す', () => {
    expect(daysBetween('2026-03-01T00:00:00Z', '2026-03-01T00:00:00Z')).toBe(0);
  });

  it('1 日差を返す', () => {
    expect(daysBetween('2026-03-01T00:00:00Z', '2026-03-02T00:00:00Z')).toBe(1);
  });

  it('順序に依存しない（絶対値）', () => {
    expect(daysBetween('2026-03-05T00:00:00Z', '2026-03-01T00:00:00Z')).toBe(4);
  });

  it('半日差を返す', () => {
    expect(daysBetween('2026-03-01T00:00:00Z', '2026-03-01T12:00:00Z')).toBe(0.5);
  });
});

describe('median', () => {
  it('空配列は 0 を返す', () => {
    expect(median([])).toBe(0);
  });

  it('要素 1 つはそのまま返す', () => {
    expect(median([3])).toBe(3);
  });

  it('奇数個の中央値を返す', () => {
    expect(median([1, 3, 5])).toBe(3);
  });

  it('偶数個の中央値を平均で返す', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('ソートされていない配列でも正しい', () => {
    expect(median([5, 1, 3])).toBe(3);
  });
});

// ─── テストデータファクトリ ───────────────────────────────

const period: MetricsPeriod = {
  start: '2026-02-01',
  end: '2026-02-28',
};

function makeRecord(overrides: Partial<ProposalDecisionRecord> = {}): ProposalDecisionRecord {
  return {
    proposalId: 'p-001',
    source: 'handoff',
    urgency: 'recommended',
    action: 'accepted',
    selectedFields: ['supportPolicy', 'environmentalAdjustment'],
    generatedAt: '2026-02-10T09:00:00Z',
    decidedAt: '2026-02-12T14:00:00Z',
    ...overrides,
  };
}

// ─── computeProposalMetrics テスト ────────────────────────

describe('computeProposalMetrics', () => {
  it('空配列でもエラーなく全指標 0 を返す', () => {
    const result = computeProposalMetrics([], period);

    expect(result.total).toBe(0);
    expect(result.accepted).toBe(0);
    expect(result.dismissed).toBe(0);
    expect(result.deferred).toBe(0);
    expect(result.acceptanceRate).toBe(0);
    expect(result.dismissalRate).toBe(0);
    expect(result.deferralRate).toBe(0);
    expect(result.totalFieldsApplied).toBe(0);
    expect(result.avgFieldsPerAcceptance).toBe(0);
    expect(result.medianDecisionDays).toBe(0);
    expect(result.avgDecisionDays).toBe(0);
  });

  it('基本的な集計を正しく計算する', () => {
    const records: ProposalDecisionRecord[] = [
      makeRecord({ proposalId: 'p-001', action: 'accepted', selectedFields: ['a', 'b'] }),
      makeRecord({ proposalId: 'p-002', action: 'accepted', selectedFields: ['c'] }),
      makeRecord({ proposalId: 'p-003', action: 'dismissed', dismissReason: 'not_applicable' }),
      makeRecord({ proposalId: 'p-004', action: 'deferred' }),
    ];

    const result = computeProposalMetrics(records, period);

    expect(result.total).toBe(4);
    expect(result.accepted).toBe(2);
    expect(result.dismissed).toBe(1);
    expect(result.deferred).toBe(1);
    expect(result.acceptanceRate).toBe(50);
    expect(result.dismissalRate).toBe(25);
    expect(result.deferralRate).toBe(25);
    expect(result.totalFieldsApplied).toBe(3);
    expect(result.avgFieldsPerAcceptance).toBe(1.5);
  });

  it('判断速度を正しく計算する', () => {
    const records: ProposalDecisionRecord[] = [
      makeRecord({
        proposalId: 'p-001',
        generatedAt: '2026-02-10T00:00:00Z',
        decidedAt: '2026-02-11T00:00:00Z', // 1 日
      }),
      makeRecord({
        proposalId: 'p-002',
        generatedAt: '2026-02-10T00:00:00Z',
        decidedAt: '2026-02-13T00:00:00Z', // 3 日
      }),
      makeRecord({
        proposalId: 'p-003',
        generatedAt: '2026-02-10T00:00:00Z',
        decidedAt: '2026-02-15T00:00:00Z', // 5 日
      }),
    ];

    const result = computeProposalMetrics(records, period);

    expect(result.medianDecisionDays).toBe(3);
    expect(result.avgDecisionDays).toBe(3);
  });

  it('selectedFields が undefined の accepted でもクラッシュしない', () => {
    const records: ProposalDecisionRecord[] = [
      makeRecord({ proposalId: 'p-001', action: 'accepted', selectedFields: undefined }),
    ];

    const result = computeProposalMetrics(records, period);

    expect(result.totalFieldsApplied).toBe(0);
    expect(result.avgFieldsPerAcceptance).toBe(0);
  });
});

// ─── ソース別集計テスト ──────────────────────────────────

describe('bySource', () => {
  it('3 ソースすべてが返される', () => {
    const result = computeProposalMetrics([], period);

    expect(result.bySource).toHaveLength(3);
    expect(result.bySource.map(s => s.source)).toEqual(['handoff', 'abc', 'monitoring']);
  });

  it('ソース別の採用率を正しく計算する', () => {
    const records: ProposalDecisionRecord[] = [
      makeRecord({ proposalId: 'p-001', source: 'handoff', action: 'accepted' }),
      makeRecord({ proposalId: 'p-002', source: 'handoff', action: 'dismissed' }),
      makeRecord({ proposalId: 'p-003', source: 'abc', action: 'accepted' }),
      makeRecord({ proposalId: 'p-004', source: 'abc', action: 'accepted' }),
      makeRecord({ proposalId: 'p-005', source: 'monitoring', action: 'dismissed' }),
    ];

    const result = computeProposalMetrics(records, period);

    const handoff = result.bySource.find(s => s.source === 'handoff')!;
    expect(handoff.total).toBe(2);
    expect(handoff.accepted).toBe(1);
    expect(handoff.acceptanceRate).toBe(50);

    const abc = result.bySource.find(s => s.source === 'abc')!;
    expect(abc.total).toBe(2);
    expect(abc.accepted).toBe(2);
    expect(abc.acceptanceRate).toBe(100);

    const monitoring = result.bySource.find(s => s.source === 'monitoring')!;
    expect(monitoring.total).toBe(1);
    expect(monitoring.accepted).toBe(0);
    expect(monitoring.acceptanceRate).toBe(0);
  });
});

// ─── 却下理由分布テスト ──────────────────────────────────

describe('dismissReasons', () => {
  it('却下がない場合は空配列を返す', () => {
    const records: ProposalDecisionRecord[] = [
      makeRecord({ action: 'accepted' }),
    ];

    const result = computeProposalMetrics(records, period);
    expect(result.dismissReasons).toHaveLength(0);
  });

  it('却下理由を正しく集計する', () => {
    const records: ProposalDecisionRecord[] = [
      makeRecord({ proposalId: 'p-001', action: 'dismissed', dismissReason: 'not_applicable' }),
      makeRecord({ proposalId: 'p-002', action: 'dismissed', dismissReason: 'not_applicable' }),
      makeRecord({ proposalId: 'p-003', action: 'dismissed', dismissReason: 'already_addressed' }),
      makeRecord({ proposalId: 'p-004', action: 'dismissed', dismissReason: 'disagree' }),
    ];

    const result = computeProposalMetrics(records, period);

    expect(result.dismissReasons).toHaveLength(3);
    // 降順ソート
    expect(result.dismissReasons[0].reason).toBe('not_applicable');
    expect(result.dismissReasons[0].count).toBe(2);
    expect(result.dismissReasons[0].rate).toBe(50);
  });

  it('dismissReason が undefined の場合 other に分類する', () => {
    const records: ProposalDecisionRecord[] = [
      makeRecord({ proposalId: 'p-001', action: 'dismissed', dismissReason: undefined }),
    ];

    const result = computeProposalMetrics(records, period);

    expect(result.dismissReasons).toHaveLength(1);
    expect(result.dismissReasons[0].reason).toBe('other');
  });
});

// ─── 緊急度別集計テスト ──────────────────────────────────

describe('byUrgency', () => {
  it('4 つの緊急度すべてが返される', () => {
    const result = computeProposalMetrics([], period);

    expect(result.byUrgency).toHaveLength(4);
    expect(result.byUrgency.map(u => u.urgency)).toEqual([
      'urgent', 'recommended', 'suggested', 'none',
    ]);
  });

  it('緊急度別の採用率を正しく計算する', () => {
    const records: ProposalDecisionRecord[] = [
      makeRecord({ proposalId: 'p-001', urgency: 'urgent', action: 'accepted' }),
      makeRecord({ proposalId: 'p-002', urgency: 'urgent', action: 'accepted' }),
      makeRecord({ proposalId: 'p-003', urgency: 'recommended', action: 'accepted' }),
      makeRecord({ proposalId: 'p-004', urgency: 'recommended', action: 'dismissed' }),
      makeRecord({ proposalId: 'p-005', urgency: undefined, action: 'deferred' }),
    ];

    const result = computeProposalMetrics(records, period);

    const urgent = result.byUrgency.find(u => u.urgency === 'urgent')!;
    expect(urgent.total).toBe(2);
    expect(urgent.acceptanceRate).toBe(100);

    const recommended = result.byUrgency.find(u => u.urgency === 'recommended')!;
    expect(recommended.total).toBe(2);
    expect(recommended.acceptanceRate).toBe(50);

    const none = result.byUrgency.find(u => u.urgency === 'none')!;
    expect(none.total).toBe(1);
    expect(none.acceptanceRate).toBe(0);
  });
});

// ─── 統合テスト: 現実的なシナリオ ─────────────────────────

describe('realistic scenario', () => {
  it('1 ヶ月分の運用データを正しく集計する', () => {
    const records: ProposalDecisionRecord[] = [
      // 申し送り系: 5件（3 accept, 1 dismiss, 1 defer）
      makeRecord({ proposalId: 'h-01', source: 'handoff', urgency: 'recommended', action: 'accepted', selectedFields: ['supportPolicy', 'environmentalAdjustment'], generatedAt: '2026-02-05T09:00:00Z', decidedAt: '2026-02-06T14:00:00Z' }),
      makeRecord({ proposalId: 'h-02', source: 'handoff', urgency: 'suggested', action: 'accepted', selectedFields: ['preSupport'], generatedAt: '2026-02-10T09:00:00Z', decidedAt: '2026-02-10T15:00:00Z' }),
      makeRecord({ proposalId: 'h-03', source: 'handoff', urgency: 'urgent', action: 'accepted', selectedFields: ['emergencyResponse', 'crisisSupport'], generatedAt: '2026-02-15T09:00:00Z', decidedAt: '2026-02-15T10:00:00Z' }),
      makeRecord({ proposalId: 'h-04', source: 'handoff', urgency: 'recommended', action: 'dismissed', dismissReason: 'already_addressed', generatedAt: '2026-02-18T09:00:00Z', decidedAt: '2026-02-19T09:00:00Z' }),
      makeRecord({ proposalId: 'h-05', source: 'handoff', urgency: 'suggested', action: 'deferred', generatedAt: '2026-02-22T09:00:00Z', decidedAt: '2026-02-25T09:00:00Z' }),

      // ABC系: 3件（2 accept, 1 dismiss）
      makeRecord({ proposalId: 'a-01', source: 'abc', urgency: 'urgent', action: 'accepted', selectedFields: ['environmentalAdjustment'], generatedAt: '2026-02-08T09:00:00Z', decidedAt: '2026-02-09T09:00:00Z' }),
      makeRecord({ proposalId: 'a-02', source: 'abc', urgency: 'recommended', action: 'accepted', selectedFields: ['evaluationIndicator'], generatedAt: '2026-02-12T09:00:00Z', decidedAt: '2026-02-14T09:00:00Z' }),
      makeRecord({ proposalId: 'a-03', source: 'abc', urgency: 'recommended', action: 'dismissed', dismissReason: 'not_applicable', generatedAt: '2026-02-20T09:00:00Z', decidedAt: '2026-02-21T09:00:00Z' }),

      // モニタリング系: 2件（1 accept, 1 dismiss）
      makeRecord({ proposalId: 'm-01', source: 'monitoring', urgency: 'recommended', action: 'accepted', selectedFields: ['supportPolicy', 'goalRevision', 'environmentalAdjustment'], generatedAt: '2026-02-01T09:00:00Z', decidedAt: '2026-02-03T09:00:00Z' }),
      makeRecord({ proposalId: 'm-02', source: 'monitoring', urgency: 'suggested', action: 'dismissed', dismissReason: 'insufficient_data', generatedAt: '2026-02-25T09:00:00Z', decidedAt: '2026-02-26T09:00:00Z' }),
    ];

    const result = computeProposalMetrics(records, period);

    // 全体
    expect(result.total).toBe(10);
    expect(result.accepted).toBe(6);
    expect(result.dismissed).toBe(3);
    expect(result.deferred).toBe(1);
    expect(result.acceptanceRate).toBe(60);
    expect(result.dismissalRate).toBe(30);
    expect(result.deferralRate).toBe(10);

    // フィールド
    expect(result.totalFieldsApplied).toBe(10);
    // 10 fields / 6 accepted = 1.666... → 1.7
    expect(result.avgFieldsPerAcceptance).toBe(1.7);

    // ソース別
    const handoff = result.bySource.find(s => s.source === 'handoff')!;
    expect(handoff.total).toBe(5);
    expect(handoff.acceptanceRate).toBe(60);

    const abc = result.bySource.find(s => s.source === 'abc')!;
    expect(abc.total).toBe(3);
    expect(abc.acceptanceRate).toBe(66.7);

    const monitoring = result.bySource.find(s => s.source === 'monitoring')!;
    expect(monitoring.total).toBe(2);
    expect(monitoring.acceptanceRate).toBe(50);

    // 却下理由
    expect(result.dismissReasons).toHaveLength(3);

    // 緊急度別
    const urgent = result.byUrgency.find(u => u.urgency === 'urgent')!;
    expect(urgent.total).toBe(2);
    expect(urgent.acceptanceRate).toBe(100);
  });
});
