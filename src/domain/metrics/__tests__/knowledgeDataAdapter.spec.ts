import { describe, it, expect } from 'vitest';
import {
  adaptEvidenceLinks,
  adaptSuggestionActionsToDecisionRecords,
  extractPlanningSheetIds,
} from '../adapters/knowledgeDataAdapter';
import type { EvidenceLinkMap } from '@/domain/isp/evidenceLink';
import type { SuggestionAction } from '@/features/daily/domain/legacy/suggestionAction';

// ─── テストデータファクトリ ───────────────────────────────

function makeEvidenceLinkMap(overrides?: Partial<EvidenceLinkMap>): EvidenceLinkMap {
  return {
    antecedentStrategies: [],
    teachingStrategies: [],
    consequenceStrategies: [],
    ...overrides,
  };
}

function makeAction(overrides: Partial<SuggestionAction> = {}): SuggestionAction {
  return {
    action: 'accept',
    ruleId: 'highCoOccurrence.001',
    category: 'co-occurrence',
    message: 'テスト提案',
    evidence: 'テスト根拠',
    timestamp: '2026-02-10T09:00:00Z',
    userId: 'user-A',
    ...overrides,
  };
}

// ─── adaptEvidenceLinks ──────────────────────────────────

describe('adaptEvidenceLinks', () => {
  it('空マップは空配列を返す', () => {
    expect(adaptEvidenceLinks({})).toEqual([]);
  });

  it('全セクションのリンクをフラットに展開する', () => {
    const allLinks: Record<string, EvidenceLinkMap> = {
      'ps-1': makeEvidenceLinkMap({
        antecedentStrategies: [
          { type: 'abc', referenceId: 'abc-001', label: 'ABC #1', linkedAt: '2026-02-10' },
        ],
        teachingStrategies: [
          { type: 'pdca', referenceId: 'pdca-001', label: 'PDCA #1', linkedAt: '2026-02-11' },
        ],
        consequenceStrategies: [
          { type: 'abc', referenceId: 'abc-002', label: 'ABC #2', linkedAt: '2026-02-12' },
        ],
      }),
    };

    const result = adaptEvidenceLinks(allLinks);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ planningSheetId: 'ps-1', linkType: 'abc', targetId: 'abc-001' });
    expect(result[1]).toEqual({ planningSheetId: 'ps-1', linkType: 'pdca', targetId: 'pdca-001' });
    expect(result[2]).toEqual({ planningSheetId: 'ps-1', linkType: 'abc', targetId: 'abc-002' });
  });

  it('複数シートを結合する', () => {
    const allLinks: Record<string, EvidenceLinkMap> = {
      'ps-1': makeEvidenceLinkMap({
        antecedentStrategies: [
          { type: 'abc', referenceId: 'abc-001', label: 'ABC #1', linkedAt: '2026-02-10' },
        ],
      }),
      'ps-2': makeEvidenceLinkMap({
        teachingStrategies: [
          { type: 'pdca', referenceId: 'pdca-001', label: 'PDCA #1', linkedAt: '2026-02-11' },
        ],
      }),
    };

    const result = adaptEvidenceLinks(allLinks);
    expect(result).toHaveLength(2);
    expect(result[0].planningSheetId).toBe('ps-1');
    expect(result[1].planningSheetId).toBe('ps-2');
  });

  it('セクションが空のシートはスキップする', () => {
    const allLinks: Record<string, EvidenceLinkMap> = {
      'ps-empty': makeEvidenceLinkMap(), // 全セクション空
      'ps-data': makeEvidenceLinkMap({
        antecedentStrategies: [
          { type: 'abc', referenceId: 'abc-001', label: 'ABC', linkedAt: '2026-02-10' },
        ],
      }),
    };

    const result = adaptEvidenceLinks(allLinks);
    expect(result).toHaveLength(1);
    expect(result[0].planningSheetId).toBe('ps-data');
  });
});

// ─── adaptSuggestionActionsToDecisionRecords ─────────────

describe('adaptSuggestionActionsToDecisionRecords', () => {
  it('空配列は空を返す', () => {
    expect(adaptSuggestionActionsToDecisionRecords([])).toEqual([]);
  });

  it('accept → accepted に変換する', () => {
    const result = adaptSuggestionActionsToDecisionRecords([
      makeAction({ action: 'accept' }),
    ]);
    expect(result[0].action).toBe('accepted');
  });

  it('dismiss → dismissed に変換する', () => {
    const result = adaptSuggestionActionsToDecisionRecords([
      makeAction({ action: 'dismiss' }),
    ]);
    expect(result[0].action).toBe('dismissed');
  });

  it('rulePrefix を ruleId から抽出する', () => {
    const result = adaptSuggestionActionsToDecisionRecords([
      makeAction({ ruleId: 'highCoOccurrence.001' }),
      makeAction({ ruleId: 'slotBias.002' }),
    ]);
    expect(result[0].rulePrefix).toBe('highCoOccurrence');
    expect(result[1].rulePrefix).toBe('slotBias');
  });

  it('source を ruleId から推定する', () => {
    const result = adaptSuggestionActionsToDecisionRecords([
      makeAction({ ruleId: 'highCoOccurrence.001' }),
    ]);
    expect(result[0].source).toBe('handoff');
  });

  it('decidedAt に timestamp が設定される', () => {
    const ts = '2026-03-01T12:00:00Z';
    const result = adaptSuggestionActionsToDecisionRecords([
      makeAction({ timestamp: ts }),
    ]);
    expect(result[0].decidedAt).toBe(ts);
  });

  it('id がユニークになる', () => {
    const result = adaptSuggestionActionsToDecisionRecords([
      makeAction({ ruleId: 'highCoOccurrence.001' }),
      makeAction({ ruleId: 'highCoOccurrence.001' }),
    ]);
    expect(result[0].id).not.toBe(result[1].id);
  });
});

// ─── extractPlanningSheetIds ─────────────────────────────

describe('extractPlanningSheetIds', () => {
  it('空マップは空配列', () => {
    expect(extractPlanningSheetIds({})).toEqual([]);
  });

  it('全キーを返す', () => {
    const allLinks: Record<string, EvidenceLinkMap> = {
      'ps-1': makeEvidenceLinkMap(),
      'ps-2': makeEvidenceLinkMap(),
      'ps-3': makeEvidenceLinkMap(),
    };
    expect(extractPlanningSheetIds(allLinks)).toEqual(['ps-1', 'ps-2', 'ps-3']);
  });
});

// ─── 統合テスト: computeKnowledgeMetrics との接続 ─────────

describe('integration with computeKnowledgeMetrics', () => {
  it('変換結果を computeKnowledgeMetrics に直接渡せる', async () => {
    const { computeKnowledgeMetrics } = await import('../knowledgeMetrics');

    const allLinks: Record<string, EvidenceLinkMap> = {
      'ps-1': makeEvidenceLinkMap({
        antecedentStrategies: [
          { type: 'abc', referenceId: 'abc-001', label: 'ABC #1', linkedAt: '2026-02-10' },
          { type: 'abc', referenceId: 'abc-002', label: 'ABC #2', linkedAt: '2026-02-11' },
        ],
        teachingStrategies: [
          { type: 'pdca', referenceId: 'pdca-001', label: 'PDCA #1', linkedAt: '2026-02-12' },
        ],
      }),
      'ps-2': makeEvidenceLinkMap({
        antecedentStrategies: [
          { type: 'abc', referenceId: 'abc-003', label: 'ABC #3', linkedAt: '2026-02-15' },
        ],
      }),
    };

    const evidenceRecords = adaptEvidenceLinks(allLinks);
    const sheetIds = extractPlanningSheetIds(allLinks);

    const actions = [
      makeAction({ action: 'accept', ruleId: 'highCoOccurrence.001' }),
      makeAction({ action: 'accept', ruleId: 'highCoOccurrence.002' }),
      makeAction({ action: 'dismiss', ruleId: 'slotBias.001' }),
    ];
    const decisions = adaptSuggestionActionsToDecisionRecords(actions);

    const period = { start: '2026-01-01', end: '2026-03-31', months: 3 };
    const metrics = computeKnowledgeMetrics(decisions, evidenceRecords, sheetIds, period);

    expect(metrics.totalDecisions).toBe(3);
    expect(metrics.totalLinks).toBe(4);
    expect(metrics.linkedSheetRate).toBeGreaterThan(0);
  });
});
