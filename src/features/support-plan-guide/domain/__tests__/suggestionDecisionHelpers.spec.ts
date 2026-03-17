/**
 * suggestionDecisionHelpers — P3-D 永続化ヘルパーテスト
 *
 * Pure 関数の単体テスト。ドメイン知識なしでテスト可能。
 */
import { describe, it, expect } from 'vitest';
import type { SuggestionDecisionRecord } from '../../types';
import {
  getLatestDecisionMap,
  getDecisionsBySource,
  appendDecisionRecord,
  removeDecisionRecords,
  sanitizeDecisionRecords,
} from '../suggestionDecisionHelpers';

// ────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────

const now = '2026-03-17T10:00:00.000Z';

function rec(
  id: string,
  source: 'smart' | 'memo',
  action: string,
  at = now,
): SuggestionDecisionRecord {
  return {
    id,
    source,
    action: action as SuggestionDecisionRecord['action'],
    decidedAt: at,
  };
}

// ────────────────────────────────────────────
// getLatestDecisionMap
// ────────────────────────────────────────────

describe('getLatestDecisionMap', () => {
  it('空配列なら空Mapを返す', () => {
    expect(getLatestDecisionMap([]).size).toBe(0);
  });

  it('各 id の最新レコードのみ返す', () => {
    const records = [
      rec('s1', 'smart', 'accepted', '2026-03-17T09:00:00Z'),
      rec('s1', 'smart', 'dismissed', '2026-03-17T10:00:00Z'), // 最新：後に追加
      rec('s2', 'memo', 'noted', '2026-03-17T10:00:00Z'),
    ];
    const result = getLatestDecisionMap(records);
    expect(result.size).toBe(2);
    expect(result.get('s1')?.action).toBe('dismissed');
    expect(result.get('s2')?.action).toBe('noted');
  });

  it('同一時刻の場合は後の要素が優先される', () => {
    const records = [
      rec('s1', 'smart', 'accepted', now),
      rec('s1', 'smart', 'dismissed', now),
    ];
    const result = getLatestDecisionMap(records);
    expect(result.get('s1')?.action).toBe('dismissed');
  });
});

// ────────────────────────────────────────────
// getDecisionsBySource
// ────────────────────────────────────────────

describe('getDecisionsBySource', () => {
  it('指定 source のレコードのみ返す', () => {
    const records = [
      rec('s1', 'smart', 'accepted'),
      rec('s2', 'memo', 'noted'),
      rec('s3', 'smart', 'dismissed'),
    ];
    const smartResult = getDecisionsBySource(records, 'smart');
    expect(smartResult).toEqual({
      s1: 'accepted',
      s3: 'dismissed',
    });
    // memo
    const memoResult = getDecisionsBySource(records, 'memo');
    expect(memoResult).toEqual({
      s2: 'noted',
    });
  });

  it('該当 source がなければ空オブジェクト', () => {
    const records = [rec('s1', 'smart', 'accepted')];
    expect(getDecisionsBySource(records, 'memo')).toEqual({});
  });
});

// ────────────────────────────────────────────
// appendDecisionRecord
// ────────────────────────────────────────────

describe('appendDecisionRecord', () => {
  it('新しいレコードを末尾に追加する', () => {
    const existing = [rec('s1', 'smart', 'accepted')];
    const result = appendDecisionRecord(existing, 's2', 'memo', 'noted');
    expect(result).toHaveLength(2);
    expect(result[1].id).toBe('s2');
    expect(result[1].source).toBe('memo');
    expect(result[1].action).toBe('noted');
    expect(result[1].decidedAt).toBeTruthy();
  });

  it('元の配列は変更されない（イミュータブル）', () => {
    const existing = [rec('s1', 'smart', 'accepted')];
    const result = appendDecisionRecord(existing, 's2', 'memo', 'noted');
    expect(existing).toHaveLength(1);
    expect(result).not.toBe(existing);
  });
});

// ────────────────────────────────────────────
// removeDecisionRecords
// ────────────────────────────────────────────

describe('removeDecisionRecords', () => {
  it('指定 id + source に一致するレコードを除去', () => {
    const records = [
      rec('s1', 'smart', 'accepted'),
      rec('s1', 'memo', 'noted'),
      rec('s2', 'smart', 'dismissed'),
    ];
    const result = removeDecisionRecords(records, 's1', 'smart');
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === 's1' && r.source === 'smart')).toBeUndefined();
    expect(result.find((r) => r.id === 's1' && r.source === 'memo')).toBeTruthy();
  });

  it('該当なしの場合は元と同じ長さ', () => {
    const records = [rec('s1', 'smart', 'accepted')];
    const result = removeDecisionRecords(records, 's99', 'smart');
    expect(result).toHaveLength(1);
  });

  it('元の配列は変更されない', () => {
    const records = [rec('s1', 'smart', 'accepted')];
    const result = removeDecisionRecords(records, 's1', 'smart');
    expect(records).toHaveLength(1);
    expect(result).not.toBe(records);
  });
});

// ────────────────────────────────────────────
// sanitizeDecisionRecords
// ────────────────────────────────────────────

describe('sanitizeDecisionRecords', () => {
  it('有効なレコード配列をそのまま返す', () => {
    const records = [rec('s1', 'smart', 'accepted')];
    const result = sanitizeDecisionRecords(records);
    expect(result).toEqual(records);
  });

  it('null / undefined → 空配列', () => {
    expect(sanitizeDecisionRecords(null)).toEqual([]);
    expect(sanitizeDecisionRecords(undefined)).toEqual([]);
  });

  it('配列でない値 → 空配列', () => {
    expect(sanitizeDecisionRecords('invalid' as unknown)).toEqual([]);
    expect(sanitizeDecisionRecords(42 as unknown)).toEqual([]);
  });

  it('不正なエントリをフィルタする', () => {
    const mixed = [
      rec('s1', 'smart', 'accepted'),
      { invalid: true } as unknown as SuggestionDecisionRecord,
      null as unknown as SuggestionDecisionRecord,
      rec('s2', 'memo', 'noted'),
    ];
    const result = sanitizeDecisionRecords(mixed);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('s1');
    expect(result[1].id).toBe('s2');
  });

  it('不正な action のレコードをフィルタする', () => {
    const records = [
      rec('s1', 'smart', 'accepted'),
      { id: 's2', source: 'smart', action: 'unknown-action', decidedAt: now } as unknown as SuggestionDecisionRecord,
    ];
    const result = sanitizeDecisionRecords(records);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });
});
