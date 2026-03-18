import { describe, it, expect } from 'vitest';
import {
  adaptSuggestionActions,
  adaptAllSuggestionActions,
} from '../adapters/proposalDecisionAdapter';
import type { SuggestionAction } from '@/features/daily/domain/suggestionAction';

// ─── テストデータファクトリ ───────────────────────────────

function makeAction(overrides: Partial<SuggestionAction> = {}): SuggestionAction {
  return {
    action: 'accept',
    ruleId: 'highCoOccurrence.001',
    category: 'co-occurrence',
    message: '午前に不安傾向タグが多く見られます',
    evidence: '不安傾向: 3/5件 (60%)',
    timestamp: '2026-02-10T09:00:00Z',
    userId: 'user-A',
    ...overrides,
  };
}

// ─── adaptSuggestionActions ──────────────────────────────

describe('adaptSuggestionActions', () => {
  it('空配列は空配列を返す', () => {
    expect(adaptSuggestionActions([])).toEqual([]);
  });

  it('accept → accepted に変換する', () => {
    const actions = [makeAction({ action: 'accept' })];
    const result = adaptSuggestionActions(actions);

    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('accepted');
    expect(result[0].selectedFields).toContain('highCoOccurrence');
    expect(result[0].dismissReason).toBeUndefined();
  });

  it('dismiss → dismissed に変換する', () => {
    const actions = [makeAction({ action: 'dismiss' })];
    const result = adaptSuggestionActions(actions);

    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('dismissed');
    expect(result[0].dismissReason).toBe('other');
    expect(result[0].selectedFields).toBeUndefined();
  });

  it('ruleId から source を推定する', () => {
    const actions = [
      makeAction({ ruleId: 'highCoOccurrence.001' }),
      makeAction({ ruleId: 'slotBias.002' }),
      makeAction({ ruleId: 'unknownRule.003' }),
    ];
    const result = adaptSuggestionActions(actions);

    expect(result[0].source).toBe('handoff');
    expect(result[1].source).toBe('handoff');
    expect(result[2].source).toBe('handoff'); // デフォルト
  });

  it('proposalId がユニークになる', () => {
    const actions = [
      makeAction({ ruleId: 'highCoOccurrence.001' }),
      makeAction({ ruleId: 'highCoOccurrence.001' }),
    ];
    const result = adaptSuggestionActions(actions);

    expect(result[0].proposalId).not.toBe(result[1].proposalId);
  });

  it('timestamp が generatedAt と decidedAt に設定される', () => {
    const ts = '2026-02-15T14:30:00Z';
    const actions = [makeAction({ timestamp: ts })];
    const result = adaptSuggestionActions(actions);

    expect(result[0].generatedAt).toBe(ts);
    expect(result[0].decidedAt).toBe(ts);
  });

  it('複数件の mixed actions を正しく変換する', () => {
    const actions = [
      makeAction({ action: 'accept', ruleId: 'highCoOccurrence.001' }),
      makeAction({ action: 'dismiss', ruleId: 'slotBias.002' }),
      makeAction({ action: 'accept', ruleId: 'tagDensityGap.003' }),
      makeAction({ action: 'dismiss', ruleId: 'positiveSignal.004' }),
    ];
    const result = adaptSuggestionActions(actions);

    expect(result).toHaveLength(4);
    expect(result.filter(r => r.action === 'accepted')).toHaveLength(2);
    expect(result.filter(r => r.action === 'dismissed')).toHaveLength(2);
  });
});

// ─── adaptAllSuggestionActions ───────────────────────────

describe('adaptAllSuggestionActions', () => {
  it('空 Map は空配列を返す', () => {
    const result = adaptAllSuggestionActions(new Map());
    expect(result).toEqual([]);
  });

  it('複数利用者分の actions をフラットに変換する', () => {
    const map = new Map<string, SuggestionAction[]>();
    map.set('user-A', [
      makeAction({ userId: 'user-A', action: 'accept' }),
      makeAction({ userId: 'user-A', action: 'dismiss' }),
    ]);
    map.set('user-B', [
      makeAction({ userId: 'user-B', action: 'accept' }),
    ]);

    const result = adaptAllSuggestionActions(map);

    expect(result).toHaveLength(3);
    expect(result.filter(r => r.action === 'accepted')).toHaveLength(2);
    expect(result.filter(r => r.action === 'dismissed')).toHaveLength(1);
  });
});

// ─── 統合テスト: computeProposalMetrics との接続 ──────────

describe('integration with computeProposalMetrics', () => {
  it('変換結果を computeProposalMetrics に直接渡せる', async () => {
    const { computeProposalMetrics } = await import('../proposalMetrics');

    const actions: SuggestionAction[] = [
      makeAction({ action: 'accept' }),
      makeAction({ action: 'accept' }),
      makeAction({ action: 'dismiss' }),
    ];

    const records = adaptSuggestionActions(actions);
    const metrics = computeProposalMetrics(records, { start: '2026-02-01', end: '2026-02-28' });

    expect(metrics.total).toBe(3);
    expect(metrics.accepted).toBe(2);
    expect(metrics.dismissed).toBe(1);
    expect(metrics.acceptanceRate).toBe(66.7);
  });
});
