import { describe, expect, it } from 'vitest';
import { convertJapaneseWeekdaysToNumbers } from '../weekdayConverter';

describe('convertJapaneseWeekdaysToNumbers', () => {
  it('correctly maps standard Japanese single character weekdays', () => {
    expect(convertJapaneseWeekdaysToNumbers(['月', '水', '金'])).toEqual([1, 3, 5]);
    expect(convertJapaneseWeekdaysToNumbers(['日', '火', '木', '土'])).toEqual([0, 2, 4, 6]);
  });

  it('correctly extracts leading character from full weekday name', () => {
    expect(convertJapaneseWeekdaysToNumbers(['月曜日', '水曜日', '金曜日'])).toEqual([1, 3, 5]);
    expect(convertJapaneseWeekdaysToNumbers([' 日曜 ', '木曜'])).toEqual([0, 4]);
  });

  it('handles invalid inputs gracefully by filtering them out', () => {
    // Non-existent weekdays should be ignored
    expect(convertJapaneseWeekdaysToNumbers(['祝', '月', 'None'])).toEqual([1]);
  });

  it('returns empty array when input is empty or invalid type', () => {
    expect(convertJapaneseWeekdaysToNumbers([])).toEqual([]);
    expect(convertJapaneseWeekdaysToNumbers(null as unknown as string[])).toEqual([]);
    expect(convertJapaneseWeekdaysToNumbers(undefined as unknown as string[])).toEqual([]);
  });
});
