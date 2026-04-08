import { describe, it, expect } from 'vitest';
import { compareUsersByJapaneseOrder } from '../japaneseCollator';

describe('compareUsersByJapaneseOrder', () => {
  it('should sort by Kana order (Primary key)', () => {
    const users = [
      { FullName: '田中', Furigana: 'たなか' },
      { FullName: 'あべ', Furigana: 'あべ' },
      { FullName: '山崎', Furigana: 'やまざき' },
    ];
    const sorted = [...users].sort(compareUsersByJapaneseOrder);
    expect(sorted[0].FullName).toBe('あべ');
    expect(sorted[1].FullName).toBe('田中');
    expect(sorted[2].FullName).toBe('山崎');
  });

  it('should sort by FullName if Kana is identical (Secondary key)', () => {
    const users = [
      { FullName: '田中 二郎', Furigana: 'たなか' },
      { FullName: '田中 一郎', Furigana: 'たなか' },
    ];
    const sorted = [...users].sort(compareUsersByJapaneseOrder);
    expect(sorted[0].FullName).toBe('田中 一郎');
    expect(sorted[1].FullName).toBe('田中 二郎');
  });

  it('should sort by UserID/Id if reading and name are identical (Tertiary key)', () => {
    const users = [
      { UserID: 'B001', FullName: '田中 一郎', Furigana: 'たなか' },
      { UserID: 'A001', FullName: '田中 一郎', Furigana: 'たなか' },
    ];
    const sorted = [...users].sort(compareUsersByJapaneseOrder);
    expect(sorted[0].UserID).toBe('A001');
    expect(sorted[1].UserID).toBe('B001');
  });

  it('should handle missing Furigana by falling back to FullNameKana or FullName', () => {
    const users = [
      { FullName: 'たなか' }, // No Furigana
      { FullName: 'あべ', Furigana: 'あべ' },
    ];
    const sorted = [...users].sort(compareUsersByJapaneseOrder);
    expect(sorted[0].FullName).toBe('あべ');
    expect(sorted[1].FullName).toBe('たなか');
  });

  it('should be stable with numeric UserIDs', () => {
    const users = [
      { UserID: '10', FullName: '田中', Furigana: 'たなか' },
      { UserID: '2', FullName: '田中', Furigana: 'たなか' },
    ];
    const sorted = [...users].sort(compareUsersByJapaneseOrder);
    // numeric: true should sort "2" before "10"
    expect(sorted[0].UserID).toBe('2');
    expect(sorted[1].UserID).toBe('10');
  });

  it('should ignore leading/trailing whitespace', () => {
    const users = [
      { FullName: ' 田中 ', Furigana: ' たなか ' },
      { FullName: 'あべ', Furigana: 'あべ' },
    ];
    const sorted = [...users].sort(compareUsersByJapaneseOrder);
    expect(sorted[0].FullName).toBe('あべ');
    expect(sorted[1].FullName.trim()).toBe('田中');
  });

  it('should handle mixed Hiragana and Katakana (sensitivity: base)', () => {
    const users = [
      { FullName: 'カタカナ', Furigana: 'かたかな' },
      { FullName: 'ひらがな', Furigana: 'ひらがな' },
    ];
    // "かたかな" vs "ひらがな"
    const sorted = [...users].sort(compareUsersByJapaneseOrder);
    expect(sorted[0].Furigana).toBe('かたかな');
    expect(sorted[1].Furigana).toBe('ひらがな');
  });
});
