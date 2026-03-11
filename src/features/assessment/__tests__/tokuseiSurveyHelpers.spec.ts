/**
 * tokuseiSurveyHelpers.spec.ts
 *
 * Focused unit tests for tokuseiSurveyHelpers.ts pure functions.
 * No mocks, no React, no MSW — pure input/output assertions.
 */
import type { TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import { describe, expect, it } from 'vitest';
import { applyResponseFilters, buildUserOptions, formatDateTime } from '../tokuseiSurveyHelpers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeResponse = (
  override: Partial<TokuseiSurveyResponse> = {},
): TokuseiSurveyResponse =>
  ({
    id: 1,
    targetUserName: '田中 太郎',
    responderName: '田中 花子',
    guardianName: '',
    relation: '',
    responderEmail: '',
    fillDate: '2024-06-01T10:00:00.000Z',
    personality: '',
    sensoryFeatures: '',
    behaviorFeatures: '',
    strengths: '',
    notes: '',
    heightCm: null,
    weightKg: null,
    ...override,
  } as TokuseiSurveyResponse);

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

describe('formatDateTime', () => {
  it('returns "未入力" for empty string', () => {
    expect(formatDateTime('')).toBe('未入力');
  });

  it('returns raw value for unparseable date', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });

  it('returns formatted Japanese date for valid ISO string', () => {
    // 2024-06-15T09:30:00.000Z → JST 2024/06/15 18:30 (depending on TZ)
    const result = formatDateTime('2024-06-15T09:30:00.000Z');
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/06/);
    expect(result).toMatch(/15/);
  });
});

// ---------------------------------------------------------------------------
// buildUserOptions
// ---------------------------------------------------------------------------

describe('buildUserOptions', () => {
  it('returns empty array for empty input', () => {
    expect(buildUserOptions([])).toEqual([]);
  });

  it('deduplicates user names', () => {
    const responses = [
      makeResponse({ id: 1, targetUserName: '鈴木 一' }),
      makeResponse({ id: 2, targetUserName: '鈴木 一' }),
      makeResponse({ id: 3, targetUserName: '田中 二' }),
    ];
    const result = buildUserOptions(responses);
    expect(result).toHaveLength(2);
    expect(result).toContain('鈴木 一');
    expect(result).toContain('田中 二');
  });

  it('excludes responses with empty targetUserName', () => {
    const responses = [
      makeResponse({ id: 1, targetUserName: '' }),
      makeResponse({ id: 2, targetUserName: '田中 太郎' }),
    ];
    const result = buildUserOptions(responses);
    expect(result).toEqual(['田中 太郎']);
  });

  it('sorts names (result is sorted ascending)', () => {
    const responses = [
      makeResponse({ id: 1, targetUserName: '山田 三' }),
      makeResponse({ id: 2, targetUserName: '阿部 一' }),
      makeResponse({ id: 3, targetUserName: '川口 二' }),
    ];
    const result = buildUserOptions(responses);
    // Verify all 3 names are present and the array is sorted
    expect(result).toHaveLength(3);
    expect(result).toContain('山田 三');
    expect(result).toContain('阿部 一');
    expect(result).toContain('川口 二');
    // Verify sorted order is stable (each element <= next)
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].localeCompare(result[i + 1], 'ja')).toBeLessThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// applyResponseFilters
// ---------------------------------------------------------------------------

describe('applyResponseFilters', () => {
  const r1 = makeResponse({ id: 1, targetUserName: '田中 太郎', responderName: '田中 花子', fillDate: '2024-01-15T00:00:00Z' });
  const r2 = makeResponse({ id: 2, targetUserName: '鈴木 一郎', responderName: '鈴木 幸子', fillDate: '2024-03-01T00:00:00Z' });
  const r3 = makeResponse({ id: 3, targetUserName: '田中 次郎', responderName: '保護者', fillDate: '2024-06-10T00:00:00Z' });

  const noFilter = { selectedUser: 'all', searchQuery: '', fromDate: '', toDate: '' };

  it('returns all responses when no filter is active', () => {
    expect(applyResponseFilters([r1, r2, r3], noFilter)).toHaveLength(3);
  });

  it('filters by selectedUser', () => {
    const result = applyResponseFilters([r1, r2, r3], { ...noFilter, selectedUser: '田中 太郎' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by searchQuery matching targetUserName', () => {
    const result = applyResponseFilters([r1, r2, r3], { ...noFilter, searchQuery: '鈴木' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('filters by searchQuery matching responderName', () => {
    const result = applyResponseFilters([r1, r2, r3], { ...noFilter, searchQuery: '保護者' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('filters by searchQuery case-insensitively', () => {
    const result = applyResponseFilters([r1, r2, r3], { ...noFilter, searchQuery: '田中' });
    expect(result).toHaveLength(2);
  });

  it('filters by fromDate (inclusive)', () => {
    // fromDate = 2024-03-01 — should include r2 and r3
    const result = applyResponseFilters([r1, r2, r3], { ...noFilter, fromDate: '2024-03-01' });
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining([2, 3]));
    expect(result.map((r) => r.id)).not.toContain(1);
  });

  it('filters by toDate (inclusive)', () => {
    // toDate = 2024-03-01 — should include r1 and r2 only
    const result = applyResponseFilters([r1, r2, r3], { ...noFilter, toDate: '2024-03-01' });
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining([1, 2]));
    expect(result.map((r) => r.id)).not.toContain(3);
  });

  it('combines selectedUser + searchQuery filters', () => {
    // selectedUser = '田中 太郎' AND searchQuery = '田中'
    const result = applyResponseFilters([r1, r2, r3], {
      ...noFilter,
      selectedUser: '田中 太郎',
      searchQuery: '田中',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns empty array when no responses match', () => {
    const result = applyResponseFilters([r1, r2, r3], { ...noFilter, searchQuery: 'XXXXXX' });
    expect(result).toHaveLength(0);
  });
});
