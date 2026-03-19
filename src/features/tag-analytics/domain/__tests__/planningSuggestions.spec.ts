/**
 * @fileoverview Phase F3: buildPlanningSuggestions 契約テスト
 * @description
 * 根拠文・示唆文の生成、優先度、カテゴリグループ化を検証。
 */
import { describe, it, expect } from 'vitest';
import {
  buildPlanningSuggestions,
  groupSuggestionsByCategory,
} from '../planningSuggestions';
import type { TrendAlert } from '../tagTrendAlerts';

// ── ヘルパー ──

const mkAlert = (overrides: Partial<TrendAlert> = {}): TrendAlert => ({
  type: 'spike',
  severity: 'warning',
  tagKey: 'panic',
  tagLabel: 'パニック',
  category: 'behavior',
  categoryLabel: '行動',
  currentCount: 10,
  baselineCount: 2,
  changeRate: 300,
  message: '急増: パニック（+300%）',
  ...overrides,
});

// ═══════════════════════════════════════════════════════════
// buildPlanningSuggestions - 基本
// ═══════════════════════════════════════════════════════════

describe('buildPlanningSuggestions - 基本', () => {
  it('空配列 → 空配列', () => {
    expect(buildPlanningSuggestions([])).toEqual([]);
  });

  it('アラート1件 → 示唆1件', () => {
    const result = buildPlanningSuggestions([mkAlert()]);
    expect(result).toHaveLength(1);
  });

  it('複数アラート → 同数の示唆', () => {
    const result = buildPlanningSuggestions([
      mkAlert({ tagKey: 'panic' }),
      mkAlert({ type: 'drop', tagKey: 'sensory' }),
    ]);
    expect(result).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════
// 根拠文 (rationale)
// ═══════════════════════════════════════════════════════════

describe('buildPlanningSuggestions - rationale', () => {
  it('spike → +% を含む根拠', () => {
    const result = buildPlanningSuggestions([mkAlert({ type: 'spike', changeRate: 300 })]);
    expect(result[0].rationale).toContain('+300%');
    expect(result[0].rationale).toContain('急増');
  });

  it('drop → 前期間件数を含む根拠', () => {
    const result = buildPlanningSuggestions([
      mkAlert({ type: 'drop', baselineCount: 5, currentCount: 0, changeRate: -100 }),
    ]);
    expect(result[0].rationale).toContain('5回');
    expect(result[0].rationale).toContain('0件');
  });

  it('new → 出現回数を含む根拠', () => {
    const result = buildPlanningSuggestions([
      mkAlert({ type: 'new', currentCount: 3, baselineCount: 0, changeRate: Infinity }),
    ]);
    expect(result[0].rationale).toContain('3回');
    expect(result[0].rationale).toContain('出現');
  });
});

// ═══════════════════════════════════════════════════════════
// 示唆文 (suggestion)
// ═══════════════════════════════════════════════════════════

describe('buildPlanningSuggestions - suggestion', () => {
  it('既知タグ（panic）→ 具体的な示唆', () => {
    const result = buildPlanningSuggestions([mkAlert({ tagKey: 'panic' })]);
    expect(result[0].suggestion).toContain('予告方法');
    expect(result[0].suggestion).toContain('検討');
  });

  it('既知タグ（sleeping）→ 睡眠関連の示唆', () => {
    const result = buildPlanningSuggestions([mkAlert({ tagKey: 'sleeping' })]);
    expect(result[0].suggestion).toContain('睡眠');
  });

  it('既知タグ（cooperation）→ ポジティブ系の示唆', () => {
    const result = buildPlanningSuggestions([mkAlert({ tagKey: 'cooperation' })]);
    expect(result[0].suggestion).toContain('強化');
  });

  it('不明タグ → ジェネリック示唆', () => {
    const result = buildPlanningSuggestions([mkAlert({ tagKey: 'unknownTag' })]);
    expect(result[0].suggestion).toContain('見直し');
  });

  it('全12タグに示唆が存在する', () => {
    const knownTags = [
      'panic', 'sensory', 'elopement',
      'verbalRequest', 'gestureRequest', 'echolalia',
      'eating', 'toileting', 'sleeping',
      'cooperation', 'selfRegulation', 'newSkill',
    ];
    for (const key of knownTags) {
      const result = buildPlanningSuggestions([mkAlert({ tagKey: key })]);
      expect(result[0].suggestion).not.toBe('');
      expect(result[0].suggestion).toContain('検討');
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 優先度 (priority)
// ═══════════════════════════════════════════════════════════

describe('buildPlanningSuggestions - priority', () => {
  it('spike = 1（最高優先度）', () => {
    const result = buildPlanningSuggestions([mkAlert({ type: 'spike' })]);
    expect(result[0].priority).toBe(1);
  });

  it('drop = 2', () => {
    const result = buildPlanningSuggestions([mkAlert({ type: 'drop' })]);
    expect(result[0].priority).toBe(2);
  });

  it('new = 3', () => {
    const result = buildPlanningSuggestions([mkAlert({ type: 'new' })]);
    expect(result[0].priority).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════
// groupSuggestionsByCategory
// ═══════════════════════════════════════════════════════════

describe('groupSuggestionsByCategory', () => {
  it('空 → 空オブジェクト', () => {
    expect(groupSuggestionsByCategory([])).toEqual({});
  });

  it('同カテゴリ → 1グループ', () => {
    const suggestions = buildPlanningSuggestions([
      mkAlert({ tagKey: 'panic', category: 'behavior' }),
      mkAlert({ tagKey: 'sensory', category: 'behavior' }),
    ]);
    const groups = groupSuggestionsByCategory(suggestions);
    expect(Object.keys(groups)).toEqual(['behavior']);
    expect(groups['behavior']).toHaveLength(2);
  });

  it('異なるカテゴリ → 複数グループ', () => {
    const suggestions = buildPlanningSuggestions([
      mkAlert({ tagKey: 'panic', category: 'behavior' }),
      mkAlert({ tagKey: 'eating', category: 'dailyLiving' }),
    ]);
    const groups = groupSuggestionsByCategory(suggestions);
    expect(Object.keys(groups)).toHaveLength(2);
    expect(groups['behavior']).toHaveLength(1);
    expect(groups['dailyLiving']).toHaveLength(1);
  });
});
