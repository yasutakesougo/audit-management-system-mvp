import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getInitialOccurredAt } from '../QuickRecordTab';

describe('getInitialOccurredAt', () => {
  beforeEach(() => {
    // 2026-05-22 11:22:33 JST (Asia/Tokyo) = 2026-05-22 02:22:33 UTC
    const mockDate = new Date('2026-05-22T11:22:33+09:00');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('URL引数なしの場合、現在の日本時間 (Asia/Tokyo) を返す', () => {
    const result = getInitialOccurredAt();
    expect(result).toBe('2026-05-22T11:22');
  });

  it('date のみ指定された場合、本日であれば現在のローカル時刻、過去日であれば 12:00 を返す', () => {
    // 本日
    const resultToday = getInitialOccurredAt('2026-05-22');
    expect(resultToday).toBe('2026-05-22T11:22');

    // 過去日
    const resultPast = getInitialOccurredAt('2026-05-20');
    expect(resultPast).toBe('2026-05-20T12:00');

    // 未来日
    const resultFuture = getInitialOccurredAt('2026-05-25');
    expect(resultFuture).toBe('2026-05-25T12:00');
  });

  it('date と slotId (時刻情報あり) が指定された場合、slotId から時刻をパースして結合する', () => {
    const result = getInitialOccurredAt('2026-05-20', '9:30頃|通所・朝の準備');
    expect(result).toBe('2026-05-20T09:30');

    const result2 = getInitialOccurredAt('2026-05-20', '13:00|作業時間');
    expect(result2).toBe('2026-05-20T13:00');
  });

  it('slotId の時刻パースに失敗した場合、デフォルトのフォールバックルールを適用する', () => {
    // 時刻を含まない slotId
    const result = getInitialOccurredAt('2026-05-20', 'お昼休み|食事');
    expect(result).toBe('2026-05-20T12:00'); // 過去日なので 12:00
  });
});
