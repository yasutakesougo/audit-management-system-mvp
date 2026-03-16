import { describe, it, expect } from 'vitest';
import { extractKeywords, __test__ } from '../extractKeywords';
import type { HandoffRecord } from '../../handoffTypes';

const { normalizeText, applySynonyms, isNegated } = __test__;

// ── テストヘルパー ──

function makeRecord(
  overrides: Partial<HandoffRecord> & { id: number; message: string },
): HandoffRecord {
  return {
    title: 'テスト申し送り',
    userCode: 'U001',
    userDisplayName: 'テスト太郎',
    category: '体調',
    severity: '通常',
    status: '未対応',
    timeBand: '午前',
    createdAt: '2026-03-16T10:00:00Z',
    createdByName: '職員A',
    isDraft: false,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// normalizeText
// ────────────────────────────────────────────────────────────

describe('normalizeText', () => {
  it('converts full-width alphanumerics to half-width', () => {
    expect(normalizeText('ＡＢＣ１２３')).toBe('ABC123');
  });

  it('converts full-width spaces', () => {
    expect(normalizeText('体温　36.5℃')).toBe('体温 36.5℃');
  });

  it('collapses multiple whitespace', () => {
    expect(normalizeText('発熱   あり')).toBe('発熱 あり');
  });

  it('strips HTML tags', () => {
    expect(normalizeText('<p>発熱<br/>37.5℃</p>')).toBe('発熱 37.5℃');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeText('  体温正常  ')).toBe('体温正常');
  });
});

// ────────────────────────────────────────────────────────────
// applySynonyms
// ────────────────────────────────────────────────────────────

describe('applySynonyms', () => {
  it('normalizes 内服 → 服薬', () => {
    expect(applySynonyms('内服確認済み')).toBe('服薬確認済み');
  });

  it('normalizes お母さん → 母親', () => {
    expect(applySynonyms('お母さんより連絡あり')).toBe('母親より連絡あり');
  });

  it('handles multiple synonyms in one text', () => {
    const result = applySynonyms('内服後に吐いた');
    expect(result).toBe('服薬後に嘔吐');
  });
});

// ────────────────────────────────────────────────────────────
// isNegated
// ────────────────────────────────────────────────────────────

describe('isNegated', () => {
  it('detects 「発熱なし」', () => {
    expect(isNegated('発熱なし', '発熱', 0)).toBe(true);
  });

  it('detects 「発熱はなし」', () => {
    expect(isNegated('発熱はなし', '発熱', 0)).toBe(true);
  });

  it('detects 「転倒なかった」', () => {
    expect(isNegated('転倒なかった', '転倒', 0)).toBe(true);
  });

  it('detects 「不穏見られず」', () => {
    expect(isNegated('不穏見られず', '不穏', 0)).toBe(true);
  });

  it('does NOT negate 「発熱あり」', () => {
    expect(isNegated('発熱あり', '発熱', 0)).toBe(false);
  });

  it('does NOT negate 「発熱37.5℃」', () => {
    expect(isNegated('発熱37.5℃', '発熱', 0)).toBe(false);
  });

  it('detects 「特に発熱等なし」', () => {
    expect(isNegated('特に発熱等なし', '発熱', 2)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// extractKeywords — メイン関数
// ────────────────────────────────────────────────────────────

describe('extractKeywords', () => {
  it('extracts matching keywords from messages', () => {
    const records = [
      makeRecord({ id: 1, message: '午前中に発熱あり。体温37.8℃。' }),
      makeRecord({ id: 2, message: '嘔吐が1回あった。水分摂取を促した。' }),
    ];

    const result = extractKeywords(records);

    expect(result.totalRecordsAnalyzed).toBe(2);
    expect(result.hits.length).toBeGreaterThan(0);

    const feverHit = result.hits.find(h => h.keyword === '発熱');
    expect(feverHit).toBeDefined();
    expect(feverHit!.category).toBe('health');
    expect(feverHit!.count).toBe(1);
    expect(feverHit!.handoffIds).toEqual([1]);
  });

  it('counts same keyword across multiple records', () => {
    const records = [
      makeRecord({ id: 1, message: '発熱37.5℃', userCode: 'U001' }),
      makeRecord({ id: 2, message: '発熱が続いている', userCode: 'U001' }),
      makeRecord({ id: 3, message: '発熱で静養', userCode: 'U002' }),
    ];

    const result = extractKeywords(records);
    const feverHit = result.hits.find(h => h.keyword === '発熱');

    expect(feverHit).toBeDefined();
    expect(feverHit!.count).toBe(3);
    expect(feverHit!.handoffIds).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(feverHit!.matchedUserCodes).toEqual(expect.arrayContaining(['U001', 'U002']));
  });

  it('classifies keywords into correct categories', () => {
    const records = [
      makeRecord({ id: 1, message: '不穏が見られた。声かけで落ち着いた。笑顔も見られた。' }),
    ];

    const result = extractKeywords(records);

    const behaviorHit = result.hits.find(h => h.keyword === '不穏');
    const positiveHit = result.hits.find(h => h.keyword === '笑顔');
    const supportHit = result.hits.find(h => h.keyword === '声かけ');

    expect(behaviorHit?.category).toBe('behavior');
    expect(positiveHit?.category).toBe('positive');
    expect(supportHit?.category).toBe('support');
  });

  it('returns empty hits when no keywords match', () => {
    const records = [
      makeRecord({ id: 1, message: '特に変わりありません。' }),
    ];

    const result = extractKeywords(records);

    expect(result.hits).toEqual([]);
    expect(result.totalRecordsAnalyzed).toBe(1);
  });

  it('does not double-count same keyword in same record', () => {
    const records = [
      makeRecord({ id: 1, message: '発熱あり。夕方にも発熱を確認。' }),
    ];

    const result = extractKeywords(records);
    const feverHit = result.hits.find(h => h.keyword === '発熱');

    expect(feverHit!.count).toBe(1); // 1レコードなので1回
    expect(feverHit!.handoffIds).toEqual([1]);
  });

  it('excludes negated keywords', () => {
    const records = [
      makeRecord({ id: 1, message: '発熱なし。体調良好。' }),
      makeRecord({ id: 2, message: '転倒等なし。安定して過ごす。' }),
    ];

    const result = extractKeywords(records);
    const feverHit = result.hits.find(h => h.keyword === '発熱');
    const fallHit = result.hits.find(h => h.keyword === '転倒');

    expect(feverHit).toBeUndefined(); // 否定されているのでヒットしない
    expect(fallHit).toBeUndefined();
  });

  it('counts positive mentions but not negated ones', () => {
    const records = [
      makeRecord({ id: 1, message: '発熱なし' }),                    // 否定 → ヒットしない
      makeRecord({ id: 2, message: '37.8℃ 発熱あり' }),             // 肯定 → ヒント
      makeRecord({ id: 3, message: '発熱が見られた' }),               // 肯定 → ヒット
    ];

    const result = extractKeywords(records);
    const feverHit = result.hits.find(h => h.keyword === '発熱');

    expect(feverHit!.count).toBe(2); // id: 2, 3 のみ
    expect(feverHit!.handoffIds).toEqual(expect.arrayContaining([2, 3]));
  });

  it('applies synonym normalization before matching', () => {
    const records = [
      makeRecord({ id: 1, message: '内服完了。体調安定。' }),
    ];

    const result = extractKeywords(records);
    // 内服 → 服薬 に正規化後にマッチ
    const medHit = result.hits.find(h => h.keyword === '服薬');

    expect(medHit).toBeDefined();
    expect(medHit!.count).toBe(1);
  });

  it('computes byCategory totals correctly', () => {
    const records = [
      makeRecord({ id: 1, message: '発熱あり。嘔吐1回。' }),     // health ×2
      makeRecord({ id: 2, message: '不穏あり。大声が見られた。' }), // behavior ×2
      makeRecord({ id: 3, message: '笑顔が見られた。' }),          // positive ×1
    ];

    const result = extractKeywords(records);

    expect(result.byCategory.health).toBeGreaterThanOrEqual(2);
    expect(result.byCategory.behavior).toBeGreaterThanOrEqual(2);
    expect(result.byCategory.positive).toBeGreaterThanOrEqual(1);
  });

  it('sorts hits by count descending', () => {
    const records = [
      makeRecord({ id: 1, message: '発熱' }),
      makeRecord({ id: 2, message: '発熱' }),
      makeRecord({ id: 3, message: '発熱' }),
      makeRecord({ id: 4, message: '嘔吐' }),
    ];

    const result = extractKeywords(records);

    expect(result.hits[0].keyword).toBe('発熱');
    expect(result.hits[0].count).toBe(3);
  });

  it('tracks lastSeenAt correctly', () => {
    const records = [
      makeRecord({ id: 1, message: '発熱あり', createdAt: '2026-03-14T10:00:00Z' }),
      makeRecord({ id: 2, message: '発熱継続', createdAt: '2026-03-16T08:00:00Z' }),
      makeRecord({ id: 3, message: '発熱改善', createdAt: '2026-03-15T10:00:00Z' }),
    ];

    const result = extractKeywords(records);
    const feverHit = result.hits.find(h => h.keyword === '発熱');

    expect(feverHit!.lastSeenAt).toBe('2026-03-16T08:00:00Z');
  });

  it('handles empty records array', () => {
    const result = extractKeywords([]);

    expect(result.hits).toEqual([]);
    expect(result.totalRecordsAnalyzed).toBe(0);
    expect(result.byCategory.health).toBe(0);
  });

  it('handles HTML rich text in messages', () => {
    const records = [
      makeRecord({ id: 1, message: '<p>午前中に<strong>発熱</strong>あり。<br/>体温37.8℃</p>' }),
    ];

    const result = extractKeywords(records);
    const feverHit = result.hits.find(h => h.keyword === '発熱');

    expect(feverHit).toBeDefined();
    expect(feverHit!.count).toBe(1);
  });
});
