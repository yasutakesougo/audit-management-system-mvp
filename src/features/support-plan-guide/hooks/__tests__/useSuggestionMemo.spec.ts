/**
 * useSuggestionMemo.spec.ts — P3-C hook のユニットテスト
 *
 * テスト対象:
 *  - formatSuggestionForMemo (pure function)
 */
import { describe, it, expect } from 'vitest';
import { formatSuggestionForMemo } from '../useSuggestionMemo';
import type { GoalSuggestion } from '../../domain/suggestedGoals';

// ────────────────────────────────────────────
// テストデータ
// ────────────────────────────────────────────

const baseSuggestion: GoalSuggestion = {
  id: 'test-1',
  title: 'テスト目標',
  rationale: 'アセスメント結果に基づく提案です。',
  suggestedSupports: [],
  priority: 'medium',
  provenance: [],
  goalType: 'short',
  domains: ['cognitive'],
};

// ────────────────────────────────────────────
// formatSuggestionForMemo
// ────────────────────────────────────────────

describe('formatSuggestionForMemo', () => {
  it('基本のフォーマットが正しい（supports/provenance なし）', () => {
    const text = formatSuggestionForMemo(baseSuggestion);
    expect(text).toContain('【提案】テスト目標');
    expect(text).toContain('根拠: アセスメント結果に基づく提案です。');
    expect(text).not.toContain('推奨支援:');
    expect(text).not.toContain('出典:');
  });

  it('suggestedSupports がある場合は推奨支援行が追加される', () => {
    const suggestion: GoalSuggestion = {
      ...baseSuggestion,
      suggestedSupports: ['支援A', '支援B'],
    };
    const text = formatSuggestionForMemo(suggestion);
    expect(text).toContain('推奨支援: 支援A、支援B');
  });

  it('provenance がある場合は出典行が追加される', () => {
    const suggestion: GoalSuggestion = {
      ...baseSuggestion,
      provenance: ['アセスメント: リスクレベル＝高', 'Iceberg分析: 支援課題'],
    };
    const text = formatSuggestionForMemo(suggestion);
    expect(text).toContain('出典: アセスメント: リスクレベル＝高、Iceberg分析: 支援課題');
  });

  it('全項目がある場合は4行になる', () => {
    const suggestion: GoalSuggestion = {
      ...baseSuggestion,
      suggestedSupports: ['支援A'],
      provenance: ['出典X'],
    };
    const text = formatSuggestionForMemo(suggestion);
    const lines = text.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('【提案】テスト目標');
    expect(lines[1]).toBe('根拠: アセスメント結果に基づく提案です。');
    expect(lines[2]).toBe('推奨支援: 支援A');
    expect(lines[3]).toBe('出典: 出典X');
  });
});
