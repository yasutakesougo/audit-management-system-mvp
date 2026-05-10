import { describe, expect, it } from 'vitest';
import { 
  buildReverseBridgeSuggestions, 
  type ReverseBridgeInput, 
  type ReverseBridgeExecutionRecord, 
  type ReverseBridgeWeeklyObservation 
} from '../reverseBridge';

describe('buildReverseBridgeSuggestions (Pure Domain Logic)', () => {
  const periodStart = '2026-05-01';
  const periodEnd = '2026-05-15';

  const defaultInput = (
    executionRecords: ReverseBridgeExecutionRecord[] = [],
    weeklyObservations: ReverseBridgeWeeklyObservation[] = []
  ): ReverseBridgeInput => ({
    periodStart,
    periodEnd,
    executionRecords,
    weeklyObservations,
  });

  it('記録が0件の場合、クラッシュせず confidence: none を返すこと', () => {
    const input = defaultInput([], []);
    const result = buildReverseBridgeSuggestions(input);

    expect(result.confidence).toBe('none');
    expect(result.stats.recordCount).toBe(0);
    expect(result.stats.procedureCompletionRate).toBeNull();
    expect(result.stats.bipActivationRate).toBeNull();
    expect(result.improvementResult).toContain('まだ実績記録が存在しないため');
    expect(result.nextSupport).toContain('実績記録がありません');
  });

  it('完了率100% / BIP 0% で positive な tone を返すこと', () => {
    const executionRecords: ReverseBridgeExecutionRecord[] = Array.from({ length: 12 }, (_, i) => ({
      id: `rec-${i}`,
      date: `2026-05-0${(i % 9) + 1}`,
      status: 'completed',
      memo: '穏やかに課題に取り組む。',
    }));

    const weeklyObservations: ReverseBridgeWeeklyObservation[] = [
      {
        observationDate: '2026-05-05',
        observationContent: '全体的に手順通りのアプローチで安定している。',
      }
    ];

    const input = defaultInput(executionRecords, weeklyObservations);
    const result = buildReverseBridgeSuggestions(input);

    expect(result.confidence).toBe('high');
    expect(result.stats.procedureCompletionRate).toBe(100);
    expect(result.stats.bipActivationRate).toBe(0);
    expect(result.stats.recordCount).toBe(12);
    expect(result.stats.observationCount).toBe(1);

    expect(result.improvementResult).toContain('非常に高い水準');
    expect(result.nextSupport).toContain('現行支援の継続');
  });

  it('完了率50%未満またはBIP発動率30%以上で review / caution な tone を返すこと', () => {
    const executionRecords: ReverseBridgeExecutionRecord[] = [
      { date: '2026-05-01', status: 'triggered', memo: '切り替え時に他害行動が発生' },
      { date: '2026-05-02', status: 'skipped', memo: '活動を拒否したためスキップ' },
      { date: '2026-05-03', status: 'completed', memo: '問題なく実施' },
    ];

    const input = defaultInput(executionRecords);
    const result = buildReverseBridgeSuggestions(input);

    expect(result.confidence).toBe('medium'); // count is 3
    expect(result.stats.procedureCompletionRate).toBe(33); // 1 / 3
    expect(result.stats.bipActivationRate).toBe(33); // 1 / 3

    expect(result.improvementResult).toContain('50%未満に低迷しているか、または行動の発生');
    expect(result.nextSupport).toContain('手順設計の根本的見直し');
  });

  it('それ以外のケースで neutral な tone を返すこと', () => {
    const executionRecords: ReverseBridgeExecutionRecord[] = [
      { date: '2026-05-01', status: 'completed', memo: '良好' },
      { date: '2026-05-02', status: 'completed', memo: '良好' },
      { date: '2026-05-03', status: 'skipped', memo: 'スキップ' },
      { date: '2026-05-04', status: 'skipped', memo: 'スキップ' },
    ];

    const input = defaultInput(executionRecords);
    const result = buildReverseBridgeSuggestions(input);

    expect(result.confidence).toBe('medium'); // count is 4
    expect(result.stats.procedureCompletionRate).toBe(50); // 2 / 4 = 50%
    expect(result.stats.bipActivationRate).toBe(0);

    expect(result.improvementResult).toContain('支援手順はおおむね実施されていますが');
    expect(result.nextSupport).toContain('手順の微調整と一貫性の担保');
  });

  it('メモが長文の場合、安全に50文字で clamp されること', () => {
    const longMemo = 'あ'.repeat(100);
    const executionRecords: ReverseBridgeExecutionRecord[] = [
      { date: '2026-05-05', status: 'completed', memo: longMemo },
    ];

    const input = defaultInput(executionRecords);
    const result = buildReverseBridgeSuggestions(input);

    expect(result.evidenceSummary).toContain('あ'.repeat(50) + '...');
  });

  it('特殊文字や過剰な改行が、スペースに正規化されること', () => {
    const nestedMemo = '\n  あいうえお  \n\t  かきくけこ  \n';
    const executionRecords: ReverseBridgeExecutionRecord[] = [
      { date: '2026-05-05', status: 'completed', memo: nestedMemo },
    ];

    const input = defaultInput(executionRecords);
    const result = buildReverseBridgeSuggestions(input);

    expect(result.evidenceSummary).toContain('あいうえお かきくけこ');
  });

  it('同じ input なら必ず同じ output を返すこと（決定論的・純粋関数）', () => {
    const executionRecords: ReverseBridgeExecutionRecord[] = [
      { date: '2026-05-01', status: 'completed', memo: 'メモ1' },
      { date: '2026-05-02', status: 'triggered', memo: '他傷あり' },
    ];
    const weeklyObservations: ReverseBridgeWeeklyObservation[] = [
      { observationDate: '2026-05-05', observationContent: '穏やかに過ごせていた。' }
    ];

    const input1 = defaultInput(executionRecords, weeklyObservations);
    const input2 = defaultInput(executionRecords, weeklyObservations);

    const result1 = buildReverseBridgeSuggestions(input1);
    const result2 = buildReverseBridgeSuggestions(input2);

    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });
});
