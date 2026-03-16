import { describe, it, expect } from 'vitest';
import {
  computeKnowledgeMetrics,
  type DecisionRecord,
  type EvidenceLinkRecord,
  type KnowledgePeriod,
} from '../knowledgeMetrics';

// ─── テストデータファクトリ ───────────────────────────────

const period: KnowledgePeriod = { start: '2026-01-01', end: '2026-03-31', months: 3 };

function makeDecision(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: 'd-001',
    source: 'handoff',
    action: 'accepted',
    rulePrefix: 'highCoOccurrence',
    decidedAt: '2026-02-10T09:00:00Z',
    ...overrides,
  };
}

function makeLink(overrides: Partial<EvidenceLinkRecord> = {}): EvidenceLinkRecord {
  return {
    planningSheetId: 'ps-001',
    linkType: 'abc',
    targetId: 'abc-001',
    ...overrides,
  };
}

// ─── 空データテスト ──────────────────────────────────────

describe('computeKnowledgeMetrics — empty', () => {
  it('空配列でもエラーなく全指標 0 を返す', () => {
    const result = computeKnowledgeMetrics([], [], [], period);

    expect(result.totalDecisions).toBe(0);
    expect(result.decisionsPerMonth).toBe(0);
    expect(result.reasonedDismissRate).toBe(0);
    expect(result.unreasonedDismissCount).toBe(0);
    expect(result.totalLinks).toBe(0);
    expect(result.avgLinksPerSheet).toBe(0);
    expect(result.linkedSheetRate).toBe(0);
    expect(result.topPatterns).toHaveLength(0);
    expect(result.uniquePatternCount).toBe(0);
    expect(result.provenPatternCount).toBe(0);
  });
});

// ─── 判断記録集計テスト ──────────────────────────────────

describe('decision metrics', () => {
  it('月あたりの判断記録数を正しく計算する', () => {
    const decisions = [
      makeDecision({ id: 'd-1' }),
      makeDecision({ id: 'd-2' }),
      makeDecision({ id: 'd-3' }),
      makeDecision({ id: 'd-4' }),
      makeDecision({ id: 'd-5' }),
      makeDecision({ id: 'd-6' }),
    ];

    const result = computeKnowledgeMetrics(decisions, [], [], period);

    expect(result.totalDecisions).toBe(6);
    // 6 / 3 months = 2.0
    expect(result.decisionsPerMonth).toBe(2);
  });

  it('理由付き却下率を正しく計算する', () => {
    const decisions = [
      makeDecision({ id: 'd-1', action: 'dismissed', dismissReason: 'not_applicable' }),
      makeDecision({ id: 'd-2', action: 'dismissed', dismissReason: 'disagree' }),
      makeDecision({ id: 'd-3', action: 'dismissed' }), // 理由なし
      makeDecision({ id: 'd-4', action: 'dismissed', dismissReason: '' }), // 空文字
    ];

    const result = computeKnowledgeMetrics(decisions, [], [], period);

    // 理由あり 2件 / 却下 4件 = 50%
    expect(result.reasonedDismissRate).toBe(50);
    expect(result.unreasonedDismissCount).toBe(2);
  });

  it('accepted のみの場合の理由付き却下率は 0', () => {
    const decisions = [
      makeDecision({ id: 'd-1', action: 'accepted' }),
    ];

    const result = computeKnowledgeMetrics(decisions, [], [], period);

    expect(result.reasonedDismissRate).toBe(0);
    expect(result.unreasonedDismissCount).toBe(0);
  });
});

// ─── Evidence Link 集計テスト ────────────────────────────

describe('evidence link metrics', () => {
  it('平均リンク数を正しく計算する', () => {
    const links = [
      makeLink({ planningSheetId: 'ps-1', targetId: 'abc-001' }),
      makeLink({ planningSheetId: 'ps-1', targetId: 'abc-002' }),
      makeLink({ planningSheetId: 'ps-1', targetId: 'pdca-001', linkType: 'pdca' }),
      makeLink({ planningSheetId: 'ps-2', targetId: 'abc-003' }),
    ];
    const sheetIds = ['ps-1', 'ps-2', 'ps-3'];

    const result = computeKnowledgeMetrics([], links, sheetIds, period);

    expect(result.totalLinks).toBe(4);
    // 4 links / 3 sheets ≈ 1.3
    expect(result.avgLinksPerSheet).toBe(1.3);
    // ps-1, ps-2 がリンクあり → 2/3 ≈ 66.7%
    expect(result.linkedSheetRate).toBe(66.7);
  });

  it('支援計画が 0 件でも avgLinksPerSheet は 0', () => {
    const links = [makeLink()];

    const result = computeKnowledgeMetrics([], links, [], period);

    expect(result.avgLinksPerSheet).toBe(0);
    expect(result.linkedSheetRate).toBe(0);
  });
});

// ─── ソース別分布テスト ──────────────────────────────────

describe('source distribution', () => {
  it('3 ソースすべてが返される', () => {
    const result = computeKnowledgeMetrics([], [], [], period);

    expect(result.sourceDistribution).toHaveLength(3);
    expect(result.sourceDistribution.map(s => s.source)).toEqual(['handoff', 'abc', 'monitoring']);
  });

  it('ソース別の判断数を正しく集計する', () => {
    const decisions = [
      makeDecision({ id: 'd-1', source: 'handoff' }),
      makeDecision({ id: 'd-2', source: 'handoff' }),
      makeDecision({ id: 'd-3', source: 'abc' }),
      makeDecision({ id: 'd-4', source: 'monitoring' }),
      makeDecision({ id: 'd-5', source: 'monitoring' }),
      makeDecision({ id: 'd-6', source: 'monitoring' }),
    ];

    const result = computeKnowledgeMetrics(decisions, [], [], period);

    const handoff = result.sourceDistribution.find(s => s.source === 'handoff')!;
    expect(handoff.count).toBe(2);
    expect(handoff.rate).toBe(33.3);

    const monitoring = result.sourceDistribution.find(s => s.source === 'monitoring')!;
    expect(monitoring.count).toBe(3);
    expect(monitoring.rate).toBe(50);
  });
});

// ─── パターン再利用テスト ────────────────────────────────

describe('pattern reuse', () => {
  it('ユニークパターン数を正しく数える', () => {
    const decisions = [
      makeDecision({ id: 'd-1', rulePrefix: 'highCoOccurrence' }),
      makeDecision({ id: 'd-2', rulePrefix: 'slotBias' }),
      makeDecision({ id: 'd-3', rulePrefix: 'highCoOccurrence' }),
    ];

    const result = computeKnowledgeMetrics(decisions, [], [], period);

    expect(result.uniquePatternCount).toBe(2);
  });

  it('成功パターン（採用率 ≥ 60% かつ出現 ≥ 3）を検出する', () => {
    const decisions = [
      // highCoOccurrence: 3回中3回 accepted → 100% → 成功
      makeDecision({ id: 'd-1', rulePrefix: 'highCoOccurrence', action: 'accepted' }),
      makeDecision({ id: 'd-2', rulePrefix: 'highCoOccurrence', action: 'accepted' }),
      makeDecision({ id: 'd-3', rulePrefix: 'highCoOccurrence', action: 'accepted' }),

      // slotBias: 4回中1回 accepted → 25% → 非成功
      makeDecision({ id: 'd-4', rulePrefix: 'slotBias', action: 'accepted' }),
      makeDecision({ id: 'd-5', rulePrefix: 'slotBias', action: 'dismissed' }),
      makeDecision({ id: 'd-6', rulePrefix: 'slotBias', action: 'dismissed' }),
      makeDecision({ id: 'd-7', rulePrefix: 'slotBias', action: 'dismissed' }),

      // tagDensityGap: 2回中2回 accepted → 100% だが出現 < 3 → 非成功
      makeDecision({ id: 'd-8', rulePrefix: 'tagDensityGap', action: 'accepted' }),
      makeDecision({ id: 'd-9', rulePrefix: 'tagDensityGap', action: 'accepted' }),
    ];

    const result = computeKnowledgeMetrics(decisions, [], [], period);

    expect(result.provenPatternCount).toBe(1); // highCoOccurrence のみ
  });

  it('topPatterns は採用回数降順で最大 10 件', () => {
    const decisions = [
      // patternA: 5 accepted
      ...Array.from({ length: 5 }, (_, i) => makeDecision({ id: `a-${i}`, rulePrefix: 'patternA', action: 'accepted' })),
      // patternB: 3 accepted
      ...Array.from({ length: 3 }, (_, i) => makeDecision({ id: `b-${i}`, rulePrefix: 'patternB', action: 'accepted' })),
      // patternC: 1 accepted
      makeDecision({ id: 'c-0', rulePrefix: 'patternC', action: 'accepted' }),
    ];

    const result = computeKnowledgeMetrics(decisions, [], [], period);

    expect(result.topPatterns[0].rulePrefix).toBe('patternA');
    expect(result.topPatterns[0].acceptedCount).toBe(5);
    expect(result.topPatterns[1].rulePrefix).toBe('patternB');
    expect(result.topPatterns[2].rulePrefix).toBe('patternC');
  });
});

// ─── 統合テスト: 現実的なシナリオ ─────────────────────────

describe('realistic scenario', () => {
  it('3 ヶ月分の運用データを正しく集計する', () => {
    const decisions: DecisionRecord[] = [
      // handoff 系: 4件（3 accepted, 1 dismissed with reason）
      makeDecision({ id: 'h-1', source: 'handoff', rulePrefix: 'highCoOccurrence', action: 'accepted' }),
      makeDecision({ id: 'h-2', source: 'handoff', rulePrefix: 'highCoOccurrence', action: 'accepted' }),
      makeDecision({ id: 'h-3', source: 'handoff', rulePrefix: 'slotBias', action: 'accepted' }),
      makeDecision({ id: 'h-4', source: 'handoff', rulePrefix: 'slotBias', action: 'dismissed', dismissReason: 'not_applicable' }),

      // abc 系: 3件（2 accepted, 1 dismissed without reason）
      makeDecision({ id: 'a-1', source: 'abc', rulePrefix: 'highCoOccurrence', action: 'accepted' }),
      makeDecision({ id: 'a-2', source: 'abc', rulePrefix: 'tagDensityGap', action: 'accepted' }),
      makeDecision({ id: 'a-3', source: 'abc', rulePrefix: 'tagDensityGap', action: 'dismissed' }),

      // monitoring 系: 2件（1 accepted, 1 dismissed with reason）
      makeDecision({ id: 'm-1', source: 'monitoring', rulePrefix: 'positiveSignal', action: 'accepted' }),
      makeDecision({ id: 'm-2', source: 'monitoring', rulePrefix: 'positiveSignal', action: 'dismissed', dismissReason: 'already_addressed' }),
    ];

    const links: EvidenceLinkRecord[] = [
      makeLink({ planningSheetId: 'ps-1', targetId: 'abc-001' }),
      makeLink({ planningSheetId: 'ps-1', targetId: 'abc-002' }),
      makeLink({ planningSheetId: 'ps-1', targetId: 'pdca-001', linkType: 'pdca' }),
      makeLink({ planningSheetId: 'ps-2', targetId: 'abc-003' }),
      makeLink({ planningSheetId: 'ps-3', targetId: 'pdca-002', linkType: 'pdca' }),
    ];

    const sheetIds = ['ps-1', 'ps-2', 'ps-3', 'ps-4', 'ps-5'];

    const result = computeKnowledgeMetrics(decisions, links, sheetIds, period);

    // 基本
    expect(result.totalDecisions).toBe(9);
    expect(result.decisionsPerMonth).toBe(3); // 9 / 3

    // 却下: 3件中 2件に理由あり
    expect(result.reasonedDismissRate).toBe(66.7);
    expect(result.unreasonedDismissCount).toBe(1);

    // リンク: 5 links / 5 sheets = 1.0
    expect(result.totalLinks).toBe(5);
    expect(result.avgLinksPerSheet).toBe(1);
    // ps-1, ps-2, ps-3 にリンクあり → 3/5 = 60%
    expect(result.linkedSheetRate).toBe(60);

    // ソース分布
    expect(result.sourceDistribution.find(s => s.source === 'handoff')?.count).toBe(4);
    expect(result.sourceDistribution.find(s => s.source === 'abc')?.count).toBe(3);
    expect(result.sourceDistribution.find(s => s.source === 'monitoring')?.count).toBe(2);

    // パターン: highCoOccurrence(3件, 全accepted) → 成功パターン
    expect(result.uniquePatternCount).toBe(4);
    expect(result.provenPatternCount).toBe(1);
    expect(result.topPatterns[0].rulePrefix).toBe('highCoOccurrence');
    expect(result.topPatterns[0].acceptedCount).toBe(3);
  });
});
