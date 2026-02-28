import { describe, expect, it } from 'vitest';
import {
    buildDailyHubFromTodayUrl,
    buildTodayReturnUrl,
    parseNavQuery,
} from '../navigationLinks';

// ---------------------------------------------------------------------------
// navigationLinks — ユニットテスト
// ---------------------------------------------------------------------------

describe('buildDailyHubFromTodayUrl', () => {
  it('日付なしで from=today のみ', () => {
    expect(buildDailyHubFromTodayUrl()).toBe('/dailysupport?from=today');
  });

  it('日付ありで from + date を付与', () => {
    expect(buildDailyHubFromTodayUrl('2026-02-28')).toBe(
      '/dailysupport?from=today&date=2026-02-28',
    );
  });

  it('空文字の date は無視される', () => {
    expect(buildDailyHubFromTodayUrl('  ')).toBe('/dailysupport?from=today');
  });
});

describe('buildTodayReturnUrl', () => {
  it('日付なしではクエリなし', () => {
    expect(buildTodayReturnUrl()).toBe('/today');
  });

  it('日付ありで date を付与', () => {
    expect(buildTodayReturnUrl('2026-02-28')).toBe('/today?date=2026-02-28');
  });

  it('空文字の date は無視される', () => {
    expect(buildTodayReturnUrl('')).toBe('/today');
  });
});

describe('parseNavQuery', () => {
  it('from=today & date を正しくパースする', () => {
    const params = new URLSearchParams('from=today&date=2026-02-28');
    expect(parseNavQuery(params)).toEqual({
      from: 'today',
      date: '2026-02-28',
    });
  });

  it('空のパラメータは undefined を返す', () => {
    const params = new URLSearchParams('');
    expect(parseNavQuery(params)).toEqual({
      from: undefined,
      date: undefined,
    });
  });

  it('許可リスト外の from は undefined にする', () => {
    const params = new URLSearchParams('from=unknown&date=2026-02-28');
    expect(parseNavQuery(params)).toEqual({
      from: undefined,
      date: '2026-02-28',
    });
  });

  it('date のみ（from なし）', () => {
    const params = new URLSearchParams('date=2026-02-28');
    expect(parseNavQuery(params)).toEqual({
      from: undefined,
      date: '2026-02-28',
    });
  });
});
